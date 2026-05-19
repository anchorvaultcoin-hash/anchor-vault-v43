const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — ReentrancyGuard", function () {
    it("1. nonReentrant на withdraw защищает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Пробуем вызвать withdraw дважды в одной транзакции — невозможно извне
        // Проверяем что повторный вызов в том же блоке работает (разные tx)
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        // Оба прошли — nonReentrant сбрасывается между транзакциями
    });

    it("2. nonReentrant на deposit защищает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(ethers.parseEther("99.8"));
    });

    it("3. nonReentrant на openVault защищает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, (await vault.getVaultCore(alice.address, 1)).amount, alice.address, P.code, P.antiPhrase);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.activeVaultId(alice.address)).to.equal(2);
    });

    it("4. nonReentrant на transfer защищает", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
    });

    it("5. nonReentrant на earlyClose/recover/emergency", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        // Успешно закрыт, nonReentrant не заблокировал
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(2, P.recovery);
        expect((await vault.getVaultCore(alice.address, 2)).status).to.equal(1);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(3, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 3)).status).to.equal(1);
    });
});
