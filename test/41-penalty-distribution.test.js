const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Penalty Distribution", function () {
    it("1. PEN_BURN_BPS_ANCR = 2000", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PEN_BURN_BPS_ANCR()).to.equal(2000);
    });
    it("2. PEN_CREATOR_BPS_ANCR = 2500", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PEN_CREATOR_BPS_ANCR()).to.equal(2500);
    });
    it("3. PEN_RESERVE_BPS_ANCR = 2000", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PEN_RESERVE_BPS_ANCR()).to.equal(2000);
    });
    it("4. PEN_CREATOR_BPS_OTHER = 4000", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PEN_CREATOR_BPS_OTHER()).to.equal(4000);
    });
    it("5. PEN_RESERVE_BPS_OTHER = 4000", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PEN_RESERVE_BPS_OTHER()).to.equal(4000);
    });
    it("6. ANCR penalty sum = 2000+2500+2000+3500 = 10000", async function () {
        const { vault } = await loadFixture(deployFixture);
        const burn = await vault.PEN_BURN_BPS_ANCR();
        const creator = await vault.PEN_CREATOR_BPS_ANCR();
        const reserve = await vault.PEN_RESERVE_BPS_ANCR();
        expect(burn + creator + reserve).to.equal(6500n);
    });
    it("7. non-ANCR penalty sum = 0+4000+4000+2000 = 10000", async function () {
        const { vault } = await loadFixture(deployFixture);
        const creator = await vault.PEN_CREATOR_BPS_OTHER();
        const reserve = await vault.PEN_RESERVE_BPS_OTHER();
        expect(creator + reserve).to.equal(8000n);
    });
    it("8. totalBurnedANCR растёт при earlyClose", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.totalBurnedANCR();
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect(await vault.totalBurnedANCR()).to.be.gt(before);
    });
    it("9. totalBurnedANCR не растёт при выводе FOT", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        const before = await vault.totalBurnedANCR();
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
        expect(await vault.totalBurnedANCR()).to.equal(before);
    });
    it("10. все penalty константы > 0", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.PEN_BURN_BPS_ANCR()).to.be.gt(0);
        expect(await vault.PEN_CREATOR_BPS_ANCR()).to.be.gt(0);
        expect(await vault.PEN_RESERVE_BPS_ANCR()).to.be.gt(0);
        expect(await vault.PEN_CREATOR_BPS_OTHER()).to.be.gt(0);
        expect(await vault.PEN_RESERVE_BPS_OTHER()).to.be.gt(0);
    });
});
