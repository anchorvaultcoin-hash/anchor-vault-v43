const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — State Transitions", function () {
    it("1. ACTIVE → CLOSED через withdraw", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, (await vault.getVaultCore(alice.address, 1)).amount, alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("2. ACTIVE → CLOSED через earlyClose", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("3. ACTIVE → CLOSED через recoverToSafe", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("4. ACTIVE → CLOSED через emergencyAny", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("5. ACTIVE → ACTIVE после transfer", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(0);
    });
    it("6. CLOSED → нельзя deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("7. CLOSED → нельзя withdraw", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("8. CLOSED → нельзя transfer", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("9. CLOSED → можно открыть новый", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        expect(await vault.activeVaultId(alice.address)).to.equal(2);
    });
    it("10. paused → unpaused → paused → unpaused", async function () {
        const { vault, ancr, alice, guardian, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        expect(await vault.paused()).to.equal(true);
        await vault.connect(creator).unpause();
        expect(await vault.paused()).to.equal(false);
        await vault.connect(guardian).emergencyPause();
        expect(await vault.paused()).to.equal(true);
        await vault.connect(creator).unpause();
        expect(await vault.paused()).to.equal(false);
    });
});
