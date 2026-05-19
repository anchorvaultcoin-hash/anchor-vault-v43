// test/49-welcome-bonus-fuzzing.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Welcome Bonus Fuzzing", function () {
    it("1. welcomeBonus = 0.005 (MAX) проходит", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.005"));
        expect(await vault.welcomeBonus()).to.equal(ethers.parseEther("0.005"));
    });
    it("2. welcomeBonus > MAX ревертит", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.006"))).to.be.revertedWithCustomError(vault, "BonusExceedsLimit");
    });
    it("3. welcomeBonus выплачивается 10 разным адресам", async function () {
        const { vault, ancr, creator, guardian } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        const signers = await ethers.getSigners();
        for (let i = 10; i < 20; i++) {
            await ancr.transfer(signers[i].address, ethers.parseEther("1000"));
            await ancr.connect(signers[i]).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "W", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: guardian.address };
            await vault.connect(signers[i]).openVault(await ancr.getAddress(), params, 0);
            expect(await vault.welcomeBonusClaimed(signers[i].address)).to.equal(true);
        }
    });
    it("4. после donate bonus выплачивается", async function () {
        const { vault, ancr, alice, bob, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(bob.address)).to.equal(true);
    });
    it("5. welcomeBonusClaimed не сбрасывается после второго сейфа", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
    });
    it("6. setWelcomeBonus(0) выключает бонус", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.003"));
        await vault.connect(creator).setWelcomeBonus(0);
        expect(await vault.welcomeBonus()).to.equal(0);
    });
    it("7. bonus не выплачивается если bonus=0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(false);
    });
    it("8. WelcomeBonusPaid событие при выплате", async function () {
        const { vault, ancr, alice, creator, frank } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        const params = { name: "W", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "WelcomeBonusPaid");
    });
    it("10. WelcomeBonusChanged событие", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.002"))).to.emit(vault, "WelcomeBonusChanged");
    });
});
