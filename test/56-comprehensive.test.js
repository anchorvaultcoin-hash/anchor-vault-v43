const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Final Fuzzing", function () {
    it("1. openVault с code ровно 10 символов проходит", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: "1234567890", antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
    });
    it("2. openVault с code ровно 64 символа проходит", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const code64 = "x".repeat(64);
        const params = { name: "V", code: code64, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
    });
    it("3. setTimelock на SAFE > 0 ревертит", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0 });
        await expect(vault.connect(alice).setTimelock(1, 1, P.code)).to.be.revertedWithCustomError(vault, "TimelockTooLong");
    });
    it("4. setTimelock на VAULT = 72 проходит", async function () {
        const { vault, ancr, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, bob, { level: 1 });
        await vault.connect(bob).setTimelock(1, 72, P.code);
        expect((await vault.getVaultTimings(bob.address, 1)).timelockHours).to.equal(72);
    });
    it("5. setTimelock на FORTRESS = 168 проходит", async function () {
        const { vault, ancr, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, carol, { level: 2 });
        await vault.connect(carol).setTimelock(1, 168, P.code);
        expect((await vault.getVaultTimings(carol.address, 1)).timelockHours).to.equal(168);
    });
    it("6. deposit во время паузы ревертит", async function () {
        const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code)).to.be.revertedWithCustomError(vault, "ContractPaused");
    });
    it("7. withdraw во время паузы ревертит", async function () {
        const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase)).to.be.revertedWithCustomError(vault, "ContractPaused");
    });
    it("8. openVault во время паузы ревертит", async function () {
        const { vault, ancr, alice, guardian, frank } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "ContractPaused");
    });
    it("9. transfer во время паузы ревертит", async function () {
        const { vault, ancr, alice, bob, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "ContractPaused");
    });
    it("10. earlyClose работает во время паузы", async function () {
        const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
});
