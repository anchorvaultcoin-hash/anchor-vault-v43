// test/04-deposit.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — depositToVault", function () {

    describe("Успешные сценарии", function () {
        it("1. депозит в SAFE сейф увеличивает amount", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { level: 0 });
            const deposit = ethers.parseEther("50");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await vault.connect(alice).depositToVault(1, deposit, P.code);
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.amount).to.be.gt(ethers.parseEther("99"));
        });

        it("2. депозит в VAULT сейф увеличивает amount", async function () {
            const { vault, ancr, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, bob, { level: 1, amount: ethers.parseEther("200") });
            const deposit = ethers.parseEther("100");
            await ancr.connect(bob).approve(await vault.getAddress(), deposit);
            await vault.connect(bob).depositToVault(1, deposit, P.code);
            const core = await vault.getVaultCore(bob.address, 1);
            expect(core.amount).to.be.gt(ethers.parseEther("199"));
        });

        it("3. депозит в FORTRESS сейф увеличивает amount", async function () {
            const { vault, ancr, carol } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, carol, { level: 2, amount: ethers.parseEther("500") });
            const deposit = ethers.parseEther("200");
            await ancr.connect(carol).approve(await vault.getAddress(), deposit);
            await vault.connect(carol).depositToVault(1, deposit, P.code);
            const core = await vault.getVaultCore(carol.address, 1);
            expect(core.amount).to.be.gt(ethers.parseEther("499"));
        });

        it("4. lockedPrincipal растёт после депозита", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = await vault.lockedPrincipal(await ancr.getAddress());
            const deposit = ethers.parseEther("50");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await vault.connect(alice).depositToVault(1, deposit, P.code);
            const after = await vault.lockedPrincipal(await ancr.getAddress());
            expect(after).to.be.gt(before);
        });

        it("5. событие VaultDeposited", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const deposit = ethers.parseEther("20");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await expect(vault.connect(alice).depositToVault(1, deposit, P.code))
                .to.emit(vault, "VaultDeposited");
        });

        it("6. событие FeeCollected при депозите", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const deposit = ethers.parseEther("20");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await expect(vault.connect(alice).depositToVault(1, deposit, P.code))
                .to.emit(vault, "FeeCollected");
        });
    });

    describe("Реверты", function () {
        it("7. BadVaultId (несуществующий)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).depositToVault(99, ethers.parseEther("10"), P.code))
                .to.be.revertedWithCustomError(vault, "BadVaultId");
        });

        it("8. NotActive (закрытый сейф)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).earlyClose(1, P.recovery);
            const deposit = ethers.parseEther("10");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await expect(vault.connect(alice).depositToVault(1, deposit, P.code))
                .to.be.revertedWithCustomError(vault, "NotActive");
        });

        it("9. ContractPaused", async function () {
            const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await vault.connect(guardian).emergencyPause();
            const deposit = ethers.parseEther("10");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await expect(vault.connect(alice).depositToVault(1, deposit, P.code))
                .to.be.revertedWithCustomError(vault, "ContractPaused");
        });

        it("10. DepositBelowMinimum (слишком мало)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const tiny = ethers.parseEther("0.001");
            await ancr.connect(alice).approve(await vault.getAddress(), tiny);
            await expect(vault.connect(alice).depositToVault(1, tiny, P.code))
                .to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
        });

        it("11. депозит в чужой сейф ревертит BadVaultId", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
            const deposit = ethers.parseEther("10");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await expect(vault.connect(alice).depositToVault(1, deposit, P.code))
                .to.be.revertedWithCustomError(vault, "BadVaultId");
        });

        it("12. Locked (voluntaryLockUntil)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const future = Math.floor(Date.now() / 1000) + 3600;
            await vault.connect(alice).setVoluntaryLock(1, future, P.code);
            const deposit = ethers.parseEther("10");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await expect(vault.connect(alice).depositToVault(1, deposit, P.code))
                .to.be.revertedWithCustomError(vault, "Locked");
        });

        it("13. 0 amount ревертит DepositBelowMinimum", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await expect(vault.connect(alice).depositToVault(1, 0, P.code))
                .to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
        });
    });

    describe("Wrong code", function () {
        it("14. неверный код — amount не меняется", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = (await vault.getVaultCore(alice.address, 1)).amount;
            await vault.connect(alice).depositToVault(1, ethers.parseEther("10"), "wrongcode!!");
            const after = (await vault.getVaultCore(alice.address, 1)).amount;
            expect(after).to.equal(before);
        });

        it("15. WrongCodeAttempt событие при неверном коде", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), "wrongcode!!"))
                .to.emit(vault, "WrongCodeAttempt");
        });
    });

    describe("Изоляция пользователей", function () {
        it("16. депозит alice не влияет на сейф bob", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
            const deposit = ethers.parseEther("50");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            await vault.connect(alice).depositToVault(1, deposit, P.code);
            const coreBob = await vault.getVaultCore(bob.address, 1);
            expect(coreBob.amount).to.equal(ethers.parseEther("199.6"));
        });
    });
    it("17. два депозита подряд увеличивают amount", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = (await vault.getVaultCore(alice.address, 1)).amount;
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("40"), P.code);
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(before);
    });
    it("18. депозит после rotateCodes с новым кодом", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("40"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("40"), P.newCode);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(ethers.parseEther("99.8"));
    });
});

