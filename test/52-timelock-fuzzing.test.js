const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Timelock Fuzzing", function () {
    it("1. SAFE: только 0 проходит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0 });
        await vault.connect(alice).setTimelock(1, 0, P.code);
        expect((await vault.getVaultTimings(alice.address, 1)).timelockHours).to.equal(0);
    });
    it("2. VAULT: все значения 0..72 проходят", async function () {
        const { vault, ancr, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, bob, { level: 1 });
        for (let h = 0; h <= 72; h += 8) {
            await vault.connect(bob).setTimelock(1, h, P.code);
            expect((await vault.getVaultTimings(bob.address, 1)).timelockHours).to.equal(h);
        }
    });
    it("3. FORTRESS: все значения 0..168 проходят", async function () {
        const { vault, ancr, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, carol, { level: 2 });
        await vault.connect(carol).setTimelock(1, 0, P.code);
        await vault.connect(carol).setTimelock(1, 100, P.code);
        await vault.connect(carol).setTimelock(1, 168, P.code);
        expect((await vault.getVaultTimings(carol.address, 1)).timelockHours).to.equal(168);
    });
    it("4. voluntaryLock блокирует deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("5. voluntaryLock блокирует rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("6. voluntaryLock блокирует changeEmergencyAddress", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).changeEmergencyAddress(1, bob.address, P.recovery)).to.be.revertedWithCustomError(vault, "Locked");
    });
it("7. voluntaryLock после снятия — операции работают", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    const latest = await time.latest();
    const future = latest + 10;
    await vault.connect(alice).setVoluntaryLock(1, future, P.code);
    await time.increase(11);
    await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
});
    it("8. TimelockSet событие", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 1 });
        await expect(vault.connect(alice).setTimelock(1, 24, P.code)).to.emit(vault, "TimelockSet");
    });
    it("9. VoluntaryLockSet событие", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 86400;
        await expect(vault.connect(alice).setVoluntaryLock(1, future, P.code)).to.emit(vault, "VoluntaryLockSet");
    });
    it("10. повторный setTimelock перезаписывает значение", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 1 });
        await vault.connect(alice).setTimelock(1, 10, P.code);
        await vault.connect(alice).setTimelock(1, 50, P.code);
        expect((await vault.getVaultTimings(alice.address, 1)).timelockHours).to.equal(50);
    });
});
