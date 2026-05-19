const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — reserveWithdraw", function () {
    it("1. requestReserveWithdraw только creator", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const reserve = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(creator).requestReserveWithdraw(await ancr.getAddress(), alice.address, reserve);
        expect(await vault.reserveWithdrawalUnlock(await ancr.getAddress())).to.be.gt(0);
    });
    it("2. NotCreator ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).requestReserveWithdraw(await ancr.getAddress(), alice.address, ethers.parseEther("1")))
            .to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("3. withdrawReserve успех через 7 дней", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const reserve = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(creator).requestReserveWithdraw(await ancr.getAddress(), alice.address, reserve);
        await time.increase(7 * 24 * 3600 + 1);
        await expect(vault.connect(creator).withdrawStrategicReserve(await ancr.getAddress()))
            .to.emit(vault, "ReserveWithdrawn");
    });
    it("4. cancelReserveWithdraw работает", async function () {
        const { vault, ancr, creator, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const reserve = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(creator).requestReserveWithdraw(await ancr.getAddress(), alice.address, reserve);
        await vault.connect(creator).cancelReserveWithdraw(await ancr.getAddress());
        expect(await vault.reserveWithdrawalUnlock(await ancr.getAddress())).to.equal(0);
    });
});
