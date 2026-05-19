// test/30-stress.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Stress", function () {
    it("1. 50 открытий/закрытий подряд", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        for (let i = 0; i < 50; i++) {
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "S", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
            await vault.connect(alice).openVault(await ancr.getAddress(), params, 0);
            const vid = await vault.activeVaultId(alice.address);
            const full = (await vault.getVaultCore(alice.address, vid)).amount;
            await vault.connect(alice).withdrawFromVault(vid, full, alice.address, P.code, P.antiPhrase);
        }
        expect(await vault.userVaultCount(alice.address)).to.equal(50);
    });

    it("2. 30 депозитов подряд в один сейф", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = (await vault.getVaultCore(alice.address, 1)).amount;
        for (let i = 0; i < 30; i++) {
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("1"));
            await vault.connect(alice).depositToVault(1, ethers.parseEther("1"), P.code);
        }
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(before);
    });

    it("3. 30 выводов подряд из одного сейфа", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        for (let i = 0; i < 30; i++) {
            await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("1"), alice.address, P.code, P.antiPhrase);
        }
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(0);
    });

    it("4. 10 переводов по цепочке", async function () {
        const { vault, ancr } = await loadFixture(deployFixture);
        const signers = await ethers.getSigners();
        await ancr.transfer(signers[2].address, ethers.parseEther("5000"));
        await ancr.connect(signers[2]).approve(await vault.getAddress(), ethers.parseEther("500"));
        const params = { name: "Chain", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("500"), emergencyAddress: signers[1].address };
        await vault.connect(signers[2]).openVault(await ancr.getAddress(), params, 0);
        let currentCode = P.code;
        let currentAnti = P.antiPhrase;
        for (let i = 3; i < 13; i++) {
            const to = signers[i];
            const newCode = "Code" + i.toString().padStart(10, "0") + "Ok!";
            const newAnti = "Anti" + i.toString().padStart(10, "0") + "Ok!";
            const newRec = "Reco" + i.toString().padStart(10, "0") + "Ok!";
            await vault.connect(signers[i-1]).transferVault(1, to.address, currentCode, currentAnti, { newCode: newCode, newAntiPhrase: newAnti, newRecovery: newRec });
            currentCode = newCode;
            currentAnti = newAnti;
        }
        expect(await vault.activeVaultId(signers[12].address)).to.equal(1);
    });

    it("5. параллельные операции 5 пользователей", async function () {
        const { vault, ancr } = await loadFixture(deployFixture);
        const signers = await ethers.getSigners();
        for (let i = 2; i < 7; i++) {
            const user = signers[i];
            await ancr.transfer(user.address, ethers.parseEther("5000"));
            await ancr.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "P", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: signers[1].address };
            await vault.connect(user).openVault(await ancr.getAddress(), params, 0);
        }
        for (let i = 2; i < 7; i++) {
            await ancr.connect(signers[i]).approve(await vault.getAddress(), ethers.parseEther("50"));
            await vault.connect(signers[i]).depositToVault(1, ethers.parseEther("50"), P.code);
        }
        for (let i = 2; i < 7; i++) {
            await vault.connect(signers[i]).withdrawFromVault(1, ethers.parseEther("20"), signers[i].address, P.code, P.antiPhrase);
        }
        for (let i = 2; i < 7; i++) {
            expect((await vault.getVaultCore(signers[i].address, 1)).status).to.equal(0);
        }
    });

    it("6. восстановление после 35 failedAttempts через rotateCodes", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("500") });
        for (let i = 0; i < 35; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(8 * 24 * 3600);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.newCode, P.newAntiPhrase);
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(0);
    });

    it("7. пауза не блокирует earlyClose/recover/emergency", async function () {
        const { vault, ancr, alice, guardian, bob, creator } = await loadFixture(deployFixture);
        // earlyClose работает при paused
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
        // unpause, открываем новый, снова pause, recover
        await vault.connect(creator).unpause();
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).recoverToSafe(2, P.recovery);
        expect((await vault.getVaultCore(alice.address, 2)).status).to.equal(1);
        // unpause, открываем, pause, emergencyAny
        await vault.connect(creator).unpause();
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).emergencyWithdrawToAny(3, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 3)).status).to.equal(1);
    });
    it("8. welcomeBonus выплачивается 10 разным пользователям", async function () {
        const { vault, ancr, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        const signers = await ethers.getSigners();
        for (let i = 8; i < 18; i++) {
            await ancr.transfer(signers[i].address, ethers.parseEther("1000"));
            await ancr.connect(signers[i]).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "W", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: signers[1].address };
            await vault.connect(signers[i]).openVault(await ancr.getAddress(), params, 0);
            expect(await vault.welcomeBonusClaimed(signers[i].address)).to.equal(true);
        }
    });

    it("9. donate + withdraw из rewardPool через welcomeBonus", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
    });

    it("10. смена ролей 5 раз подряд", async function () {
        const { vault, creator } = await loadFixture(deployFixture);
        const signers = await ethers.getSigners();
        let currentCreator = creator;
        for (let i = 2; i < 7; i++) {
            await vault.connect(currentCreator).transferCreatorship(signers[i].address);
            await time.increase(7 * 24 * 3600 + 1);
            await vault.connect(signers[i]).acceptCreatorship();
            currentCreator = signers[i];
        }
        expect(await vault.creator()).to.equal(signers[6].address);
    });
});
