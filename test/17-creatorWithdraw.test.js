const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — creatorWithdraw", function () {
    it("1. requestCreatorWithdraw только creator", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        // Зарабатываем creatorFees через депозит alice
        await openSafe(vault, ancr, alice, { level: 0, amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);

        const fee = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), alice.address, fee);
        expect(await vault.creatorWithdrawalUnlock(await ancr.getAddress())).to.be.gt(0);
    });
    it("2. NotCreator ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).requestCreatorWithdraw(await ancr.getAddress(), alice.address, ethers.parseEther("1")))
            .to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("3. ZeroAddress to ревертит", async function () {
        const { vault, ancr, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), ethers.ZeroAddress, ethers.parseEther("1")))
            .to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
    it("4. InvalidAmount (0) ревертит", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), alice.address, 0))
            .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
    it("5. withdrawCreatorFees успех через 7 дней", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0, amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);

        const fee = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), alice.address, fee);
        await time.increase(7 * 24 * 3600 + 1);
        await expect(vault.connect(creator).withdrawCreatorFees(await ancr.getAddress()))
            .to.emit(vault, "CreatorWithdrawn");
    });
    it("6. cancelCreatorWithdraw работает", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0, amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);

        const fee = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), alice.address, fee);
        await vault.connect(creator).cancelCreatorWithdraw(await ancr.getAddress());
        expect(await vault.creatorWithdrawalUnlock(await ancr.getAddress())).to.equal(0);
    });
});
