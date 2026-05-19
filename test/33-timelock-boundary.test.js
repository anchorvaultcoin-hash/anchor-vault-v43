const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Timelock Boundary", function () {
    it("1. SAFE max timelock = 0", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getMaxTimelockForLevel(0)).to.equal(0);
    });

    it("2. VAULT max timelock = 72", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getMaxTimelockForLevel(1)).to.equal(72);
    });

    it("3. FORTRESS max timelock = 168", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.getMaxTimelockForLevel(2)).to.equal(168);
    });

    it("4. VAULT: 72 часа проходит", async function () {
        const { vault, ancr, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, bob, { level: 1 });
        await vault.connect(bob).setTimelock(1, 72, P.code);
        expect((await vault.getVaultTimings(bob.address, 1)).timelockHours).to.equal(72);
    });

    it("5. VAULT: 73 часа ревертит", async function () {
        const { vault, ancr, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, bob, { level: 1 });
        await expect(vault.connect(bob).setTimelock(1, 73, P.code)).to.be.revertedWithCustomError(vault, "TimelockTooLong");
    });

    it("6. FORTRESS: 168 часов проходит", async function () {
        const { vault, ancr, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, carol, { level: 2 });
        await vault.connect(carol).setTimelock(1, 168, P.code);
        expect((await vault.getVaultTimings(carol.address, 1)).timelockHours).to.equal(168);
    });

    it("7. FORTRESS: 169 часов ревертит", async function () {
        const { vault, ancr, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, carol, { level: 2 });
        await expect(vault.connect(carol).setTimelock(1, 169, P.code)).to.be.revertedWithCustomError(vault, "TimelockTooLong");
    });

it("8. voluntaryLock ровно через 1 минуту проходит", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice);
    const ts = Math.floor(Date.now() / 1000) + 60;
    await vault.connect(alice).setVoluntaryLock(1, ts, P.code);
});
    it("9. voluntaryLock ровно MAX (5 лет) проходит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const ts = Math.floor(Date.now() / 1000) + 5 * 365 * 86400;
        await vault.connect(alice).setVoluntaryLock(1, ts, P.code);
    });

it("10. voluntaryLock > 5 лет ревертит", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice);
    const ts = Math.floor(Date.now() / 1000) + 5 * 365 * 86400 + 86400;
    await expect(vault.connect(alice).setVoluntaryLock(1, ts, P.code)).to.be.revertedWithCustomError(vault, "LockTooLong");
});
});
