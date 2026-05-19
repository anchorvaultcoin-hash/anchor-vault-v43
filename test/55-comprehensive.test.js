const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Final Edge", function () {
    it("1. MIN_DEPOSIT ровно 0.01", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MIN_DEPOSIT()).to.equal(ethers.parseEther("0.01"));
    });
    it("2. нельзя openVault с amount = 0", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), 0);
        const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: 0, emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
    });
    it("3. withdraw 1 wei работает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, P.antiPhrase);
    });
    it("4. нельзя withdraw из чужого сейфа", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(bob).withdrawFromVault(1, 1n, bob.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("5. antiPhrase пустая ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, "")).to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });
    it("6. WrongCode на antiPhrase ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, "Wrong!!")).to.be.revertedWithCustomError(vault, "WrongCode");
    });
    it("7. нельзя deposit в vid=0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(0, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("8. openVault с code=10 символов проходит", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: "1234567890", antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
    });
    it("9. openVault с code=64 символа проходит", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const code64 = "x".repeat(64);
        const params = { name: "V", code: code64, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
    });
    it("10. setTimelock SAFE > 0 ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0 });
        await expect(vault.connect(alice).setTimelock(1, 1, P.code)).to.be.revertedWithCustomError(vault, "TimelockTooLong");
    });
});
