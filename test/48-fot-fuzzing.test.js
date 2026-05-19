const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — FOT Fuzzing", function () {
it("1. openVault с FOT: amount < sent из-за 1% fee", async function () {
    const { vault, fot, alice, creator, guardian } = await loadFixture(deployFixture);
    await vault.connect(creator).addSupportedToken(await fot.getAddress());
    const sent = ethers.parseEther("200");
    await fot.connect(alice).approve(await vault.getAddress(), sent);
    const params = { name: "FOT", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: sent, emergencyAddress: guardian.address };
    await vault.connect(alice).openVault(await fot.getAddress(), params, 0);
    const core = await vault.getVaultCore(alice.address, 1);
    expect(core.amount).to.be.lt(sent);
});
    it("2. deposit FOT: received < sent", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        const before = (await vault.getVaultCore(alice.address, 1)).amount;
        await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("100"), P.code);
        const after = (await vault.getVaultCore(alice.address, 1)).amount;
        expect(after - before).to.be.lt(ethers.parseEther("100"));
    });
    it("3. withdraw FOT: корректный вывод", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("50"), alice.address, P.code, P.antiPhrase);
    });
    it("4. transfer FOT: корректный перевод", async function () {
        const { vault, fot, alice, bob, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        expect((await vault.getVaultCore(bob.address, 1)).token).to.equal(await fot.getAddress());
    });
    it("5. donate FOT: rewardPool пополняется", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
        await vault.connect(alice).donateToRewardPool(await fot.getAddress(), ethers.parseEther("30"));
        expect(await vault.rewardPool(await fot.getAddress())).to.be.gt(0);
    });
    it("6. FOT: penalty без burn части", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        const before = await vault.totalBurnedANCR();
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect(await vault.totalBurnedANCR()).to.equal(before);
    });
    it("7. FOT: earlyClose работает", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("8. FOT: recoverToSafe работает", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).recoverToSafe(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("9. FOT: emergencyAny работает", async function () {
        const { vault, fot, alice, bob, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        await vault.connect(alice).emergencyWithdrawToAny(1, bob.address, P.recovery, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("10. FOT: lockedPrincipal корректный", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        const lp = await vault.lockedPrincipal(await fot.getAddress());
        expect(lp).to.be.lt(ethers.parseEther("200"));
    });
});
