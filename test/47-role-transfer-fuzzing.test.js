const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Role Transfer Fuzzing", function () {
    it("1. transferCreatorship → cancel (переопределить)", async function () {
        const { vault, creator, alice, bob } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await vault.connect(creator).transferCreatorship(bob.address);
        expect(await vault.pendingCreator()).to.equal(bob.address);
    });
    it("2. acceptCreatorship до cooldown ревертит", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await expect(vault.connect(alice).acceptCreatorship()).to.be.revertedWithCustomError(vault, "CooldownNotExpired");
    });
    it("3. acceptGuardianship до cooldown ревертит", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferGuardianship(alice.address);
        await expect(vault.connect(alice).acceptGuardianship()).to.be.revertedWithCustomError(vault, "CooldownNotExpired");
    });
    it("4. transferCreatorship → accept → transfer ещё раз", async function () {
        const { vault, creator, alice, bob } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        await vault.connect(alice).transferCreatorship(bob.address);
        expect(await vault.pendingCreator()).to.equal(bob.address);
    });
    it("5. старый creator не может unpause после смены", async function () {
        const { vault, creator, alice, guardian } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(creator).unpause()).to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("6. новый creator может всё", async function () {
        const { vault, ancr, alice, creator, frank } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        await vault.connect(alice).addSupportedToken(await ancr.getAddress());
        await vault.connect(alice).setWelcomeBonus(ethers.parseEther("0.001"));
        await vault.connect(alice).transferGuardianship(frank.address);
    });
    it("7. transferGuardianship на нулевой адрес ревертит", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).transferGuardianship(ethers.ZeroAddress)).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
    it("8. transferCreatorship на себя ревертит", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).transferCreatorship(creator.address)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
    it("9. transferGuardianship на creator ревертит", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).transferGuardianship(creator.address)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
    it("10. двойной acceptCreatorship ревертит", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        await expect(vault.connect(alice).acceptCreatorship()).to.be.revertedWithCustomError(vault, "NotPendingRole");
    });
});
