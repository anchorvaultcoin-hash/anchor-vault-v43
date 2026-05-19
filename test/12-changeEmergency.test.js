const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — changeEmergencyAddress", function () {
    it("1. смена emergencyAddress на bob", async function () {
        const { vault, ancr, alice, bob, frank } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { emergencyAddress: frank.address, amount: ethers.parseEther("100") });
        await vault.connect(alice).changeEmergencyAddress(1, bob.address, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).emergencyAddress).to.equal(bob.address);
    });
    it("2. событие EmergencyAddressChanged", async function () {
        const { vault, ancr, alice, bob, frank } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { emergencyAddress: frank.address, amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).changeEmergencyAddress(1, bob.address, P.recovery))
            .to.emit(vault, "EmergencyAddressChanged");
    });
    it("3. ZeroAddress ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).changeEmergencyAddress(1, ethers.ZeroAddress, P.recovery))
            .to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
    it("4. InvalidAddress = contract", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).changeEmergencyAddress(1, await vault.getAddress(), P.recovery))
            .to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
    it("5. BadVaultId", async function () {
        const { vault, alice, bob } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).changeEmergencyAddress(99, bob.address, P.recovery))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("6. WrongCode на recovery", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).changeEmergencyAddress(1, bob.address, "WrongRecovery12");
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
    });
    it("7. Locked (voluntaryLock)", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).changeEmergencyAddress(1, bob.address, P.recovery))
            .to.be.revertedWithCustomError(vault, "Locked");
    });
    it("8. ContractPaused ревертит", async function () {
        const { vault, ancr, alice, bob, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(alice).changeEmergencyAddress(1, bob.address, P.recovery))
            .to.be.revertedWithCustomError(vault, "ContractPaused");
    });
});
