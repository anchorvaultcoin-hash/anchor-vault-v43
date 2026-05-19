const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Fee Precision", function () {
    it("1. OPEN_VAULT_FEE_BPS = 20", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.OPEN_VAULT_FEE_BPS()).to.equal(20);
    });

    it("2. WITHDRAW_FEE_BPS = 50", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.WITHDRAW_FEE_BPS()).to.equal(50);
    });

    it("3. TRANSFER_FEE_BPS = 50", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.TRANSFER_FEE_BPS()).to.equal(50);
    });

    it("4. EARLY_CLOSE_FEE_BPS = 500", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.EARLY_CLOSE_FEE_BPS()).to.equal(500);
    });

    it("5. RECOVER_TO_SAFE_FEE_BPS = 1000", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.RECOVER_TO_SAFE_FEE_BPS()).to.equal(1000);
    });

    it("6. EMERGENCY_ANY_FEE_BPS = 1500", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.EMERGENCY_ANY_FEE_BPS()).to.equal(1500);
    });

    it("7. SAFE deposit fee = 50", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.SAFE_DEPOSIT_FEE_BPS()).to.equal(50);
    });

    it("8. VAULT deposit fee = 150", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.VAULT_DEPOSIT_FEE_BPS()).to.equal(150);
    });

    it("9. FORTRESS deposit fee = 200", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.FORTRESS_DEPOSIT_FEE_BPS()).to.equal(200);
    });

    it("10. all fees sum check: open=20, withdraw=50, early=500, recover=1000, emergency=1500", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.OPEN_VAULT_FEE_BPS()).to.equal(20);
        expect(await vault.WITHDRAW_FEE_BPS()).to.equal(50);
        expect(await vault.EARLY_CLOSE_FEE_BPS()).to.equal(500);
        expect(await vault.RECOVER_TO_SAFE_FEE_BPS()).to.equal(1000);
        expect(await vault.EMERGENCY_ANY_FEE_BPS()).to.equal(1500);
    });
});
