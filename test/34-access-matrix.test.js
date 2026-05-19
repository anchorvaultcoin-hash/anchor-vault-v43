const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Access Matrix", function () {
    it("1. только creator может addSupportedToken", async function () {
        const { vault, fot, creator, guardian, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await expect(vault.connect(guardian).addSupportedToken(await fot.getAddress())).to.be.revertedWithCustomError(vault, "NotCreator");
        await expect(vault.connect(alice).addSupportedToken(await fot.getAddress())).to.be.revertedWithCustomError(vault, "NotCreator");
    });

    it("2. только guardian может emergencyPause", async function () {
        const { vault, guardian, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(alice).emergencyPause()).to.be.revertedWithCustomError(vault, "NotGuardian");
        await expect(vault.connect(creator).emergencyPause()).to.be.revertedWithCustomError(vault, "NotGuardian");
    });

    it("3. только владелец может withdraw из своего сейфа", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        await expect(vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });

    it("4. только creator может setWelcomeBonus", async function () {
        const { vault, creator, guardian } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await expect(vault.connect(guardian).setWelcomeBonus(ethers.parseEther("0.001"))).to.be.revertedWithCustomError(vault, "NotCreator");
    });

    it("5. только pendingCreator может acceptCreatorship", async function () {
        const { vault, creator, alice, bob } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await expect(vault.connect(bob).acceptCreatorship()).to.be.revertedWithCustomError(vault, "NotPendingRole");
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        expect(await vault.creator()).to.equal(alice.address);
    });

    it("6. только pendingGuardian может acceptGuardianship", async function () {
        const { vault, creator, alice, bob } = await loadFixture(deployFixture);
        await vault.connect(creator).transferGuardianship(alice.address);
        await expect(vault.connect(bob).acceptGuardianship()).to.be.revertedWithCustomError(vault, "NotPendingRole");
        await time.increase(2 * 24 * 3600 + 1);
        await vault.connect(alice).acceptGuardianship();
        expect(await vault.guardian()).to.equal(alice.address);
    });

    it("7. никто не может удалить ANCR из supportedTokens", async function () {
        const { vault, ancr, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).removeSupportedToken(await ancr.getAddress())).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("8. любой может donateToRewardPool на supported токен", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("5"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("5"));
        await ancr.connect(bob).approve(await vault.getAddress(), ethers.parseEther("5"));
        await vault.connect(bob).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("5"));
        expect(await vault.rewardPool(await ancr.getAddress())).to.equal(ethers.parseEther("10"));
    });

    it("9. только creator может unpause", async function () {
        const { vault, guardian, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(alice).unpause()).to.be.revertedWithCustomError(vault, "NotCreator");
        await vault.connect(creator).unpause();
        expect(await vault.paused()).to.equal(false);
    });

    it("10. только creator может requestCreatorWithdraw", async function () {
        const { vault, ancr, alice, creator, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const fee = await vault.creatorFees(await ancr.getAddress());
        await expect(vault.connect(guardian).requestCreatorWithdraw(await ancr.getAddress(), guardian.address, fee)).to.be.revertedWithCustomError(vault, "NotCreator");
        await vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), creator.address, fee);
        expect(await vault.creatorWithdrawalUnlock(await ancr.getAddress())).to.be.gt(0);
    });
});
