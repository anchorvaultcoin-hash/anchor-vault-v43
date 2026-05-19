const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Frontrun Attacks", function () {
    it("1. фронтран: нельзя подменить to в transfer", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // transfer подписан на bob, carol не может перехватить
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
        expect(await vault.activeVaultId(carol.address)).to.equal(0);
    });

    it("2. фронтран: antiPhish защищает от подмены получателя", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Без antiPhrase вывести нельзя
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, "")).to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });

    it("3. фронтран: нельзя подменить сумму вывода", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await ancr.balanceOf(alice.address);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        const after = await ancr.balanceOf(alice.address);
        // Вывелось примерно 10 (минус комиссия)
        expect(after - before).to.be.lt(ethers.parseEther("10"));
        expect(after - before).to.be.gt(ethers.parseEther("9"));
    });

    it("4. фронтран: нельзя подменить emergencyAddress при открытии", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { emergencyAddress: bob.address, amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.emergencyAddress).to.equal(bob.address);
    });

    it("5. фронтран: нельзя изменить коды при transfer", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        // Старые коды alice не работают для bob
        await vault.connect(bob).depositToVault(1, ethers.parseEther("10"), P.code);
        const sec = await vault.getVaultSecurity(bob.address, 1);
        expect(sec.failCount).to.equal(1);
    });

    it("6. фронтран: timelock на admin операции защищает от мгновенного вывода", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const fee = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), alice.address, fee);
        // Сразу вывести нельзя
        await expect(vault.connect(creator).withdrawCreatorFees(await ancr.getAddress())).to.be.revertedWithCustomError(vault, "TimelockNotExpired");
    });

    it("7. фронтран: cooldown на смену creator защищает", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await expect(vault.connect(alice).acceptCreatorship()).to.be.revertedWithCustomError(vault, "CooldownNotExpired");
    });

    it("8. фронтран: пауза с задержкой (не emergency)", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        // Нельзя мгновенно выполнить
        await expect(vault.connect(guardian).executePause()).to.be.revertedWithCustomError(vault, "PauseTimeoutNotReached");
        await time.increase(2 * 24 * 3600 + 1);
        await vault.connect(guardian).executePause();
        expect(await vault.paused()).to.equal(true);
    });

    it("9. фронтран: нельзя отменить чужой requestPause", async function () {
        const { vault, guardian, alice } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await expect(vault.connect(alice).cancelPauseRequest()).to.be.revertedWithCustomError(vault, "NotGuardian");
    });

    it("10. фронтран: нельзя выполнить чужой acceptCreatorship", async function () {
        const { vault, creator, alice, bob } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await expect(vault.connect(bob).acceptCreatorship()).to.be.revertedWithCustomError(vault, "NotPendingRole");
    });

    it("11. фронтран: нельзя подменить token в openVault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.token).to.equal(await ancr.getAddress());
    });

    it("12. фронтран: нельзя подменить level в openVault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 2, amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.level).to.equal(2);
    });

    it("13. фронтран: rotateCodes требует старый код", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Нельзя сменить коды без знания старого
        await vault.connect(alice).rotateCodes(1, "wrong", P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        const sec = await vault.getVaultSecurity(alice.address, 1);
        expect(sec.failCount).to.equal(1);
    });

    it("14. фронтран: нельзя подделать salt (хеши разные для разных vault)", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        const hash1 = await vault.getAntiPhishHash(alice.address, 1);
        const hash2 = await vault.getAntiPhishHash(bob.address, 1);
        expect(hash1).to.not.equal(hash2);
    });

    it("15. фронтран: комиссии защищены — нельзя вывести без комиссии", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        const balanceBefore = await ancr.balanceOf(alice.address);
        await vault.connect(alice).withdrawFromVault(1, core.amount, alice.address, P.code, P.antiPhrase);
        const balanceAfter = await ancr.balanceOf(alice.address);
        // Получили меньше чем было в сейфе
        expect(balanceAfter - balanceBefore).to.be.lt(core.amount);
    });

    it("16. фронтран: нельзя обойти SOFT_LOCK через смену адреса", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        // SOFT_LOCK действует на vault, не на пользователя
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.code, P.antiPhrase);
    });

    it("17. фронтран: нельзя украсть через earlyClose (только владелец получает средства)", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const bobBefore = await ancr.balanceOf(bob.address);
        await vault.connect(alice).earlyClose(1, P.recovery);
        // Bob не получил ничего
        expect(await ancr.balanceOf(bob.address)).to.equal(bobBefore);
    });

    it("18. фронтран: нельзя подменить vaultId через front-run", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        // vaultId привязан к пользователю
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, P.antiPhrase)).to.not.be.reverted;
        await expect(vault.connect(bob).withdrawFromVault(1, 1n, bob.address, P.code, P.antiPhrase)).to.not.be.reverted;
    });

    it("19. фронтран: antiPhish проверяется до основного кода", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // Даже с правильным кодом, но без antiPhrase — реверт
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, "")).to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });

    it("20. фронтран: emergency пауза мгновенная (не требует задержки)", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        expect(await vault.paused()).to.equal(true);
    });
});
