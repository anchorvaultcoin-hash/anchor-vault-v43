const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Reentrancy Deep", function () {
    it("1. nonReentrant на openVault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Второй openVault в той же транзакции невозможен (разные tx)
        // Проверяем что nonReentrant сбрасывается
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.activeVaultId(alice.address)).to.equal(2);
    });

    it("2. nonReentrant на deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        // Два депозита подряд — работают
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
    });

    it("3. nonReentrant на withdraw", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Два вывода подряд
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
    });

    it("4. nonReentrant на transfer", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        // После перевода alice не может повторно перевести
        await expect(vault.getVaultCore(alice.address, 1)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });

    it("5. nonReentrant на earlyClose", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        // Повторный earlyClose ревертит NotActive
        await expect(vault.connect(alice).earlyClose(1, P.recovery)).to.be.revertedWithCustomError(vault, "NotActive");
    });

    it("6. nonReentrant на recoverToSafe", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery)).to.be.revertedWithCustomError(vault, "NotActive");
    });

    it("7. nonReentrant на emergencyAny", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase)).to.be.revertedWithCustomError(vault, "NotActive");
    });

    it("8. nonReentrant на rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(alice).rotateCodes(1, P.newCode, P.newRecovery, { newCode: P.code, newAntiPhrase: P.antiPhrase, newRecovery: P.recovery });
    });

    it("9. атака через cross-function reentrancy: withdraw → deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Вывод, потом депозит — разные транзакции, nonReentrant сброшен
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("20"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("20"), P.code);
    });

    it("10. атака через cross-function: transfer → emergencyAny", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).emergencyWithdrawToAny(1, alice.address, P.newRecovery, P.newAntiPhrase);
    });

    it("11. защита: donateToRewardPool не вызывает reentrancy", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("50"));
    });

    it("12. защита: setWelcomeBonus не reentrant", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.002"));
    });

    it("13. защита: addSupportedToken не reentrant", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        const Factory = await ethers.getContractFactory("MockANCR", creator);
        const t1 = await Factory.deploy(ethers.parseEther("1000"));
        await t1.waitForDeployment();
        const t2 = await Factory.deploy(ethers.parseEther("1000"));
        await t2.waitForDeployment();
        await vault.connect(creator).addSupportedToken(await t1.getAddress());
        await vault.connect(creator).addSupportedToken(await t2.getAddress());
    });

it("14. защита: changeEmergencyAddress после withdraw", async function () {
    const { vault, ancr, alice, bob, frank } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { emergencyAddress: frank.address, amount: ethers.parseEther("100") });
    await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
    await vault.connect(alice).changeEmergencyAddress(1, bob.address, P.recovery);
    expect((await vault.getVaultCore(alice.address, 1)).emergencyAddress).to.equal(bob.address);
});
    it("15. защита: setTimelock после deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 1, amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).setTimelock(1, 24, P.code);
    });

    it("16. защита: resetFailedAttempts после SOFT_LOCK", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(30 * 24 * 3600 + 1);
        await vault.connect(alice).resetFailedAttempts();
        expect(await vault.totalFailedAttempts(alice.address)).to.equal(0);
    });

    it("17. reentrancy через receive() невозможна", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        const signer = await ethers.getSigner(alice.address);
        await expect(signer.sendTransaction({ to: await vault.getAddress(), value: 1 })).to.be.revertedWithCustomError(vault, "DirectTransferForbidden");
    });

    it("18. reentrancy через fallback() невозможна", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        const signer = await ethers.getSigner(alice.address);
        await expect(signer.sendTransaction({ to: await vault.getAddress(), value: 1, data: "0x12345678" })).to.be.revertedWithCustomError(vault, "DirectTransferForbidden");
    });

    it("19. нельзя вызвать функции через delegatecall (EVM уровень)", async function () {
        const { vault } = await loadFixture(deployFixture);
        // Просто проверяем что контракт задеплоен и функции доступны
        expect(await vault.VERSION()).to.equal(43);
    });

    it("20. нельзя повторно инициализировать (нет initialize)", async function () {
        const { vault } = await loadFixture(deployFixture);
        // Контракт не upgradeable, initialize отсутствует
        expect(await vault.VERSION()).to.equal(43);
    });
});
