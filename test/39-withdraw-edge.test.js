const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Withdraw Edge", function () {
    it("1. вывод после открытия без депозита", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        await vault.connect(alice).withdrawFromVault(1, core.amount, alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });

    it("2. вывод разными суммами 10 раз", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("500") });
        for (let i = 1; i <= 10; i++) {
            await vault.connect(alice).withdrawFromVault(1, ethers.parseEther(String(i)), alice.address, P.code, P.antiPhrase);
        }
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(0);
    });

    it("3. вывод на разные адреса работает", async function () {
        const { vault, ancr, alice, bob, carol, dave } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.code, P.antiPhrase);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), carol.address, P.code, P.antiPhrase);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), dave.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.lt(ethers.parseEther("70"));
    });

    it("4. вывод после rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.newCode, P.newAntiPhrase);
    });

    it("5. вывод после transfer от другого", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("15"), bob.address, P.newCode, P.newAntiPhrase);
    });

    it("6. вывод всей суммы кроме комиссии", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const full = (await vault.getVaultCore(alice.address, 1)).amount;
        await vault.connect(alice).withdrawFromVault(1, full, alice.address, P.code, P.antiPhrase);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });

    it("7. вывод 0 ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).withdrawFromVault(1, 0, alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("8. вывод больше баланса ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("999"), alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("9. вывод на адрес 0 ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("1"), ethers.ZeroAddress, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("10. вывод на контракт ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("1"), await vault.getAddress(), P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
});
