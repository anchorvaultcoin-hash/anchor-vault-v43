const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — edgeCases", function () {
    it("1. открыть-закрыть-открыть", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, (await vault.getVaultCore(alice.address, 1)).amount, alice.address, P.code, P.antiPhrase);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        expect(await vault.userVaultCount(alice.address)).to.equal(2);
    });
    it("2. userVaultCount растёт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
        expect(await vault.userVaultCount(alice.address)).to.equal(2);
    });
    it("3. депозит-вывод-депозит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("30"), alice.address, P.code, P.antiPhrase);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("20"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("20"), P.code);
    });
    it("4. transfer-обратно не возможен", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await expect(vault.getVaultCore(alice.address, 1)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("5. все 3 уровня работают", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0 });
        await openSafe(vault, ancr, bob, { level: 1 });
        await openSafe(vault, ancr, carol, { level: 2 });
        expect((await vault.getVaultCore(alice.address, 1)).level).to.equal(0);
        expect((await vault.getVaultCore(bob.address, 1)).level).to.equal(1);
        expect((await vault.getVaultCore(carol.address, 1)).level).to.equal(2);
    });
    it("6. approve без openVault не даёт сейф", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("7. нельзя депозит в чужой сейф", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(bob).approve(await vault.getAddress(), ethers.parseEther("50"));
        await expect(vault.connect(bob).depositToVault(1, ethers.parseEther("50"), P.code))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("8. transfer после снятия voluntaryLock", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lockUntil = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, lockUntil, P.code);
        await time.increase(3601);
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
    });
    it("9. openVault после donate с тем же токеном", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("20"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("20"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(0);
    });
    it("8. transfer после снятия voluntaryLock", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lockUntil = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, lockUntil, P.code);
        await time.increase(3601);
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
    });
    it("9. openVault после donate с тем же токеном", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("20"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("20"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(0);
    });
    it("10. approve без openVault не даёт сейф", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        expect(await vault.activeVaultId(alice.address)).to.equal(0);
    });
    it("11. нельзя депозит в чужой сейф", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(bob).approve(await vault.getAddress(), ethers.parseEther("50"));
        await expect(vault.connect(bob).depositToVault(1, ethers.parseEther("50"), P.code))
            .to.be.revertedWithCustomError(vault, "BadVaultId");
    });
});
