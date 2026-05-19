const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — recoverToSafe", function () {
    it("1. средства на emergencyAddress", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { emergencyAddress: frank.address, amount: ethers.parseEther("100") });
        const before = await ancr.balanceOf(frank.address);
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect(await ancr.balanceOf(frank.address)).to.be.gt(before);
    });
    it("2. vault закрыт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("3. activeVaultId сброшен", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("4. событие VaultRecovered", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery)).to.emit(vault, "VaultRecovered");
    });
    it("5. PenaltyDistributed", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery)).to.emit(vault, "PenaltyDistributed");
    });
    it("6. BadVaultId", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).recoverToSafe(99, P.recovery)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("7. NotActive", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery)).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("8. Locked (voluntaryLock)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery)).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("9. amount=0 после recover", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.equal(0);
    });
    it("10. recoverToSafe после депозита", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });});
