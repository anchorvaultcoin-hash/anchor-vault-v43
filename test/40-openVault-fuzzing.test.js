const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — OpenVault Fuzzing", function () {
    it("1. открыть 3 сейфа разных уровней одним пользователем", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 0, amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(1, (await vault.getVaultCore(alice.address, 1)).amount, alice.address, P.code, P.antiPhrase);
        await openSafe(vault, ancr, alice, { level: 1, amount: ethers.parseEther("100") });
        await vault.connect(alice).withdrawFromVault(2, (await vault.getVaultCore(alice.address, 2)).amount, alice.address, P.code, P.antiPhrase);
        await openSafe(vault, ancr, alice, { level: 2, amount: ethers.parseEther("100") });
        expect(await vault.userVaultCount(alice.address)).to.equal(3);
    });

    it("2. открыть сейф с разными суммами", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        const amounts = [ethers.parseEther("0.02"), ethers.parseEther("1"), ethers.parseEther("100"), ethers.parseEther("1000")];
        for (let i = 0; i < 4; i++) {
            await ancr.connect(alice).approve(await vault.getAddress(), amounts[i] * 2n);
            await openSafe(vault, ancr, alice, { amount: amounts[i] });
            const vid = await vault.activeVaultId(alice.address);
            await vault.connect(alice).withdrawFromVault(vid, (await vault.getVaultCore(alice.address, vid)).amount, alice.address, P.code, P.antiPhrase);
        }
        expect(await vault.userVaultCount(alice.address)).to.equal(4);
    });

    it("3. emergencyAddress разные для каждого сейфа", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { emergencyAddress: bob.address, amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { emergencyAddress: carol.address, amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 2)).emergencyAddress).to.equal(carol.address);
    });

    it("4. имена сейфов разные", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { name: "First", amount: ethers.parseEther("100") });
        await vault.connect(alice).earlyClose(1, P.recovery);
        await openSafe(vault, ancr, alice, { name: "Second", amount: ethers.parseEther("100") });
        expect((await vault.getVaultCore(alice.address, 2)).name).to.equal("Second");
    });

    it("5. openVault после donateToRewardPool", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
        await vault.connect(alice).donateToRewardPool(await ancr.getAddress(), ethers.parseEther("10"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.activeVaultId(alice.address)).to.equal(1);
    });

    it("6. openVault после welcomeBonus", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).setWelcomeBonus(ethers.parseEther("0.002"));
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        expect(await vault.welcomeBonusClaimed(alice.address)).to.equal(true);
    });

    it("7. openVault с FOT токеном", async function () {
        const { vault, fot, alice, creator } = await loadFixture(deployFixture);
        await vault.connect(creator).addSupportedToken(await fot.getAddress());
        await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
        expect((await vault.getVaultCore(alice.address, 1)).token).to.equal(await fot.getAddress());
    });

    it("8. openVault → deposit → withdraw → close", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        await vault.connect(alice).withdrawFromVault(1, ethers.parseEther("20"), alice.address, P.code, P.antiPhrase);
        await vault.connect(alice).earlyClose(1, P.recovery);
        expect((await vault.getVaultCore(alice.address, 1)).status).to.equal(1);
    });

    it("9. openVault → transfer → withdraw у получателя", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.newCode, P.newAntiPhrase);
    });

    it("10. openVault → rotateCodes → deposit с новым кодом", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).rotateCodes(1, P.code, P.recovery, { newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("30"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("30"), P.newCode);
    });
});
