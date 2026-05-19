// test/00-smoke.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("Smoke: AnchorVaultV43", function () {

    it("деплоится и version = 43", async function () {
        const { vault } = await loadFixture(deployFixture);
        expect(await vault.VERSION()).to.equal(43);
    });

    it("creator = deployer, guardian установлен", async function () {
        const { vault, creator, guardian } = await loadFixture(deployFixture);
        expect(await vault.creator()).to.equal(creator.address);
        expect(await vault.guardian()).to.equal(guardian.address);
    });

    it("ANCR в supportedTokens", async function () {
        const { vault, ancr } = await loadFixture(deployFixture);
        expect(await vault.supportedTokens(await ancr.getAddress())).to.equal(true);
    });

    it("реверт ZeroAddress на нулевой ANCR", async function () {
        const [deployer, guardian] = await ethers.getSigners();
        const Vault = await ethers.getContractFactory("AnchorVaultV43");
        await expect(Vault.deploy(ethers.ZeroAddress, guardian.address))
            .to.be.revertedWithCustomError(Vault, "ZeroAddress");
    });

    it("alice открывает SAFE и видит свой vault", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);

        const core = await vault.getVaultCore(alice.address, 1);
        // 100 - 0.2% = 99.8
        expect(core.amount).to.equal(ethers.parseEther("99.8"));
        expect(core.token).to.equal(await ancr.getAddress());
        expect(core.level).to.equal(0);
        expect(core.status).to.equal(0);
    });

    it("withdraw мгновенный, 0.5% штраф", async function () {
        const { vault, ancr, alice } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });

        const balBefore = await ancr.balanceOf(alice.address);
        await vault.connect(alice).withdrawFromVault(
            1, ethers.parseEther("10"), alice.address, P.code, P.antiPhrase
        );
        const balAfter = await ancr.balanceOf(alice.address);

        // 10 - 0.5% = 9.95
        expect(balAfter - balBefore).to.equal(ethers.parseEther("9.95"));
    });

    it("WeakCode реверт при короткой фразе", async function () {
        const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
        const params = {
            name: "X",
            code: P.weak,
            antiPhrase: P.antiPhrase,
            recovery: P.recovery,
            amount: ethers.parseEther("100"),
            emergencyAddress: frank.address
        };
        await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
            .to.be.revertedWithCustomError(vault, "WeakCode");
    });

    it("emergencyWithdrawToAny — 15% штраф на любой адрес", async function () {
        const { vault, ancr, alice, eve } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });

        const balEveBefore = await ancr.balanceOf(eve.address);
        await vault.connect(alice).emergencyWithdrawToAny(
            1, eve.address, P.recovery, P.antiPhrase
        );
        const balEveAfter = await ancr.balanceOf(eve.address);

        // 99.8 (после открытия) - 15% = 84.83
        expect(balEveAfter - balEveBefore).to.equal(ethers.parseEther("84.83"));
    });
});
