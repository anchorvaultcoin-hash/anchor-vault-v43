const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Fuzzing", function () {
    it("1. случайная последовательность: open-deposit-withdraw", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("30"), alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(0);
    });

    it("2. открыть-перевести-вывести у получателя", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.newCode, P.newAntiPhrase);
        expect((await vault.getVaultCore(bob.address, 1)).amount).to.be.lt(ethers.parseEther("99"));
    });

    it("3. депозит-закрыть-открыть новый-депозит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await vault.connect(alice).depositToVault(2, ethers.parseEther("100"), P.code);
        expect(await vault.userVaultCount(alice.address)).to.equal(2);
    });

    it("4. recoverToSafe после депозита", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });

    it("5. rotateCodes → депозит с новым кодом", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.newCode);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(ethers.parseEther("99.8"));
    });

    it("6. voluntaryLock → не можем вывести → снимаем лок → выводим", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lockUntil = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, lockUntil, P.code);
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "Locked");
        await time.increase(3601);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.lt(ethers.parseEther("99.8"));
    });

    it("7. два перевода подряд", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await vault.connect(bob).transferVault(1, carol.address, P.newCode, P.newAntiPhrase, {
            newCode: "CodeC1234567890", newAntiPhrase: "AntiC1234567890", newRecovery: "RecC12345678901"
        });
        expect(await vault.activeVaultId(carol.address)).to.equal(1);
    });

    it("8. пауза → операции ревертят → unpause → работают", async function () {
        const { vault, ancr, alice, guardian, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "ContractPaused");
        await vault.connect(creator).unpause();
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.lt(ethers.parseEther("99.8"));
    });

    it("9. welcomeBonus + deposit + withdraw", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.code, P.antiPhrase);
    });

    it("10. emergencyAny на разных адресах", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).emergencyWithdrawToAny(2, carol.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 2)).status).to.equal(1);
    });
});
