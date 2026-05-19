const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture } = require("./helpers");

describe("AnchorVaultV43 — Constants", function () {
    it("1. VERSION = 43", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.VERSION()).to.equal(43);
    });

    it("2. MIN_CODE_LENGTH = 10", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MIN_CODE_LENGTH()).to.equal(10);
    });

    it("3. MAX_CODE_LENGTH = 64", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MAX_CODE_LENGTH()).to.equal(64);
    });

    it("4. MIN_DEPOSIT = 10^16", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MIN_DEPOSIT()).to.equal(ethers.parseEther("0.01"));
    });

    it("5. MAX_WELCOME_BONUS = MIN_DEPOSIT / 2", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MAX_WELCOME_BONUS()).to.equal(ethers.parseEther("0.005"));
    });

    it("6. PAUSE_DELAY = 2 days", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PAUSE_DELAY()).to.equal(2 * 24 * 3600);
    });

    it("7. ADMIN_WITHDRAW_TIMELOCK = 7 days", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.ADMIN_WITHDRAW_TIMELOCK()).to.equal(7 * 24 * 3600);
    });

    it("8. CREATOR_COOLDOWN = 7 days", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.CREATOR_COOLDOWN()).to.equal(7 * 24 * 3600);
    });

    it("9. GUARDIAN_COOLDOWN = 2 days", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.GUARDIAN_COOLDOWN()).to.equal(2 * 24 * 3600);
    });

    it("10. FROZEN_PERIOD = 7 days", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.FROZEN_PERIOD()).to.equal(7 * 24 * 3600);
    });
});
