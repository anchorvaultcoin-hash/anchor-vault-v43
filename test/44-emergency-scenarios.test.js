const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Emergency Scenarios", function () {
    it("1. earlyClose после SOFT_LOCK (через 1 час)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        for (let i = 0; i < 5; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(3601);
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("2. recoverToSafe во время паузы", async function () {
        const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("3. emergencyAny на себя (не msg.sender)", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect(await ancr.balanceOf(bob.address)).to.be.gt(ethers.parseEther("100000"));
    });
    it("4. пауза → unpause → операции работают", async function () {
        const { vault, ancr, alice, guardian, creator } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(creator).unpause();
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
    });
    it("5. rotateCodes после HARD_LOCK", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("300") });
        for (let i = 0; i < 30; i++) {
            await time.increase(61);
            try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        }
        await time.increase(8 * 24 * 3600);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("5"), alice.address, P.newCode, P.newAntiPhrase);
    });
    it("6. все 3 emergency операции подряд", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(2, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).emergencyWithdrawToAny(3, bob.address, P.recovery, P.antiPhrase);
        expect(await vault.userVaultCount(alice.address)).to.equal(3);
    });
    it("7. earlyClose после welcomeBonus", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.001"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("8. emergencyAny на адрес 0xdead", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const deadAddr = "0x000000000000000000000000000000000000dEaD";
        await vault.connect(alice).emergencyWithdrawToAny(1, deadAddr, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("9. recoverToSafe → earlyClose нельзя (уже закрыт)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        await expect(vault.connect(alice).earlyClose(1, P.recovery)).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("10. emergencyAny с пустой antiPhrase ревертит", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, "")).to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });
});
