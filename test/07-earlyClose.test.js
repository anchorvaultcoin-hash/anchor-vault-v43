// test/07-earlyClose.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — earlyClose", function () {
    describe("Успешные сценарии", function () {
        it("1. earlyClose закрывает сейф", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).earlyClose(1, P.recovery);
            expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
        });
        it("2. 5% штраф удержан", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = await ancr.balanceOf(alice.address);
            await vault.connect(alice).earlyClose(1, P.recovery);
            const after = await ancr.balanceOf(alice.address);
            const received = after - before;
            expect(received).to.be.lt(ethers.parseEther("99.8"));
        });
        it("3. activeVaultId сброшен", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).earlyClose(1, P.recovery);
            expect(await vault.activeVaultId(alice.address)).to.equal(0);
        });
        it("4. amount = 0 после закрытия", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).earlyClose(1, P.recovery);
            expect((await vault.getVaultCore(alice.address, 1)).amount).to.equal(0);
        });
        it("5. событие VaultEarlyClosed", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await expect(vault.connect(alice).earlyClose(1, P.recovery))
                .to.emit(vault, "VaultEarlyClosed");
        });
        it("6. lockedPrincipal уменьшен", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = await vault.lockedPrincipal(await ancr.getAddress());
            await vault.connect(alice).earlyClose(1, P.recovery);
            expect(await vault.lockedPrincipal(await ancr.getAddress())).to.be.lt(before);
        });
    });
    describe("Реверты", function () {
        it("7. BadVaultId", async function () {
            const { vault, alice } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).earlyClose(99, P.recovery))
                .to.be.revertedWithCustomError(vault, "BadVaultId");
        });
        it("8. NotActive", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).earlyClose(1, P.recovery);
            await expect(vault.connect(alice).earlyClose(1, P.recovery))
                .to.be.revertedWithCustomError(vault, "NotActive");
        });
        it("9. WrongCode на recovery", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await vault.connect(alice).earlyClose(1, "wrongRecovery12");
            expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
        });
        it("10. Locked (voluntaryLock)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const future = Math.floor(Date.now() / 1000) + 3600;
            await vault.connect(alice).setVoluntaryLock(1, future, P.code);
            await expect(vault.connect(alice).earlyClose(1, P.recovery))
                .to.be.revertedWithCustomError(vault, "Locked");
        });
    });
    describe("Штрафы", function () {
        it("11. PenaltyDistributed при earlyClose", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await expect(vault.connect(alice).earlyClose(1, P.recovery))
                .to.emit(vault, "PenaltyDistributed");
        });
        it("12. средства приходят на msg.sender", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const before = await ancr.balanceOf(alice.address);
            await vault.connect(alice).earlyClose(1, P.recovery);
            expect(await ancr.balanceOf(alice.address)).to.be.gt(before);
        });
        it("13. earlyClose работает после депозита", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
            await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
            await vault.connect(alice).earlyClose(1, P.recovery);
            expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
        });
    });
});
