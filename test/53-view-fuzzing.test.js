const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — View Fuzzing", function () {
    it("1. getVaultCore после открытия", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { name: "TestVault", amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.id).to.equal(1);
        expect(core.token).to.equal(await ancr.getAddress());
        expect(core.name).to.equal("TestVault");
        expect(core.status).to.equal(0);
    });
    it("2. getVaultCore после закрытия", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(1);
        expect(core.amount).to.equal(0);
    });
    it("3. getVaultTimings после openVault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const t = await vault.getVaultTimings(alice.address, 1);
        expect(t.lockedAt).to.be.gt(0);
        expect(t.depositedAt).to.be.gt(0);
        expect(t.lockedUntil).to.equal(0);
        expect(t.voluntaryLockUntil).to.equal(0);
    });
    it("4. getVaultSecurity после failedAttempts", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        const sec = await vault.getVaultSecurity(alice.address, 1);
        expect(sec.failCount).to.equal(1);
        expect(sec.requiresCodeRotation).to.equal(false);
    });
    it("5. getAntiPhishHash не нулевой", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.getAntiPhishHash(alice.address, 1)).to.not.equal(ethers.ZeroHash);
    });
    it("6. getMaxTimelockForLevel для всех уровней", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getMaxTimelockForLevel(0)).to.equal(0);
        expect(await vault.getMaxTimelockForLevel(1)).to.equal(72);
        expect(await vault.getMaxTimelockForLevel(2)).to.equal(168);
    });
    it("7. getDepositFeeForLevel для всех уровней", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getDepositFeeForLevel(0)).to.equal(50);
        expect(await vault.getDepositFeeForLevel(1)).to.equal(150);
        expect(await vault.getDepositFeeForLevel(2)).to.equal(200);
    });
    it("8. userVaultCount после нескольких сейфов", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.userVaultCount(alice.address)).to.equal(2);
    });
    it("9. activeVaultId после закрытия = 0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("10. totalBurnedANCR после операций", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
        expect(await vault.totalBurnedANCR()).to.be.gt(0);
    });
});
