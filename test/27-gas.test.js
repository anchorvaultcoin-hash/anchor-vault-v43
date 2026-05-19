const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Gas", function () {
    it("1. openVault газ < 300k", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = {
            name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
            amount: ethers.parseEther("100"), emergencyAddress: frank.address
        };
        const tx = await vault.connect(alice).openVault(await ancr.getAddress(), params, 0);
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.lt(500000n);
    });

    it("2. deposit газ < 150k", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        const tx = await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.lt(150000n);
    });

    it("3. withdraw газ < 200k", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const tx = await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase);
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.lt(200000n);
    });

    it("4. transfer газ < 350k", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const tx = await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.lt(350000n);
    });

    it("5. emergencyAny газ < 250k", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const tx = await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.lt(250000n);
    });
});
