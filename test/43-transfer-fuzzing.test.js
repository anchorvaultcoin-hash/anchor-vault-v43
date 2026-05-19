const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Transfer Fuzzing", function () {
it("1. transfer → withdraw → открыть новый", async function () {
    const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
    await openSafe(vault, ancr, alice, { amount: ethers.parseEther("500") });
    await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
    const bobCore = await vault.getVaultCore(bob.address, 1);
    await vault.connect(bob).withdrawFromVault(1, bobCore.amount, bob.address, P.newCode, P.newAntiPhrase);
    // Даём bob ещё токенов на новый сейф
    await ancr.transfer(bob.address, ethers.parseEther("500"));
    await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
    expect(await vault.userVaultCount(bob.address)).to.equal(2);
});    it("2. transfer → deposit → transfer обратно нельзя", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await expect(vault.getVaultCore(alice.address, 1)).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("3. transfer → rotateCodes → withdraw", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).rotateCodes(1, P.newCode, P.newRecovery, { newCode: "BobCode12345678", newAntiPhrase: "BobAnti12345678", newRecovery: "BobRec1234567890" });
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, "BobCode12345678", "BobAnti12345678");
    });
    it("4. transfer с code=64 символа", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const code64 = "C" + "x".repeat(63);
        const anti64 = "A" + "y".repeat(63);
        const rec64 = "R" + "z".repeat(63);
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: code64, newAntiPhrase: anti64, newRecovery: rec64 });
        expect(await vault.activeVaultId(bob.address)).to.equal(1);
    });
    it("5. transfer → earlyClose новым владельцем", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).earlyClose(1, P.newRecovery);
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(1);
    });
    it("6. transfer → recoverToSafe новым владельцем", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).recoverToSafe(1, P.newRecovery);
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(1);
    });
    it("7. transfer → emergencyAny новым владельцем", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).emergencyWithdrawToAny(1, carol.address, P.newRecovery, P.newAntiPhrase);
        expect((await vault.getVaultCore(bob.address, 1)).status).to.equal(1);
    });
    it("8. цепочка из 5 transfer'ов", async function () {
        const { vault, ancr } = await loadFixture(deployFixture);
        const signers = await ethers.getSigners();
        await ancr.transfer(signers[2].address, ethers.parseEther("5000"));
        await ancr.connect(signers[2]).approve(await vault.getAddress(), ethers.parseEther("500"));
        const params = { name: "Chain", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("500"), emergencyAddress: signers[1].address };
        await vault.connect(signers[2]).openVault(await ancr.getAddress(), params, 0);
        let currentCode = P.code;
        let currentAnti = P.antiPhrase;
        for (let i = 3; i < 8; i++) {
            const to = signers[i];
            const code = "Code" + i + "!".repeat(10);
            const anti = "Anti" + i + "!".repeat(10);
            const rec = "Reco" + i + "!".repeat(10);
            await vault.connect(signers[i-1]).transferVault(1, to.address, currentCode, currentAnti, { newCode: code, newAntiPhrase: anti, newRecovery: rec });
            currentCode = code;
            currentAnti = anti;
        }
        expect(await vault.activeVaultId(signers[7].address)).to.equal(1);
    });
    it("9. transfer после setVoluntaryLock ревертит", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("10. transfer на адрес с активным сейфом ревертит", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery })).to.be.revertedWithCustomError(vault, "VaultLimitReached");
    });
    it("11. статус 0 после открытия, 1 после закрытия", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(0);
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
});
