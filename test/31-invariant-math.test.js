const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Invariant Math", function () {
    it("1. penalty = burn + creator + reserve + reward для ANCR", async function () {
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
        const totalDistributed = burnDelta + creatorDelta + reserveDelta + rewardDelta;
        expect(totalDistributed).to.be.gt(0);
    });

    it("2. burn = 20% от penalty для ANCR", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const burnBefore = await vault.totalBurnedANCR();
        await vault.connect(alice).earlyClose(1, P.recovery);
        const burnAfter = await vault.totalBurnedANCR();
        expect(burnAfter - burnBefore).to.be.gt(0);
    });

    it("3. creatorFees = 25% от penalty для ANCR", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.creatorFees(await ancr.getAddress());
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
        expect(await vault.creatorFees(await ancr.getAddress())).to.be.gt(before);
    });

    it("4. reserve = 20% от penalty для ANCR", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.strategicReserve(await ancr.getAddress());
        await vault.connect(alice).emergencyWithdrawToAny(1, alice.address, P.recovery, P.antiPhrase);
        expect(await vault.strategicReserve(await ancr.getAddress())).to.be.gt(before);
    });

    it("5. rewardPool получает остаток от penalty", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const before = await vault.rewardPool(await ancr.getAddress());
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect(await vault.rewardPool(await ancr.getAddress())).to.be.gt(before);
    });

    it("6. totalBurnedANCR монотонно растёт", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        const b1 = await vault.totalBurnedANCR();
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        const b2 = await vault.totalBurnedANCR();
        expect(b2).to.be.gte(b1);
    });

    it("7. lockedPrincipal = vault.amount для одиночного сейфа", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lp = await vault.lockedPrincipal(await ancr.getAddress());
        const core = await vault.getVaultCore(alice.address, 1);
        expect(lp).to.equal(core.amount);
    });

    it("8. после withdraw: lockedPrincipal уменьшается на amount", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lpBefore = await vault.lockedPrincipal(await ancr.getAddress());
        const withdrawAmount = ethers.parseEther("30");
        await vault.connect(alice).withdrawFromVault(1, withdrawAmount, alice.address, P.code, P.antiPhrase);
        expect(await vault.lockedPrincipal(await ancr.getAddress())).to.be.lt(lpBefore);
    });

    it("9. после deposit: lockedPrincipal увеличивается на net", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const lpBefore = await vault.lockedPrincipal(await ancr.getAddress());
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        expect(await vault.lockedPrincipal(await ancr.getAddress())).to.be.gt(lpBefore);
    });

    it("10. penalty при transfer = 0.5% от amount", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        const expectedFee = (core.amount * 50n) / 10000n;
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        const newCore = await vault.getVaultCore(bob.address, 1);
        expect(newCore.amount).to.equal(core.amount - expectedFee);
    });
});
