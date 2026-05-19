const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture } = require("./helpers");

describe("AnchorVaultV43 — defenseETH", function () {
    it("1. receive() ревертит", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        const signer = await ethers.getSigner(alice.address);
        await expect(signer.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("1") }))
            .to.be.revertedWithCustomError(vault, "DirectTransferForbidden");
    });
    it("2. fallback() ревертит", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        const signer = await ethers.getSigner(alice.address);
        await expect(signer.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("1"), data: "0x12345678" }))
            .to.be.revertedWithCustomError(vault, "DirectTransferForbidden");
    });
    it("3. баланс ETH = 0", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
    });
});
