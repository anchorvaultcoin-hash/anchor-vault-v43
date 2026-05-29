const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers-v44");

describe("V44 — Secure Transfer: Cancel/Reclaim", function () {
    it("1. отправитель отменяет → сейф ACTIVE", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await vault.connect(alice).cancelSecureTransfer(1);
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(0);
    });

    it("2. событие SecureTransferCancelled", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await expect(vault.connect(alice).cancelSecureTransfer(1))
            .to.emit(vault, "SecureTransferCancelled");
    });

    it("3. reclaimExpired через 48 часов", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await time.increase(48 * 3600 + 1);
        await vault.connect(alice).reclaimExpiredTransfer(1);
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(0);
    });

    it("4. revert NotTransferSender если не отправитель", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await expect(vault.connect(bob).cancelSecureTransfer(1))
            .to.be.revertedWithCustomError(vault, "NotTransferSender");
    });

    it("5. revert TransferStillValid если раньше 48 часов", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await expect(vault.connect(alice).reclaimExpiredTransfer(1))
            .to.be.revertedWithCustomError(vault, "TransferStillValid");
    });
});
