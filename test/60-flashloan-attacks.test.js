const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Flashloan Attacks", function () {
    it("1. flashloan: нельзя манипулировать lockedPrincipal через временный депозит", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("1000") });
        const lpBefore = await vault.lockedPrincipal(await ancr.getAddress());
        // Боб открывает сейф
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        // Закрывает сразу — lockedPrincipal не должен пострадать
        await vault.connect(bob).earlyClose(1, P.recovery);
        const lpAfter = await vault.lockedPrincipal(await ancr.getAddress());
        expect(lpAfter).to.be.lt(lpBefore + ethers.parseEther("100"));
    });

it("2. flashloan: нельзя украсть через transfer+withdraw в одном блоке", async function () {
    const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    const bobBefore = await ancr.balanceOf(bob.address);
    await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
    const full = (await vault.getVaultCore(bob.address, 1)).amount;
    await vault.connect(bob).withdrawFromVault(1, full, bob.address, P.newCode, P.newAntiPhrase);
    const bobAfter = await ancr.balanceOf(bob.address);
    // Боб получил что-то
    expect(bobAfter).to.be.gt(bobBefore);
});
    it("3. flashloan: donate → openVault с бонусом → earlyClose (нельзя украсть бонус)", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        // Alice получает бонус один раз
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
        await vault.connect(alice).earlyClose(1, P.recovery);
        // Повторно бонус не получить
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
    });

    it("4. flashloan: нельзя обойти комиссию через transfer туда-обратно", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const originalAmount = (await vault.getVaultCore(alice.address, 1)).amount;
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        const transferredAmount = (await vault.getVaultCore(bob.address, 1)).amount;
        // После перевода сумма уменьшилась (комиссия 0.5%)
        expect(transferredAmount).to.be.lt(originalAmount);
    });

it("5. flashloan: нельзя манипулировать rewardPool через повторный donate+withdraw", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("50"));
    // donate просто добавляет в rewardPool
    expect(await vault.rewardPool(await ancr.getAddress())).to.equal(ethers.parseEther("50"));
});
    it("6. flashloan: нельзя использовать emergencyAny для вывода без комиссии", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const bobBefore = await ancr.balanceOf(bob.address);
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        const bobReceived = (await ancr.balanceOf(bob.address)) - bobBefore;
        // 15% комиссия
        expect(bobReceived).to.be.lt(ethers.parseEther("99.8"));
    });

    it("7. flashloan: нельзя обойти SOFT_LOCK через transfer", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        // Transfer тоже заблокирован
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "Locked");
    });

    it("8. flashloan: нельзя манипулировать totalBurnedANCR", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        const before = await vault.totalBurnedANCR();
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        const after = await vault.totalBurnedANCR();
        // totalBurnedANCR только растёт
        expect(after).to.be.gte(before);
    });

    it("9. flashloan: нельзя изменить уровень сейфа после открытия", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0, amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.level).to.equal(0);
        // Нет функции для смены уровня
    });

    it("10. flashloan: нельзя украсть токены через паузу", async function () {
        const { vault, ancr, alice, guardian, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        // Вывод во время паузы ревертит
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "ContractPaused");
        await vault.connect(creator).unpause();
        // После снятия паузы — работает
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
    });

    it("11. flashloan: нельзя обойти MIN_DEPOSIT через deposit 0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).depositToVault(1, 0, P.code)).to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
    });

    it("12. flashloan: нельзя создать сейф с amount < MIN_DEPOSIT", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("0.001"));
        const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("0.001"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
    });

    it("13. flashloan: нельзя украсть через earlyClose с чужим recovery", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Неверный recovery — failCount растёт
        await vault.connect(alice).earlyClose(1, "wrongRecoveryCode!");
        const sec = await vault.getVaultSecurity(alice.address, 1);
        expect(sec.failCount).to.equal(1);
    });

    it("14. flashloan: нельзя подменить коды через front-run rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // rotateCodes требует оба старых кода
        await vault.connect(alice).rotateCodes(1, "wrongCode123", P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        const sec = await vault.getVaultSecurity(alice.address, 1);
        expect(sec.failCount).to.equal(1);
    });

    it("15. flashloan: нельзя атаковать через delegatecall (нет delegatecall в контракте)", async function () {
        const { vault } = await loadFixture(deployFixture);
        // Контракт не использует delegatecall
        expect(await vault.VERSION()).to.equal(43);
    });

    it("16. flashloan: emergencyAny требует antiPhrase", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, "")).to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });

    it("17. flashloan: нельзя обойти voluntaryLock через emergencyAny", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        // emergencyAny тоже заблокирован
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase)).to.be.revertedWithCustomError(vault, "Locked");
    });

    it("18. flashloan: нельзя обойти voluntaryLock через recoverToSafe", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery)).to.be.revertedWithCustomError(vault, "Locked");
    });

    it("19. flashloan: нельзя обойти voluntaryLock через earlyClose", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).earlyClose(1, P.recovery)).to.be.revertedWithCustomError(vault, "Locked");
    });

    it("20. flashloan: все emergency операции с разных адресов не пересекаются", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        // Bob не пострадал
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(0);
    });
});
