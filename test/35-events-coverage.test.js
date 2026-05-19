const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Events Coverage", function () {
    it("1. TokenSupported при addSupportedToken", async function () {
        const { vault, fot, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).addSupportedToken(await fot.getAddress())).to.emit(vault, "TokenSupported");
    });

    it("2. TokenUnsupported при removeSupportedToken", async function () {
        const { vault, fot, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await expect(vault.connect(creator).removeSupportedToken(await fot.getAddress())).to.emit(vault, "TokenUnsupported");
    });

    it("3. WelcomeBonusChanged при setWelcomeBonus", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.002"))).to.emit(vault, "WelcomeBonusChanged");
    });

    it("4. RewardPoolDonated при donateToRewardPool", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("5"));
        await expect(vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("5"))).to.emit(vault, "RewardPoolDonated");
    });

    it("5. CreatorshipTransferRequested", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).transferCreatorship(alice.address)).to.emit(vault, "CreatorshipTransferRequested");
    });

    it("6. CreatorshipAccepted", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await expect(vault.connect(alice).acceptCreatorship()).to.emit(vault, "CreatorshipAccepted");
    });

    it("7. GuardianshipTransferRequested", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).transferGuardianship(alice.address)).to.emit(vault, "GuardianshipTransferRequested");
    });

    it("8. GuardianshipAccepted", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferGuardianship(alice.address);
        await time.increase(2 * 24 * 3600 + 1);
        await expect(vault.connect(alice).acceptGuardianship()).to.emit(vault, "GuardianshipAccepted");
    });

    it("9. PauseRequested + PauseRequestCancelled", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await expect(vault.connect(guardian).requestPause()).to.emit(vault, "PauseRequested");
        await expect(vault.connect(guardian).cancelPauseRequest()).to.emit(vault, "PauseRequestCancelled");
    });

    it("10. CreatorWithdrawn + ReserveWithdrawn", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const fee = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), alice.address, fee);
        await time.increase(7 * 24 * 3600 + 1);
        await expect(vault.connect(creator).withdrawCreatorFees(await ancr.getAddress())).to.emit(vault, "CreatorWithdrawn");
        const reserve = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(creator).requestReserveWithdraw(await ancr.getAddress(), alice.address, reserve);
        await time.increase(7 * 24 * 3600 + 1);
        await expect(vault.connect(creator).withdrawStrategicReserve(await ancr.getAddress())).to.emit(vault, "ReserveWithdrawn");
    });
});
