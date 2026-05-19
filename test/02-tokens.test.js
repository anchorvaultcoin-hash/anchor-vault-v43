// test/02-tokens.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — Tokens", function () {

    describe("addSupportedToken", function () {
        it("1. creator добавляет токен (FOT) — supportedTokens=true + TokenSupported", async function () {
            const { vault, fot, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await expect(vault.connect(creator).addSupportedToken(fotAddr))
                .to.emit(vault, "TokenSupported")
                .withArgs(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(true);
        });

        it("2. добавление уже supported токена (idempotent) — supportedTokens=true + событие", async function () {
            const { vault, fot, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await expect(vault.connect(creator).addSupportedToken(fotAddr))
                .to.emit(vault, "TokenSupported")
                .withArgs(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(true);
        });

        it("3. добавление нового токена (ещё один MockANCR) — supportedTokens=true", async function () {
            const { vault, creator } = await loadFixture(deployFixture);
            const Factory = await ethers.getContractFactory("MockANCR", creator);
            const token = await Factory.deploy(ethers.parseEther("1000"));
            await token.waitForDeployment();
            const tokenAddr = await token.getAddress();
            await expect(vault.connect(creator).addSupportedToken(tokenAddr))
                .to.emit(vault, "TokenSupported")
                .withArgs(tokenAddr);
            expect(await vault.supportedTokens(tokenAddr)).to.equal(true);
        });

        it("4. revert NotCreator (bob пытается добавить)", async function () {
            const { vault, fot, bob } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await expect(vault.connect(bob).addSupportedToken(fotAddr))
                .to.be.revertedWithCustomError(vault, "NotCreator");
        });

        it("5. revert ZeroAddress при address(0)", async function () {
            const { vault, creator } = await loadFixture(deployFixture);
            await expect(vault.connect(creator).addSupportedToken(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(vault, "ZeroAddress");
        });

        it("6. revert при попытке добавить EOA (вызов decimals ревертит)", async function () {
            const { vault, creator, bob } = await loadFixture(deployFixture);
            await expect(vault.connect(creator).addSupportedToken(bob.address))
                .to.be.reverted;
        });
    });

    describe("removeSupportedToken", function () {
        it("7. creator удаляет токен (FOT) — supportedTokens=false + TokenUnsupported", async function () {
            const { vault, fot, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await expect(vault.connect(creator).removeSupportedToken(fotAddr))
                .to.emit(vault, "TokenUnsupported")
                .withArgs(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(false);
        });

        it("8. удаление уже удалённого токена — supportedTokens=false + событие", async function () {
            const { vault, fot, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await vault.connect(creator).removeSupportedToken(fotAddr);
            await expect(vault.connect(creator).removeSupportedToken(fotAddr))
                .to.emit(vault, "TokenUnsupported")
                .withArgs(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(false);
        });

        it("9. revert NotCreator (bob пытается удалить)", async function () {
            const { vault, fot, creator, bob } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await expect(vault.connect(bob).removeSupportedToken(fotAddr))
                .to.be.revertedWithCustomError(vault, "NotCreator");
        });

        it("10. revert InvalidAddress при попытке удалить ANCR", async function () {
            const { vault, ancr, creator } = await loadFixture(deployFixture);
            const ancrAddr = await ancr.getAddress();
            await expect(vault.connect(creator).removeSupportedToken(ancrAddr))
                .to.be.revertedWithCustomError(vault, "InvalidAddress");
        });

        it("11. удаление токена, который не был добавлен — supportedTokens=false + TokenUnsupported", async function () {
            const { vault, fot, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await expect(vault.connect(creator).removeSupportedToken(fotAddr))
                .to.emit(vault, "TokenUnsupported")
                .withArgs(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(false);
        });
    });

    describe("Edge cases", function () {
        it("12. нельзя openVault на удалённый токен", async function () {
            const { vault, fot, alice, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await vault.connect(creator).removeSupportedToken(fotAddr);
            await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "Test",
                code: P.code,
                antiPhrase: P.antiPhrase,
                recovery: P.recovery,
                amount: ethers.parseEther("100"),
                emergencyAddress: alice.address
            };
            await expect(vault.connect(alice).openVault(fotAddr, params, 0))
                .to.be.revertedWithCustomError(vault, "TokenNotSupported");
        });

        it("13. donateToRewardPool ревертит на unsupported токен", async function () {
            const { vault, fot, alice } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
            await expect(vault.connect(alice).donateToRewardPool(fotAddr, ethers.parseEther("50")))
                .to.be.revertedWithCustomError(vault, "TokenNotSupported");
        });

        it("14. donateToRewardPool работает на supported токен", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            const ancrAddr = await ancr.getAddress();
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("10"));
            await expect(vault.connect(alice).donateToRewardPool(ancrAddr, ethers.parseEther("10")))
                .to.emit(vault, "RewardPoolDonated")
                .withArgs(alice.address, ancrAddr, ethers.parseEther("10"));
        });

        it("15. depositToVault работает после удаления токена из supported", async function () {
            const { vault, fot, alice, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
            await vault.connect(creator).removeSupportedToken(fotAddr);
            await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            await expect(vault.connect(alice).depositToVault(1, ethers.parseEther("100"), P.code))
                .to.emit(vault, "VaultDeposited");
        });

        it("16. supportedTokens не меняется для других токенов при удалении одного", async function () {
            const { vault, ancr, fot, creator } = await loadFixture(deployFixture);
            const ancrAddr = await ancr.getAddress();
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            expect(await vault.supportedTokens(ancrAddr)).to.equal(true);
            await vault.connect(creator).removeSupportedToken(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(false);
            expect(await vault.supportedTokens(ancrAddr)).to.equal(true);
        });

        it("17. guardian не может addSupportedToken (NotCreator)", async function () {
            const { vault, fot, guardian } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await expect(vault.connect(guardian).addSupportedToken(fotAddr))
                .to.be.revertedWithCustomError(vault, "NotCreator");
        });

        it("18. guardian не может removeSupportedToken (NotCreator)", async function () {
            const { vault, ancr, guardian } = await loadFixture(deployFixture);
            const ancrAddr = await ancr.getAddress();
            await expect(vault.connect(guardian).removeSupportedToken(ancrAddr))
                .to.be.revertedWithCustomError(vault, "NotCreator");
        });

        it("19. добавление ANCR (уже supported) — supportedTokens остаётся true + TokenSupported", async function () {
            const { vault, ancr, creator } = await loadFixture(deployFixture);
            const ancrAddr = await ancr.getAddress();
            await expect(vault.connect(creator).addSupportedToken(ancrAddr))
                .to.emit(vault, "TokenSupported")
                .withArgs(ancrAddr);
            expect(await vault.supportedTokens(ancrAddr)).to.equal(true);
        });

        it("20. повторное добавление удалённого токена emits TokenSupported и supportedTokens=true", async function () {
            const { vault, fot, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await vault.connect(creator).removeSupportedToken(fotAddr);
            await expect(vault.connect(creator).addSupportedToken(fotAddr))
                .to.emit(vault, "TokenSupported")
                .withArgs(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(true);
        });

        it("21. после удаления supportedTokens[token] = false, но ANCR остаётся supported", async function () {
            const { vault, fot, ancr, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            const ancrAddr = await ancr.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await vault.connect(creator).removeSupportedToken(fotAddr);
            expect(await vault.supportedTokens(fotAddr)).to.equal(false);
            expect(await vault.supportedTokens(ancrAddr)).to.equal(true);
        });

        it("22. добавление нескольких разных токенов — все supported", async function () {
            const { vault, creator } = await loadFixture(deployFixture);
            const Factory = await ethers.getContractFactory("MockANCR", creator);
            const t1 = await Factory.deploy(ethers.parseEther("1000"));
            await t1.waitForDeployment();
            const t2 = await Factory.deploy(ethers.parseEther("1000"));
            await t2.waitForDeployment();
            await vault.connect(creator).addSupportedToken(await t1.getAddress());
            await vault.connect(creator).addSupportedToken(await t2.getAddress());
            expect(await vault.supportedTokens(await t1.getAddress())).to.equal(true);
            expect(await vault.supportedTokens(await t2.getAddress())).to.equal(true);
        });

        it("23. добавление токена дважды не меняет его supported статус", async function () {
            const { vault, creator } = await loadFixture(deployFixture);
            const Factory = await ethers.getContractFactory("MockANCR", creator);
            const t = await Factory.deploy(ethers.parseEther("1000"));
            await t.waitForDeployment();
            const addr = await t.getAddress();
            await vault.connect(creator).addSupportedToken(addr);
            await vault.connect(creator).addSupportedToken(addr);
            expect(await vault.supportedTokens(addr)).to.equal(true);
        });
    });
});
