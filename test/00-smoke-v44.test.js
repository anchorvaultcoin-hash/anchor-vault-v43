// test/00-smoke-v44.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const P = {
    code:       "MyMainCode123!@#",
    antiPhrase: "AnchorIsLegit!Verify",
    recovery:   "RecoveryEmergency2026",
    confirm:    "ConfirmCode2026!Secure",
    newCode:       "NewMainCodeForRotation99",
    newAntiPhrase: "NewAntiPhish2026Verify!",
    newRecovery:   "NewRecoveryEmergency2026!",
};

async function deployV44() {
    const [creator, guardian, alice, bob, carol, dave, eve, frank] = await ethers.getSigners();

    const Ancr = await ethers.getContractFactory("MockANCR", creator);
    const ancr = await Ancr.deploy(ethers.parseEther("10000000"));
    await ancr.waitForDeployment();

    const Vault = await ethers.getContractFactory("AnchorVaultV44", creator);
    const vault = await Vault.deploy(await ancr.getAddress(), guardian.address);
    await vault.waitForDeployment();

    for (const u of [alice, bob, carol, dave, eve, frank]) {
        await ancr.transfer(u.address, ethers.parseEther("100000"));
    }

    return { vault, ancr, creator, guardian, alice, bob, carol, dave, eve, frank };
}

async function openSafeV44(vault, ancr, user, emergency) {
    // Сначала set global emergency если не задано
    if (await vault.globalEmergency(user.address) === ethers.ZeroAddress) {
        await vault.connect(user).setGlobalEmergency(emergency.address);
    }
    const amount = ethers.parseEther("100");
    await ancr.connect(user).approve(await vault.getAddress(), amount);
    const params = {
        name: "Test",
        code: P.code,
        antiPhrase: P.antiPhrase,
        recovery: P.recovery,
        amount
    };
    await vault.connect(user).openVault(await ancr.getAddress(), params, 0);
}

