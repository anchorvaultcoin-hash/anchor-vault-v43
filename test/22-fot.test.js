const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — FOT", function () {
    it("1. openVault с FOT после добавления", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        expect((await vault.getVaultCore(alice.address, 1)).token).to.equal(await fot.getAddress());
    });
    it("2. deposit FOT работает", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("100"), P.code);
    });
    it("3. withdraw FOT работает", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
    });
    it("4. donate FOT работает", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).donateToRewardPool(await fot.getAddress(), ethers.parseEther("50"));
    });
    it("5. transfer FOT работает", async function () {
        const { vault, fot, alice, bob, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultCore(bob.address, 1)).token).to.equal(await fot.getAddress());
    });
});
