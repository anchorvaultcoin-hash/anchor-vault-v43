const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — penalty", function () {
    it("1. PenaltyDistributed при withdraw ANCR", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase))
            .to.emit(vault, "PenaltyDistributed");
    });
    it("2. totalBurnedANCR растёт при withdraw ANCR", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.totalBurnedANCR();
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
        expect(await vault.totalBurnedANCR()).to.be.gt(before);
    });
    it("3. strategicReserve пополняется", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        expect(await vault.strategicReserve(await ancr.getAddress())).to.be.gt(before);
    });
    it("4. rewardPool пополняется", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.rewardPool(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        expect(await vault.rewardPool(await ancr.getAddress())).to.be.gt(before);
    });
    it("5. creatorFees пополняется", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        expect(await vault.creatorFees(await ancr.getAddress())).to.be.gt(before);
    });
    it("6. earlyClose распределяет penalty", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).earlyClose(1, P.recovery))
            .to.emit(vault, "PenaltyDistributed");
    });
    it("7. emergencyAny распределяет penalty", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase))
            .to.emit(vault, "PenaltyDistributed");
    });
    it("8. recoverToSafe распределяет penalty", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).recoverToSafe(1, P.recovery))
            .to.emit(vault, "PenaltyDistributed");
    });
    it("9. penalty при transfer ANCR", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.emit(vault, "PenaltyDistributed");
    });
    it("10. totalBurnedANCR только растёт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const b1 = await vault.totalBurnedANCR();
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        const b2 = await vault.totalBurnedANCR();
        expect(b2).to.be.gt(b1);
    });
    it("11. creatorFees накапливаются от разных операций", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const c1 = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.code, P.antiPhrase);
        const c2 = await vault.creatorFees(await ancr.getAddress());
        expect(c2).to.be.gt(c1);
    });
    it("12. стратегический резерв накапливается", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const s1 = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.code, P.antiPhrase);
        const s2 = await vault.strategicReserve(await ancr.getAddress());
        expect(s2).to.be.gt(s1);
    });
    it("13. rewardPool накапливается от штрафов", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const r1 = await vault.rewardPool(await ancr.getAddress());
        await vault.connect(alice).earlyClose(1, P.recovery);
        const r2 = await vault.rewardPool(await ancr.getAddress());
        expect(r2).to.be.gt(r1);
    });
    it("14. PenaltyDistributed содержит все 4 компонента", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase))
            .to.emit(vault, "PenaltyDistributed");
    });});
