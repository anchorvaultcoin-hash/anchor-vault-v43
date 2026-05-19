const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — rotateCodes", function () {
    it("1. успешная смена кодов", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
    });
    it("2. новые коды работают", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("10"), alice.address, P.newCode, P.newAntiPhrase);
    });
    it("3. старые коды не работают", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await vault.connect(alice).depositToVault(1, ethers.parseEther("10"), P.code);
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
    });
    it("4. событие CodesRotated", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await expect(vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.emit(vault, "CodesRotated");
    });
    it("5. failCount сбрасывается", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await time.increase(61);
        try { await vault.connect(alice).withdrawFromVault(1, 1n, alice.address, "wrong", P.antiPhrase); } catch (e) {}
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(0);
    });
    it("6. BadVaultId", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).rotateCodes(99, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "BadVaultId");
    });
    it("7. NotActive", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        const full = (await vault.getVaultCore(alice.address, 1)).amount;
        await vault.connect(alice).withdrawFromVault(1, full, alice.address, P.code, P.antiPhrase);
        await expect(vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "NotActive");
    });
    it("8. WeakCode для новых", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.weak, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "WeakCode");
    });
    it("9. Locked (voluntaryLock)", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        const future = Math.floor(Date.now() / 1000) + 3600;
        await vault.connect(alice).setVoluntaryLock(1, future, P.code);
        await expect(vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "Locked");
    });
    it("10. WrongCode на старом recovery", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await vault.connect(alice).rotateCodes(1, P.code, "WrongRecovery12", {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
    });
    it("11. после rotateCodes можно депозит делать", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.newCode);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.gt(ethers.parseEther("99"));
    });
    it("12. CodeTooLong для новых кодов", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.tooLong, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "CodeTooLong");
    });
    it("13. WrongCode на старом коде", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await vault.connect(alice).rotateCodes(1, "wrongOldCode12", P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultSecurity(alice.address, 1)).failCount).to.equal(1);
    });
    it("14. rotateCodes после deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        // Проверяем, что новые коды работают
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("5"), alice.address, P.newCode, P.newAntiPhrase);
    });
    it("14. rotateCodes после deposit", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.code);
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("5"), alice.address, P.newCode, P.newAntiPhrase);
        expect((await vault.getVaultCore(alice.address, 1)).amount).to.be.lt(ethers.parseEther("129"));
    });
});
