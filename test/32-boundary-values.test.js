const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Boundary Values", function () {
it("1. code ровно 10 символов проходит", async function () {
    const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
    await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
    const params = { name: "V", code: "1234567890", antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
    await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
});

it("2. code ровно 64 символа проходит", async function () {
    const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
    await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
    const code64 = "C" + "x".repeat(63);
    const params = { name: "V", code: code64, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
    await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
});
    it("3. code 9 символов ревертит WeakCode", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = { name: "V", code: "123456789", antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "WeakCode");
    });

    it("4. code 65 символов ревертит CodeTooLong", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const code65 = "x".repeat(65);
        const params = { name: "V", code: code65, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100"), emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "CodeTooLong");
    });

    it("5. amount = MIN_DEPOSIT ровно ревертит (net < MIN после fee)", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        const min = ethers.parseEther("0.01");
        await ancr.connect(alice).approve(await vault.getAddress(), min);
        const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: min, emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
    });

    it("6. amount = MIN_DEPOSIT + 1% (net >= MIN после fee) проходит", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        const amount = ethers.parseEther("0.0101");
        await ancr.connect(alice).approve(await vault.getAddress(), amount);
        const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: amount, emergencyAddress: frank.address };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0)).to.emit(vault, "VaultCreated");
    });

    it("7. withdraw 1 wei работает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, P.code, P.antiPhrase);
    });

    it("8. withdraw всего кроме 1 wei работает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const core = await vault.getVaultCore(alice.address, 1);
        await vault.connect(alice).withdrawFromVault(1, core.amount - 1n, alice.address, P.code, P.antiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.equal(1);
    });

    it("9. name пустая строка работает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { name: "", amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 1)).name).to.equal("");
    });

    it("10. name 64 символа работает", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        const longName = "N" + "a".repeat(63);
        await openSafe(vault, ancr, alice, { name: longName, amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 1)).name).to.equal(longName);
    });
});
