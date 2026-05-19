const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Multi-User Isolation", function () {
    it("1. 20 пользователей одновременно открывают сейфы", async function () {
        const { vault, ancr, guardian } = await loadFixture(deployFixture);
        const signers = await ethers.getSigners();
        for (let i = 2; i < 20; i++) {
            await ancr.transfer(signers[i].address, ethers.parseEther("1000"));
            await ancr.connect(signers[i]).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "U", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: guardian.address };
            await vault.connect(signers[i]).openVault(await ancr.getAddress(), params, 0);
        }
        for (let i = 2; i < 20; i++) {
            expect(await vault.activeVaultId(signers[i].address)).to.equal(1);
        }
    });

    it("2. депозит alice не влияет на баланс bob", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        const bobBefore = (await vault.getVaultCore(bob.address, 1)).amount;
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        expect((await vault.getVaultCore(bob.address, 1)).amount).to.equal(bobBefore);
    });

    it("3. вывод alice не влияет на баланс bob", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        const bobBefore = (await vault.getVaultCore(bob.address, 1)).amount;
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(bob.address, 1)).amount).to.equal(bobBefore);
    });

    it("4. перевод между пользователями изолирован", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        const bobBefore = (await vault.getVaultCore(bob.address, 1)).amount;
        await vault.connect(alice).transferVault(1, carol.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultCore(bob.address, 1)).amount).to.equal(bobBefore);
    });

    it("5. failedAttempts alice не влияют на bob", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        const secBob = await vault.getVaultSecurity(bob.address, 1);
        expect(secBob.failCount).to.equal(0);
    });

    it("6. voluntaryLock alice не блокирует bob", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 86400;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(bob.address, 1)).amount).to.be.lt(ethers.parseEther("99.8"));
    });

    it("7. welcomeBonus alice не забирает бонус bob", async function () {
        const { vault, ancr, alice, bob, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
        expect(await vault.welcomeBonusClaimed(bob.address)).to.equal(true);
    });

    it("8. totalFailedAttempts alice не смешивается с bob", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 3; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        expect(await vault.totalFailedAttempts(alice.address)).to.equal(3);
        expect(await vault.totalFailedAttempts(bob.address)).to.equal(0);
    });

    it("9. activeVaultId изолирован между пользователями", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        expect(await vault.activeVaultId(alice.address)).to.equal(1);
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
    });

it("10. userVaultCount независим для каждого", async function () {
    const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    await vault.connect(alice).earlyClose(1, P.recovery);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
    await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
    expect(await vault.userVaultCount(alice.address)).to.equal(2);
    expect(await vault.userVaultCount(bob.address)).to.equal(1);
});
});
