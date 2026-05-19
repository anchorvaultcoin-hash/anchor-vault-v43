const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Deposit Fuzzing", function () {
    it("1. депозит минимальной суммы (0.01)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = (await vault.getVaultCore(alice.address, 1)).amount;
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("0.02"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("0.02"), P.code);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(before);
    });
    it("2. депозит 1000 токенов", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("1000"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("1000"), P.code);
    });
    it("3. 10 депозитов подряд", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 10; i++) {
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
            await vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code);
        }
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(ethers.parseEther("99.8"));
    });
    it("4. депозит после частичного вывода", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.code, P.antiPhrase);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
    });
    it("5. депозит после rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.newCode);
    });
    it("6. депозит во время voluntaryLock ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("7. депозит на закрытый сейф ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("8. депозит в несуществующий сейф ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(99, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("9. депозит с неверным кодом — amount не меняется", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = (await vault.getVaultCore(alice.address, 1)).amount;
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("10"), "wrongcode!!");
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.equal(before);
    });
    it("10. депозит 0 ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).depositToVault(1, 0, P.code)).to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
    });
});
