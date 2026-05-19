const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — setTimelock / setVoluntaryLock", function () {
    describe("setTimelock", function () {
        it("1. SAFE: 0 часов проходит", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { level: 0 });
            await vault.connect(alice).setTimelock(1, 0, P.code);
            expect((await vault.getVaultTimings(alice.address, 1)).timelockHours).to.equal(0);
        });
        it("2. VAULT: 24 часа проходит", async function () {
            const { vault, ancr, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, bob, { level: 1 });
            await vault.connect(bob).setTimelock(1, 24, P.code);
            expect((await vault.getVaultTimings(bob.address, 1)).timelockHours).to.equal(24);
        });
        it("3. FORTRESS: 100 часов проходит", async function () {
            const { vault, ancr, carol } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, carol, { level: 2 });
            await vault.connect(carol).setTimelock(1, 100, P.code);
            expect((await vault.getVaultTimings(carol.address, 1)).timelockHours).to.equal(100);
        });
        it("4. TimelockTooLong для SAFE (1 час)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { level: 0 });
            await expect(vault.connect(alice).setTimelock(1, 1, P.code))
                .to.be.revertedWithCustomError(vault, "TimelockTooLong");
        });
        it("5. TimelockTooLong для VAULT (73 часа)", async function () {
            const { vault, ancr, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, bob, { level: 1 });
            await expect(vault.connect(bob).setTimelock(1, 73, P.code))
                .to.be.revertedWithCustomError(vault, "TimelockTooLong");
        });
        it("6. TimelockTooLong для FORTRESS (169 часов)", async function () {
            const { vault, ancr, carol } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, carol, { level: 2 });
            await expect(vault.connect(carol).setTimelock(1, 169, P.code))
                .to.be.revertedWithCustomError(vault, "TimelockTooLong");
        });
        it("7. WrongCode не меняет timelock", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { level: 1 });
            await vault.connect(alice).setTimelock(1, 10, "wrongcode!!");
            expect((await vault.getVaultTimings(alice.address, 1)).timelockHours).to.equal(0);
        });
    });
    describe("setVoluntaryLock", function () {
        it("8. установка лока на 1 день", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const future = Math.floor(Date.now() / 1000) + 86400;
            await vault.connect(alice).setVoluntaryLock(1, future, P.code);
            expect((await vault.getVaultTimings(alice.address, 1)).voluntaryLockUntil).to.equal(future);
        });
        it("9. LockTooLong (> 5 лет)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const tooFar = Math.floor(Date.now() / 1000) + 6 * 365 * 86400;
            await expect(vault.connect(alice).setVoluntaryLock(1, tooFar, P.code))
                .to.be.revertedWithCustomError(vault, "LockTooLong");
        });
        it("10. InvalidAmount (<= now)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await expect(vault.connect(alice).setVoluntaryLock(1, Math.floor(Date.now() / 1000) - 100, P.code))
                .to.be.revertedWithCustomError(vault, "InvalidAmount");
        });
        it("11. Lock блокирует вывод", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const future = Math.floor(Date.now() / 1000) + 3600;
            await vault.connect(alice).setVoluntaryLock(1, future, P.code);
            await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase))
                .to.be.revertedWithCustomError(vault, "Locked");
        });
    });
    describe("Дополнительные", function () {
        it("12. voluntaryLock блокирует earlyClose", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const future = Math.floor(Date.now() / 1000) + 3600;
            await vault.connect(alice).setVoluntaryLock(1, future, P.code);
            await expect(vault.connect(alice).earlyClose(1, P.recovery))
                .to.be.revertedWithCustomError(vault, "Locked");
        });
    });    it("13. timelock можно изменить на 0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 1 });
        await vault.connect(alice).setTimelock(1, 10, P.code);
        await vault.connect(alice).setTimelock(1, 0, P.code);
        expect((await vault.getVaultTimings(alice.address, 1)).timelockHours).to.equal(0);
    });
    it("14. voluntaryLock блокирует transfer", async function () {
    const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    const future = Math.floor(Date.now() / 1000) + 3600;
    await vault.connect(alice).setVoluntaryLock(1, future, P.code);
    await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
        newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
    })).to.be.revertedWithCustomError(vault, "Locked");
});
    it("12. voluntaryLock блокирует earlyClose", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).earlyClose(1, P.recovery)).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("13. timelock можно изменить на 0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 1 });
        await vault.connect(alice).setTimelock(1, 10, P.code);
        await vault.connect(alice).setTimelock(1, 0, P.code);
        expect((await vault.getVaultTimings(alice.address, 1)).timelockHours).to.equal(0);
    });
    it("14. voluntaryLock блокирует transfer", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("15. TimelockSet событие", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 1 });
        await expect(vault.connect(alice).setTimelock(1, 24, P.code)).to.emit(vault, "TimelockSet");
    });
});
