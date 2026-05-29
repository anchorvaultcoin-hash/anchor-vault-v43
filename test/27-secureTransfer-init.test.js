const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers-v44");

describe("V44 — Secure Transfer: Init", function () {
    it("1. initSecureTransfer создаёт pending transfer", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        const st = await vault.getSecureTransfer(1);
        expect(st.status).to.equal(0);
    });

    it("2. Vault получает status = 1 (FROZEN_FOR_TRANSFER)", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(1);
    });

    it("3. событие SecureTransferInitiated", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery))
            .to.emit(vault, "SecureTransferInitiated");
    });

    it("4. revert NoEmergencySet у получателя", async function () {
        const { vault, ancr, alice, bob, frank } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery))
            .to.be.revertedWithCustomError(vault, "NoEmergencySet");
    });

    it("5. revert WeakCode на короткий confirmCode", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.weak, P.newCode, P.newAntiPhrase, P.newRecovery))
            .to.be.revertedWithCustomError(vault, "WeakCode");
    });

    it("6. revert VaultLimitReached если у получателя есть сейф этого токена", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        await expect(vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery))
            .to.be.revertedWithCustomError(vault, "VaultLimitReached");
    });

it("7. revert TransferAlreadyExists если у получателя уже есть pending", async function () {
    const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
    await vault.connect(alice).setGlobalEmergency(frank.address);
    await vault.connect(bob).setGlobalEmergency(eve.address);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
    // Создаём pending для bob
    await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
    // Второй init с тем же отправителем но другим vid — должен ревертить потому что сейф FROZEN (NotActive)
    // На самом деле проверка TransferAlreadyExists срабатывает когда у получателя уже есть pending на ЭТОТ токен
    // Попробуем от другого отправителя
    await openSafe(vault, ancr, eve, { amount: ethers.parseEther("200") });
    await expect(vault.connect(eve).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery))
        .to.be.revertedWithCustomError(vault, "TransferAlreadyExists");
});
    it("8. revert NotActive если vault уже FROZEN", async function () {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployFixture);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        await vault.connect(bob).setGlobalEmergency(eve.address);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery);
        await expect(vault.connect(alice).initSecureTransfer(1, bob.address, P.code, P.antiPhrase, P.confirm, P.newCode, P.newAntiPhrase, P.newRecovery))
            .to.be.revertedWithCustomError(vault, "NotActive");
    });
});
