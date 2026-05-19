// test/29-dos.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — DoS атаки", function () {
    it("1. массовое открытие/закрытие сейфов одним пользователем", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        for (let i = 0; i < 10; i++) {
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100"), emergencyAddress: frank.address });
            const vid = await vault.activeVaultId(alice.address);
            await vault.connect(alice).withdrawFromVault(vid, (await vault.getVaultCore(alice.address, vid)).amount, alice.address, P.code, P.antiPhrase);
        }
        expect(await vault.userVaultCount(alice.address)).to.equal(10);
    });

    it("2. множество пользователей создают сейфы — изоляция", async function () {
        const { vault, ancr, guardian } = await loadFixture(deployFixture);
        const signers = await ethers.getSigners();
        for (let i = 2; i < 12; i++) {
            const user = signers[i];
            await ancr.transfer(user.address, ethers.parseEther("1000"));
            await ancr.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "DoS", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: guardian.address };
            await vault.connect(user).openVault(await ancr.getAddress(), params, 0);
        }
        for (let i = 2; i < 12; i++) {
            expect(await vault.activeVaultId(signers[i].address)).to.equal(1);
        }
    });

    it("3. атака повторными failedAttempts не блокирует других", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "Locked");
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.code, P.antiPhrase);
    });

    it("4. voluntaryLock — только сам пользователь страдает", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        const lockUntil = Math.floor(Date.now() / 1000) + 86400 * 30;
        await vault.connect(alice).setVoluntaryLock(1, lockUntil, P.code);
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "Locked");
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.code, P.antiPhrase);
    });

    it("5. защита от переполнения vaultId", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        for (let i = 0; i < 100; i++) {
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
            await vault.connect(alice).openVault(await ancr.getAddress(), params, 0);
            const vid = await vault.activeVaultId(alice.address);
            const full = (await vault.getVaultCore(alice.address, vid)).amount;
            await vault.connect(alice).withdrawFromVault(vid, full, alice.address, P.code, P.antiPhrase);
        }
        expect(await vault.userVaultCount(alice.address)).to.equal(100);
    });

    it("6. deposit/withdraw в цикле не исчерпывает газ", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("500") });
        for (let i = 0; i < 20; i++) {
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("5"));
            await vault.connect(alice).depositToVault(1, ethers.parseEther("5"), P.code);
            await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("1"), alice.address, P.code, P.antiPhrase);
        }
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(0);
    });

    it("7. нельзя удалить ANCR из supportedTokens", async function () {
        const { vault, ancr, creator } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).removeSupportedToken(await ancr.getAddress())).to.be.revertedWithCustomError(vault, "InvalidAddress");
        expect(await vault.supportedTokens(await ancr.getAddress())).to.equal(true);
    });

    it("8. прямой вызов fallback/receive всегда реверт", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        const signer = await ethers.getSigner(alice.address);
        await expect(signer.sendTransaction({ to: await vault.getAddress(), value: 1 })).to.be.revertedWithCustomError(vault, "DirectTransferForbidden");
        await expect(signer.sendTransaction({ to: await vault.getAddress(), value: 1, data: "0xabcdef" })).to.be.revertedWithCustomError(vault, "DirectTransferForbidden");
    });

    it("9. только guardian может pause", async function () {
        const { vault, guardian, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).requestPause()).to.be.revertedWithCustomError(vault, "NotGuardian");
        await expect(vault.connect(alice).emergencyPause()).to.be.revertedWithCustomError(vault, "NotGuardian");
        await vault.connect(guardian).emergencyPause();
        expect(await vault.paused()).to.equal(true);
    });

    it("10. rotateCodes с неправильными кодами не ломает систему", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, "wrong", P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
        await time.increase(61);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(0);
    });
});
