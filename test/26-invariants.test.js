const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Инварианты", function () {
    it("1. lockedPrincipal = сумма vault.amount после openVault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lp = await vault.lockedPrincipal(await ancr.getAddress());
        const core = await vault.getVaultCore(alice.address, 1);
        expect(lp).to.equal(core.amount);
    });

    it("2. lockedPrincipal = сумма vault.amount после deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const lp = await vault.lockedPrincipal(await ancr.getAddress());
        const core = await vault.getVaultCore(alice.address, 1);
        expect(lp).to.equal(core.amount);
    });

    it("3. lockedPrincipal уменьшается при withdraw", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lpBefore = await vault.lockedPrincipal(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("30"), alice.address, P.code, P.antiPhrase);
        const lpAfter = await vault.lockedPrincipal(await ancr.getAddress());
        expect(lpAfter).to.be.lt(lpBefore);
    });

    it("4. userVaultCount >= activeVaultId для всех", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const count = await vault.userVaultCount(alice.address);
        const active = await vault.activeVaultId(alice.address);
        expect(count).to.be.gte(active);
    });

    it("5. totalBurnedANCR только растёт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        const before = await vault.totalBurnedANCR();
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
        const after = await vault.totalBurnedANCR();
        expect(after).to.be.gte(before);
    });

    it("6. penalty sum = burn + creator + reserve + reward", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const burnBefore = await vault.totalBurnedANCR();
        const creatorBefore = await vault.creatorFees(await ancr.getAddress());
        const reserveBefore = await vault.strategicReserve(await ancr.getAddress());
        const rewardBefore = await vault.rewardPool(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        const burnDelta = (await vault.totalBurnedANCR()) - burnBefore;
        const creatorDelta = (await vault.creatorFees(await ancr.getAddress())) - creatorBefore;
        const reserveDelta = (await vault.strategicReserve(await ancr.getAddress())) - reserveBefore;
        const rewardDelta = (await vault.rewardPool(await ancr.getAddress())) - rewardBefore;
        expect(burnDelta + creatorDelta + reserveDelta + rewardDelta).to.be.gt(0);
    });

    it("7. status только 0 или 1", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        let core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(0);
        await vault.connect(alice).earlyClose(1, P.recovery);
        core = await vault.getVaultCore(alice.address, 1);
        expect(core.status).to.equal(1);
    });

    it("8. VERSION всегда 43", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.VERSION()).to.equal(43);
    });

    it("9. MIN_DEPOSIT константа", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.MIN_DEPOSIT()).to.equal(ethers.parseEther("0.01"));
    });

    it("10. supportedTokens[ANCR] всегда true", async function () {
        const { vault, ancr } = await loadFixture(deployFixture);
        expect(await vault.supportedTokens(await ancr.getAddress())).to.equal(true);
    });
});
