const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — emergencyWithdrawToAny", function () {
    it("1. вывод на любой адрес", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await ancr.balanceOf(bob.address);
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect(await ancr.balanceOf(bob.address)).to.be.gt(before);
    });
    it("2. vault закрыт", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("3. activeVaultId сброшен", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("4. событие EmergencyWithdrawToAny", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase))
            .to.emit(vault, "EmergencyWithdrawToAny");
    });
    it("5. PenaltyDistributed", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase))
            .to.emit(vault, "PenaltyDistributed");
    });
    it("6. BadVaultId", async function () {
        const { vault, alice, bob } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).emergencyWithdrawToAny(99, bob.address, P.recovery, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("7. NotActive", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("8. InvalidAddress to=0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, ethers.ZeroAddress, P.recovery, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
    it("9. InvalidAddress to=contract", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, await vault.getAddress(), P.recovery, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
    it("10. WrongCode на antiPhrase", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, "WrongPhrase!!"))
            .to.be.revertedWithCustomError(vault, "WrongCode");
    });
    it("11. AntiPhishRequired", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, ""))
            .to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });
    it("12. Locked (voluntaryLock)", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "Locked");
    });
    it("13. amount=0 после emergencyAny", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.equal(0);
    });
});
