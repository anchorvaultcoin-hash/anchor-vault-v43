const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — donateToRewardPool", function () {
    it("1. донат ANCR работает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        const before = await vault.rewardPool(await ancr.getAddress());
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        expect(await vault.rewardPool(await ancr.getAddress())).to.equal(before + ethers.parseEther("10"));
    });
    it("2. событие RewardPoolDonated", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("5"));
        await expect(vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("5")))
            .to.emit(vault, "RewardPoolDonated");
    });
    it("3. TokenNotSupported", async function () {
        const { vault, fot, alice } = await loadFixture(deployFixture);
        await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("5"));
        await expect(vault.connect(alice).donateToRewardPool(await fot.getAddress(), ethers.parseEther("5")))
            .to.be.revertedWithCustomError(vault, "TokenNotSupported");
    });
    it("4. InvalidAmount (0)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).donateToRewardPool(await ancr.getAddress(), 0))
            .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
    it("5. донат от разных пользователей накапливается", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        await ancr.connect(bob).approve(await vault.getAddress(), ethers.parseEther("20"));
        await vault.connect(bob).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("20"));
        expect(await vault.rewardPool(await ancr.getAddress())).to.equal(ethers.parseEther("30"));
    });
    it("6. donateToRewardPool с FOT после добавления", async function () {
    const { vault, fot, alice, creator } = await loadFixture(deployFixture);
    await vault.connect(creator).addSupportedToken(await fot.getAddress());
    await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
    await vault.connect(alice).donateToRewardPool(await fot.getAddress(), ethers.parseEther("30"));
    const rp = await vault.rewardPool(await fot.getAddress());
    expect(rp).to.be.gt(0);
    expect(rp).to.be.lt(ethers.parseEther("30"));
});
});
