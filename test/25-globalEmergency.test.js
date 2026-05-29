// test/25-globalEmergency.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers-v44");

describe("AnchorVaultV44 — Global Emergency", function () {
    describe("setGlobalEmergency", function () {
        it("1. устанавливается успешно", async function () {
            const { vault, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            expect(await vault.globalEmergency(alice.address)).to.equal(frank.address);
        });

        it("2. событие GlobalEmergencySet", async function () {
            const { vault, alice, frank } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).setGlobalEmergency(frank.address))
                .to.emit(vault, "GlobalEmergencySet")
                .withArgs(alice.address, frank.address);
        });

        it("3. getGlobalEmergency view возвращает адрес", async function () {
            const { vault, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            expect(await vault.getGlobalEmergency(alice.address)).to.equal(frank.address);
        });

        it("4. revert ZeroAddress на 0x0", async function () {
            const { vault, alice } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).setGlobalEmergency(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(vault, "ZeroAddress");
        });

        it("5. revert InvalidAddress если == msg.sender", async function () {
            const { vault, alice } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).setGlobalEmergency(alice.address))
                .to.be.revertedWithCustomError(vault, "InvalidAddress");
        });

        it("6. revert InvalidAddress если == address(this)", async function () {
            const { vault, alice } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).setGlobalEmergency(await vault.getAddress()))
                .to.be.revertedWithCustomError(vault, "InvalidAddress");
        });

        it("7. revert EmergencyAlreadySet при повторной установке", async function () {
            const { vault, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await expect(vault.connect(alice).setGlobalEmergency(frank.address))
                .to.be.revertedWithCustomError(vault, "EmergencyAlreadySet");
        });

        it("8. Разные юзеры устанавливают независимо", async function () {
            const { vault, alice, bob, frank, eve } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await vault.connect(bob).setGlobalEmergency(eve.address);
            expect(await vault.globalEmergency(alice.address)).to.equal(frank.address);
            expect(await vault.globalEmergency(bob.address)).to.equal(eve.address);
        });
    });

    describe("Использование в openVault", function () {
        it("9. openVault revert NoEmergencySet без установленного", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = { name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery, amount: ethers.parseEther("100") };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "NoEmergencySet");
        });

        it("10. openVault использует globalEmergency как vault.emergencyAddress", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.emergencyAddress).to.equal(frank.address);
        });

        it("11. Несколько сейфов имеют одинаковый emergencyAddress", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await vault.connect(alice).setGlobalEmergency(frank.address);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).panicWithdraw(1);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
            const core1 = await vault.getVaultCore(alice.address, 1);
            const core2 = await vault.getVaultCore(alice.address, 2);
            expect(core1.emergencyAddress).to.equal(frank.address);
            expect(core2.emergencyAddress).to.equal(frank.address);
        });
    });
});
