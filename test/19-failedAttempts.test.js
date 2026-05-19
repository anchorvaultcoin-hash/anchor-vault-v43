const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — failedAttempts", function () {
    it("1. failCount растёт при wrong коде", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
    });
    it("2. WrongCodeAttempt событие", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await time.increase(61);
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase))
            .to.emit(vault, "WrongCodeAttempt");
    });
    it("3. SOFT_LOCK после 5 попыток", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        const t = await vault.getVaultTimings(alice.address, 1);
        expect(t.lockedUntil).to.be.gt(0);
    });
it("4. HARD_LOCK после 30 попыток", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
    for (let i = 0; i < 30; i++) {
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
    }
    const t = await vault.getVaultTimings(alice.address, 1);
    const now = BigInt(Math.floor(Date.now() / 1000));
    expect(t.lockedUntil).to.be.gt(now);
});
    it("5. TooManyAttempts без интервала", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong2", P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "TooManyAttempts");
    });
    it("6. правильный код сбрасывает failCount", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(0);
    });
    it("7. totalFailedAttempts растёт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 3; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        expect(await vault.totalFailedAttempts(alice.address)).to.equal(3);
    });
it("8. Locked блокирует после SOFT_LOCK", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    for (let i = 0; i < 5; i++) {
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
    }
    await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase))
        .to.be.revertedWithCustomError(vault, "Locked");
});
    it("9. фейлы alice не влияют на bob", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        expect((await vault.getVaultSecurity(bob.address, 1)).failCount).to.equal(0);
    });
    it("10. resetFailedAttempts после 30 дней", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(30 * 24 * 3600 + 1);
        await vault.connect(alice).resetFailedAttempts();
        expect(await vault.totalFailedAttempts(alice.address)).to.equal(0);
    });
    it("11. totalFailedAttempts = 5 после 5 неверных попыток", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("300") });
    for (let i = 0; i < 5; i++) {
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
    }
    expect(await vault.totalFailedAttempts(alice.address)).to.equal(5);
});
    it("12. WrongCodeAttempt событие при каждом неверном коде", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await time.increase(61);
        await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), "wrong!!"))
            .to.emit(vault, "WrongCodeAttempt");
    });
    it("13. failCount сбрасывается rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(0);
    });
    it("14. totalFailedAttempts = 5 после 5 неверных попыток", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        expect(await vault.totalFailedAttempts(alice.address)).to.equal(5);
    });
    it("15. FailedAttempt событие при SOFT_LOCK", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 4; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(61);
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase))
            .to.emit(vault, "FailedAttempt");
    });});

