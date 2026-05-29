const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers-v44");

describe("V44 — Secure Transfer: Confirm", function () {
    it("1. confirm передаёт сейф получателю", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await vault.connect(bob).confirmSecureTransfer(1, P.confirm);
        expect(await vault.activeVaultIdByToken(bob.address, await ancr.getAddress())).to.equal(1);
    });

    it("2. событие SecureTransferConfirmed", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await expect(vault.connect(bob).confirmSecureTransfer(1, P.confirm))
            .to.emit(vault, "SecureTransferConfirmed");
    });

    it("3. неверный код → failCount++", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await vault.connect(bob).confirmSecureTransfer(1, "WrongCode1234");
        const st = await vault.getSecureTransfer(1);
        expect(st.failCount).to.equal(1);
    });

    it("4. 3 неверные попытки → EXPIRED", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        for (let i = 0; i < 3; i++) {
            if (i > 0) await time.increase(61);
            await vault.connect(bob).confirmSecureTransfer(1, "WrongCode1234");
        }
        const st = await vault.getSecureTransfer(1);
        expect(st.status).to.equal(3);
    });

    it("5. revert AttemptTooSoon", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await vault.connect(bob).confirmSecureTransfer(1, "WrongCode1234");
        await expect(vault.connect(bob).confirmSecureTransfer(1, "WrongCode1234"))
            .to.be.revertedWithCustomError(vault, "AttemptTooSoon");
    });

    it("6. revert TransferExpired после 48 часов", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await time.increase(48 * 3600 + 1);
        await expect(vault.connect(bob).confirmSecureTransfer(1, P.confirm))
            .to.be.revertedWithCustomError(vault, "TransferExpired");
    });
});
