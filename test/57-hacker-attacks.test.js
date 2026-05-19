const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Hacker Attacks", function () {
    it("1. атака: подбор кода через перебор (должен заблокироваться)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "guess" + i, P.antiPhrase); } catch (e) {}
        }
        // После 5 попыток — SOFT_LOCK
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "Locked");
    });

    it("2. атака: попытка вывести на адрес контракта", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), await vault.getAddress(), P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("3. атака: transfer на себя", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).transferVault(1, alice.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

it("4. атака: попытка сменить emergencyAddress на себя", async function () {
    const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { emergencyAddress: frank.address, amount: ethers.parseEther("100") });
    await expect(vault.connect(alice).changeEmergencyAddress(1, alice.address, P.recovery)).to.be.revertedWithCustomError(vault, "InvalidAddress");
});
    it("5. атака: открыть сейф с emergencyAddress = contract", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: await vault.getAddress() };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("6. атака: попытка использовать чужой vaultId", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(bob).withdrawFromVault(1, 1n, bob.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });

    it("7. атака: deposit в чужой сейф", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(bob).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(bob).depositToVault(1, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });

    it("8. атака: попытка перевести сейф на contract", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).transferVault(1, await vault.getAddress(), P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("9. атака: попытка earlyClose с чужим recovery", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, "wrongRecoveryPhrase");
        // Не ревертит, но failCount увеличивается
        const sec = await vault.getVaultSecurity(alice.address, 1);
        expect(sec.failCount).to.equal(1);
    });

    it("10. атака: попытка emergencyAny с неверной antiPhrase", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, "WrongAntiPhrase!")).to.be.revertedWithCustomError(vault, "WrongCode");
    });

    it("11. атака: подбор antiPhrase через перебор", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        // AntiPhish проверяется ДО основного кода
        await expect(vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", "WrongAntiPhrase!")).to.be.revertedWithCustomError(vault, "WrongCode");
    });

    it("12. атака: попытка открыть сейф с code=9 символов", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: "123456789", antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "WeakCode");
    });

    it("13. атака: code=65 символов", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: "x".repeat(65), antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "CodeTooLong");
    });

    it("14. атака: deposit с amount=0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).depositToVault(1, 0, P.code)).to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
    });

    it("15. атака: withdraw с amount=0", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).withdrawFromVault(1, 0, alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("16. атака: withdraw больше баланса", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("999"), alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("17. атака: transfer на address(0)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).transferVault(1, ethers.ZeroAddress, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("18. атака: emergencyAny на address(0)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, ethers.ZeroAddress, P.recovery, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("19. атака: emergencyAny на контракт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, await vault.getAddress(), P.recovery, P.antiPhrase)).to.be.revertedWithCustomError(vault, "InvalidAddress");
    });

    it("20. атака: перевод ETH на контракт через selfdestruct (если бы)", async function () {
        const { vault } = await loadFixture(deployFixture);
        // Контракт не принимает ETH — balance всегда 0
        expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0n);
    });
});
