const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — views", function () {
    it("1. getVaultCore возвращает данные", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.id).to.equal(1);
        expect(core.token).to.equal(await ancr.getAddress());
        expect(core.status).to.equal(0);
    });
    it("2. getVaultTimings возвращает данные", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const t = await vault.getVaultTimings(alice.address, 1);
        expect(t.lockedAt).to.be.gt(0);
        expect(t.depositedAt).to.be.gt(0);
    });
    it("3. getVaultSecurity возвращает failCount", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const sec = await vault.getVaultSecurity(alice.address, 1);
        expect(sec.failCount).to.equal(0);
        expect(sec.requiresCodeRotation).to.equal(false);
    });
    it("4. BadVaultId на getVaultCore", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        await expect(vault.getVaultCore(alice.address, 99))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("5. VERSION = 43", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.VERSION()).to.equal(43);
    });
    it("6. getMaxTimelockForLevel", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getMaxTimelockForLevel(0)).to.equal(0);
        expect(await vault.getMaxTimelockForLevel(1)).to.equal(72);
        expect(await vault.getMaxTimelockForLevel(2)).to.equal(168);
    });
    it("7. getDepositFeeForLevel", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getDepositFeeForLevel(0)).to.equal(50);
        expect(await vault.getDepositFeeForLevel(1)).to.equal(150);
        expect(await vault.getDepositFeeForLevel(2)).to.equal(200);
    });
    it("8. supportedTokens", async function () {
        const { vault, ancr } = await loadFixture(deployFixture);
        expect(await vault.supportedTokens(await ancr.getAddress())).to.equal(true);
    });
    it("9. public константы", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MIN_CODE_LENGTH()).to.equal(10);
        expect(await vault.MAX_CODE_LENGTH()).to.equal(64);
        expect(await vault.MIN_DEPOSIT()).to.equal(ethers.parseEther("0.01"));
    });
    it("10. начальное состояние маппингов", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        expect(await vault.userVaultCount(alice.address)).to.equal(0);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("11. getAntiPhishHash возвращает хеш", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.getAntiPhishHash(alice.address, 1)).to.not.equal(ethers.ZeroHash);
    });
    it("12. activeVaultId после открытия", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.activeVaultId(alice.address)).to.equal(1);
    });
    it("13. getAntiPhishHash не нулевой после openVault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.getAntiPhishHash(alice.address, 1)).to.not.equal(ethers.ZeroHash);
    });
    it("14. activeVaultId возвращает 0 для нового пользователя", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("15. userVaultCount возвращает 0 для нового пользователя", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        expect(await vault.userVaultCount(alice.address)).to.equal(0);
    });
    it("16. paused = false на старте", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.paused()).to.equal(false);
    });});
