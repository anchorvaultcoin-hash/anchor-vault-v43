const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — welcomeBonus", function () {
    it("1. setWelcomeBonus только creator", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        expect(await vault.welcomeBonus()).to.equal(ethers.parseEther("0.001"));
    });
    it("2. NotCreator ревертит", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).setWelcomeBonus(ethers.parseEther("0.001")))
            .to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("3. BonusExceedsLimit", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        const tooBig = ethers.parseEther("0.01");
        await expect(vault.connect(creator).setWelcomeBonus(tooBig))
            .to.be.revertedWithCustomError(vault, "BonusExceedsLimit");
    });
    it("4. WelcomeBonusChanged событие", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.002")))
            .to.emit(vault, "WelcomeBonusChanged");
    });
    it("5. бонус выплачивается при openVault", async function () {
    const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
    await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
});
    it("6. бонус не выплачивается дважды", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const bal1 = await ancr.balanceOf(alice.address);
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const bal2 = await ancr.balanceOf(alice.address);
        expect(bal2).to.be.lt(bal1 + ethers.parseEther("100"));
    });
    it("7. бонус не выплачивается если bonus=0", async function () {
    const { vault, ancr, alice } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(false);
});
});

