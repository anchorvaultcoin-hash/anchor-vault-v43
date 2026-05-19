const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Soft/Hard Locks", function () {
    it("2. HARD_LOCK_THRESHOLD = 30", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.HARD_LOCK_THRESHOLD()).to.equal(30);
    });
    it("3. AUTO_EMERGENCY_THRESHOLD = 35", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.AUTO_EMERGENCY_THRESHOLD()).to.equal(35);
    });
    it("4. MAX_TOTAL_ATTEMPTS = 50", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MAX_TOTAL_ATTEMPTS()).to.equal(50);
    });
    it("5. SOFT_LOCK = 1 час", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        const t = await vault.getVaultTimings(alice.address, 1);
        expect(t.lockedUntil).to.be.gt(0);
    });
    it("6. SOFT_LOCK снимается через 1 час", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(3601);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("5"), alice.address, P.code, P.antiPhrase);
    });
it("7. HARD_LOCK = 7 дней", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
    for (let i = 0; i < 30; i++) {
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
    }
    const t = await vault.getVaultTimings(alice.address, 1);
    expect(t.lockedUntil).to.be.gt(0);
});    it("8. MIN_GLOBAL_ATTEMPT_INTERVAL = 60", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MIN_GLOBAL_ATTEMPT_INTERVAL()).to.equal(60);
    });
    it("9. TooManyAttempts при вызове без интервала", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong2", P.antiPhrase)).to.be.revertedWithCustomError(vault, "TooManyAttempts");
    });
    it("10. FAIL_COUNTER_RESET_PERIOD = 30 дней", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.FAIL_COUNTER_RESET_PERIOD()).to.equal(30 * 24 * 3600);
    });
});
