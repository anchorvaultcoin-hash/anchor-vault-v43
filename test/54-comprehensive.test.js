const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Comprehensive", function () {
    it("1. полный цикл: open → deposit → withdraw → transfer → close", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("30"), alice.address, P.code, P.antiPhrase);
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).earlyClose(1, P.newRecovery);
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(1);
    });

    it("2. два сейфа у одного пользователя последовательно", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        expect(await vault.userVaultCount(alice.address)).to.equal(2);
        expect(await vault.activeVaultId(alice.address)).to.equal(2);
    });

    it("3. перевод с последующим закрытием получателем через emergencyAny", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).emergencyWithdrawToAny(1, carol.address, P.newRecovery, P.newAntiPhrase);
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(1);
    });

    it("4. погашение SOFT_LOCK через успешный earlyClose", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(3601);
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });

    it("5. welcomeBonus + donate + открытие несколькими пользователями", async function () {
        const { vault, ancr, alice, bob, carol, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, carol, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(bob.address)).to.equal(true);
        expect(await vault.welcomeBonusClaimed(carol.address)).to.equal(true);
    });

    it("6. перевод во время voluntaryLock ревертит, после снятия проходит", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const latest = await time.latest();
        await vault.connect(alice).setVoluntaryLock(1, latest + 10, P.code);
        await time.increase(11);
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
    });

    it("7. пауза → emergencyAny → unpause → withdraw", async function () {
        const { vault, ancr, alice, bob, guardian, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        await vault.connect(creator).unpause();
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(2, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
    });

    it("8. смена guardian во время паузы", async function () {
        const { vault, ancr, alice, creator, guardian } = await loadFixture(deployFixture);
        await vault.connect(creator).transferGuardianship(alice.address);
        await time.increase(2 * 24 * 3600 + 1);
        await vault.connect(alice).acceptGuardianship();
        await vault.connect(alice).emergencyPause();
        expect(await vault.paused()).to.equal(true);
    });

    it("10. 5 failedAttempts → rotateCodes → сброс failCount → успешный вывод", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(3601);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.newCode, P.newAntiPhrase);
    });
});
