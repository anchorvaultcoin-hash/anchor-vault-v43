// test/26-panic.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers-v44");

describe("AnchorVaultV44 — Panic Withdraw", function () {
    describe("Успешные сценарии", function () {
        it("1. базовый panic — 20% штраф, на globalEmergency", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = await ancr.balanceOf(frank.address);
            await vault.connect(alice).panicWithdraw(1);
            const after = await ancr.balanceOf(frank.address);
            expect(after - before).to.be.gt(0);
        });

        it("2. событие PanicWithdraw", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await expect(vault.connect(alice).panicWithdraw(1))
                .to.emit(vault, "PanicWithdraw");
        });

        it("3. v.status = 2 после panic", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).panicWithdraw(1);
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.status).to.equal(2);
        });

        it("4. activeVaultIdByToken очищен", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).panicWithdraw(1);
            expect(await vault.activeVaultIdByToken(alice.address, await ancr.getAddress())).to.equal(0);
        });

        it("5. v.amount = 0", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).panicWithdraw(1);
            expect((await vault.getVaultCore(alice.address, 1)).amount).to.equal(0);
        });

        it("6. lockedPrincipal уменьшен", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = await vault.lockedPrincipal(await ancr.getAddress());
            await vault.connect(alice).panicWithdraw(1);
            expect(await vault.lockedPrincipal(await ancr.getAddress())).to.be.lt(before);
        });

        it("7. PenaltyDistributed", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await expect(vault.connect(alice).panicWithdraw(1))
                .to.emit(vault, "PenaltyDistributed");
        });

        it("8. Работает даже при voluntaryLockUntil > now (СПАСАТЕЛЬНАЯ КНОПКА)", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const future = Math.floor(Date.now() / 1000) + 86400 * 30;
            await vault.connect(alice).setVoluntaryLock(1, future, P.code);
            await vault.connect(alice).panicWithdraw(1);
            expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(2);
        });

        it("9. Работает после неудачных попыток", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("300") });
            for (let i = 0; i < 5; i++) {
                await time.increase(61);
                try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
            }
            await vault.connect(alice).panicWithdraw(1);
            expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(2);
        });
    });

    describe("Реверты", function () {
        it("10. revert BadVaultId на несуществующий vault", async function () {
            const { vault, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await expect(vault.connect(alice).panicWithdraw(99))
                .to.be.revertedWithCustomError(vault, "BadVaultId");
        });

        it("11. revert NotActive если vault уже закрыт", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).panicWithdraw(1);
            await expect(vault.connect(alice).panicWithdraw(1))
                .to.be.revertedWithCustomError(vault, "NotActive");
        });
    });

    describe("Мульти-токен", function () {
        it("12. panic ANCR-сейфа не влияет на FOT-сейф юзера", async function () {
            const { vault, ancr, fot, alice, frank, creator } = await loadFixture(deployFixture);
            await vault.connect(creator).addSupportedToken(await fot.getAddress());
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
            await vault.connect(alice).panicWithdraw(1);
            expect((await vault.getVaultCore(alice.address, 2)).status).to.equal(0);
        });

        it("13. После panic ANCR можно открыть новый ANCR-сейф", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).panicWithdraw(1);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
            expect(await vault.activeVaultIdByToken(alice.address, await ancr.getAddress())).to.equal(2);
        });
    });
});