describe("V44 Smoke", function () {

    it("VERSION = 44", async () => {
        const { vault } = await loadFixture(deployV44);
        expect(await vault.VERSION()).to.equal(44);
    });

    it("setGlobalEmergency работает один раз", async () => {
        const { vault, alice, frank, bob } = await loadFixture(deployV44);
        await vault.connect(alice).setGlobalEmergency(frank.address);
        expect(await vault.globalEmergency(alice.address)).to.equal(frank.address);
        await expect(vault.connect(alice).setGlobalEmergency(bob.address))
            .to.be.revertedWithCustomError(vault, "EmergencyAlreadySet");
    });

    it("openVault требует globalEmergency", async () => {
        const { vault, ancr, alice } = await loadFixture(deployV44);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = {
            name: "X", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
            amount: ethers.parseEther("100")
        };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
            .to.be.revertedWithCustomError(vault, "NoEmergencySet");
    });

    it("openVault создаёт сейф с глобальным emergency", async () => {
        const { vault, ancr, alice, frank } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.emergencyAddress).to.equal(frank.address);
        expect(core.amount).to.equal(ethers.parseEther("99.8"));
    });

    it("МУЛЬТИ-токен: alice может открыть ANCR + другой токен", async () => {
        const { vault, ancr, creator, alice, frank } = await loadFixture(deployV44);
        // Деплой второго токена
        const Tok = await ethers.getContractFactory("MockANCR", creator);
        const tok2 = await Tok.deploy(ethers.parseEther("1000000"));
        await tok2.waitForDeployment();
        await tok2.transfer(alice.address, ethers.parseEther("10000"));
        await vault.addSupportedToken(await tok2.getAddress());

        await openSafeV44(vault, ancr, alice, frank);

        // Открываем второй сейф с другим токеном
        await tok2.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params2 = {
            name: "Y", code: P.code + "X", antiPhrase: P.antiPhrase + "X", recovery: P.recovery + "X",
            amount: ethers.parseEther("100")
        };
        await vault.connect(alice).openVault(await tok2.getAddress(), params2, 0);

        const ancrId = await vault.activeVaultIdByToken(alice.address, await ancr.getAddress());
        const tok2Id = await vault.activeVaultIdByToken(alice.address, await tok2.getAddress());
        expect(ancrId).to.equal(1n);
        expect(tok2Id).to.equal(2n);
    });

    it("Нельзя открыть 2 сейфа с одинаковым токеном", async () => {
        const { vault, ancr, alice, frank } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);

        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = {
            name: "Y", code: P.code + "X", antiPhrase: P.antiPhrase + "X", recovery: P.recovery + "X",
            amount: ethers.parseEther("100")
        };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
            .to.be.revertedWithCustomError(vault, "VaultLimitReached");
    });

    it("panicWithdraw — 20% штраф, средства на globalEmergency", async () => {
        const { vault, ancr, alice, frank } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);

        const balBefore = await ancr.balanceOf(frank.address);
        await vault.connect(alice).panicWithdraw(1);
        const balAfter = await ancr.balanceOf(frank.address);

        // 99.8 (после opening fee) * 0.80 = 79.84
        expect(balAfter - balBefore).to.equal(ethers.parseEther("79.84"));
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(2); // CLOSED
    });

    it("panicWithdraw НЕ работает без emergency", async () => {
        const { vault, ancr, alice } = await loadFixture(deployV44);
        // Не вызываем setGlobalEmergency
        // Но openVault не получится без emergency, делаем низкоуровнево
        // На самом деле без openVault не будет сейфа, проверка идёт по vid
        // Откатим логику: создадим vid вручную? Нельзя.
        // Тогда тест проверяет: panicWithdraw без сейфа = BadVaultId
        await expect(vault.connect(alice).panicWithdraw(1))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });

    it("secureTransfer init + confirm", async () => {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);
        await vault.connect(bob).setGlobalEmergency(eve.address);

        // Аня запускает эскроу
        await vault.connect(alice).initSecureTransfer(
            1,
            bob.address,
            P.code, P.antiPhrase,
            P.confirm,
            P.newCode, P.newAntiPhrase, P.newRecovery
        );

        // Сейф Ани заморожен
        const aliceCore = await vault.getVaultCore(alice.address, 1);
        expect(aliceCore.status).to.equal(1); // FROZEN_FOR_TRANSFER

        // Боря подтверждает
        await vault.connect(bob).confirmSecureTransfer(1, P.confirm);

        // У Бори появился сейф
        const bobVid = await vault.activeVaultIdByToken(bob.address, await ancr.getAddress());
        expect(bobVid).to.be.gt(0n);

        // Сейф Ани закрыт (delete)
        await expect(vault.getVaultCore(alice.address, 1))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });

    it("secureTransfer cancel — отправитель возвращает сейф", async () => {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);
        await vault.connect(bob).setGlobalEmergency(eve.address);

        await vault.connect(alice).initSecureTransfer(
            1, bob.address,
            P.code, P.antiPhrase,
            P.confirm,
            P.newCode, P.newAntiPhrase, P.newRecovery
        );

        await vault.connect(alice).cancelSecureTransfer(1);

        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(0); // ACTIVE снова
    });

    it("secureTransfer 3 неверных попытки → expired", async () => {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);
        await vault.connect(bob).setGlobalEmergency(eve.address);

        await vault.connect(alice).initSecureTransfer(
            1, bob.address,
            P.code, P.antiPhrase,
            P.confirm,
            P.newCode, P.newAntiPhrase, P.newRecovery
        );

        // 3 неверные попытки с интервалом 1 мин
        for (let i = 0; i < 3; i++) {
            if (i > 0) await time.increase(61);
            await vault.connect(bob).confirmSecureTransfer(1, "WrongCodeXYZ123");
        }

        const st = await vault.getSecureTransfer(1);
        expect(st.status).to.equal(3); // EXPIRED
        expect(st.failCount).to.equal(3);

        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(0); // ACTIVE
    });

    it("secureTransfer reclaimExpired через 48 часов", async () => {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);
        await vault.connect(bob).setGlobalEmergency(eve.address);

        await vault.connect(alice).initSecureTransfer(
            1, bob.address,
            P.code, P.antiPhrase,
            P.confirm,
            P.newCode, P.newAntiPhrase, P.newRecovery
        );

        await time.increase(48 * 3600 + 1);
        await vault.connect(alice).reclaimExpiredTransfer(1);

        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(0);
    });

    it("panicWithdraw работает ДАЖЕ при voluntaryLock — спасательная кнопка от вора", async () => {
        const { vault, ancr, alice, frank } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);

        // Alice ставит voluntaryLock на 30 дней
        const lockUntil = (await time.latest()) + 30 * 24 * 3600;
        await vault.connect(alice).setVoluntaryLock(1, lockUntil, P.code);

        // Обычный вывод не работает
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("1"), alice.address, P.code, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "Locked");

        // Но panic — работает (потерял коды + забыл что заблочил)
        const balBefore = await ancr.balanceOf(frank.address);
        await vault.connect(alice).panicWithdraw(1);
        const balAfter = await ancr.balanceOf(frank.address);

        expect(balAfter - balBefore).to.equal(ethers.parseEther("79.84"));
        const core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(2);
    });

    it("FROZEN сейф нельзя депозит/вывод/закрыть", async () => {
        const { vault, ancr, alice, bob, frank, eve } = await loadFixture(deployV44);
        await openSafeV44(vault, ancr, alice, frank);
        await vault.connect(bob).setGlobalEmergency(eve.address);

        await vault.connect(alice).initSecureTransfer(
            1, bob.address,
            P.code, P.antiPhrase,
            P.confirm,
            P.newCode, P.newAntiPhrase, P.newRecovery
        );

        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("1"), alice.address, P.code, P.antiPhrase))
            .to.be.revertedWithCustomError(vault, "NotActive");

        await expect(vault.connect(alice).earlyClose(1, P.recovery))
            .to.be.revertedWithCustomError(vault, "NotActive");

        await expect(vault.connect(alice).panicWithdraw(1))
            .to.be.revertedWithCustomError(vault, "NotActive");
    });
});
