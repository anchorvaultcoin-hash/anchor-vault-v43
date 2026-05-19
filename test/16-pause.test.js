const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — pause", function () {
    it("1. requestPause только guardian", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        expect(await vault.pauseTimestamp()).to.be.gt(0);
    });
    it("2. NotGuardian ревертит", async function () {
        const { vault, alice } = await loadFixture(deployFixture);
        await expect(vault.connect(alice).requestPause())
            .to.be.revertedWithCustomError(vault, "NotGuardian");
    });
    it("3. PauseRequested событие", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await expect(vault.connect(guardian).requestPause())
            .to.emit(vault, "PauseRequested");
    });
    it("4. AdminRequestPending при двойном request", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await expect(vault.connect(guardian).requestPause())
            .to.be.revertedWithCustomError(vault, "AdminRequestPending");
    });
    it("5. cancelPauseRequest работает", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await vault.connect(guardian).cancelPauseRequest();
        expect(await vault.pauseTimestamp()).to.equal(0);
    });
    it("6. PauseTimeoutNotReached до 2 дней", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await expect(vault.connect(guardian).executePause())
            .to.be.revertedWithCustomError(vault, "PauseTimeoutNotReached");
    });
    it("7. executePause через 2 дня", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await time.increase(2 * 24 * 3600 + 1);
        await vault.connect(guardian).executePause();
        expect(await vault.paused()).to.equal(true);
    });
    it("8. emergencyPause мгновенно", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        expect(await vault.paused()).to.equal(true);
    });
    it("9. unpause только creator", async function () {
        const { vault, guardian, creator } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        await vault.connect(creator).unpause();
        expect(await vault.paused()).to.equal(false);
    });
    it("10. ContractPaused блокирует openVault", async function () {
        const { vault, ancr, alice, guardian, frank } = await loadFixture(deployFixture);
        await vault.connect(guardian).emergencyPause();
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = {
            name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
            amount: ethers.parseEther("100"), emergencyAddress: frank.address
        };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
            .to.be.revertedWithCustomError(vault, "ContractPaused");
    });
    it("11. earlyClose работает при paused", async function () {
        const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("12. cancelPauseRequest сбрасывает таймер", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await vault.connect(guardian).cancelPauseRequest();
        expect(await vault.pauseTimestamp()).to.equal(0);
    });
    it("11. earlyClose работает при paused", async function () {
        const { vault, ancr, alice, guardian } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(guardian).emergencyPause();
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });
    it("12. cancelPauseRequest сбрасывает таймер", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await vault.connect(guardian).requestPause();
        await vault.connect(guardian).cancelPauseRequest();
        expect(await vault.pauseTimestamp()).to.equal(0);
    });
    it("13. PauseStateChanged событие при emergencyPause", async function () {
        const { vault, guardian } = await loadFixture(deployFixture);
        await expect(vault.connect(guardian).emergencyPause()).to.emit(vault, "PauseStateChanged");
    });
});
