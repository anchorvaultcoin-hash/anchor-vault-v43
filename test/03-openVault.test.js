// test/03-openVault.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

const OPEN_FEE = 20;

describe("AnchorVaultV43 — openVault", function () {

    describe("Успешные сценарии", function () {
        it("1. открывает SAFE-сейф с ANCR", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            const { vaultId } = await openSafe(vault, ancr, alice, { level: 0 });
            expect(vaultId).to.equal(1n);
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.status).to.equal(0);
            expect(core.level).to.equal(0);
        });

        it("2. открывает VAULT-сейф с ANCR", async function () {
            const { vault, ancr, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, bob, { level: 1 });
            const core = await vault.getVaultCore(bob.address, 1);
            expect(core.level).to.equal(1);
        });

        it("3. открывает FORTRESS-сейф с ANCR", async function () {
            const { vault, ancr, carol } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, carol, { level: 2 });
            const core = await vault.getVaultCore(carol.address, 1);
            expect(core.level).to.equal(2);
        });

        it("4. amount = net после вычета 0.2% (SAFE)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("100");
            await openSafe(vault, ancr, alice, { amount: deposit, level: 0 });
            const core = await vault.getVaultCore(alice.address, 1);
            const expectedNet = deposit - (deposit * BigInt(OPEN_FEE)) / 10000n;
            expect(core.amount).to.equal(expectedNet);
        });

        it("5. amount = net после вычета 0.2% (VAULT)", async function () {
            const { vault, ancr, bob } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("200");
            await openSafe(vault, ancr, bob, { amount: deposit, level: 1 });
            const core = await vault.getVaultCore(bob.address, 1);
            const expectedNet = deposit - (deposit * BigInt(OPEN_FEE)) / 10000n;
            expect(core.amount).to.equal(expectedNet);
        });

        it("6. amount = net после вычета 0.2% (FORTRESS)", async function () {
            const { vault, ancr, carol } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("500");
            await openSafe(vault, ancr, carol, { amount: deposit, level: 2 });
            const core = await vault.getVaultCore(carol.address, 1);
            const expectedNet = deposit - (deposit * BigInt(OPEN_FEE)) / 10000n;
            expect(core.amount).to.equal(expectedNet);
        });

        it("7. lockedPrincipal увеличен на net", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("100");
            await openSafe(vault, ancr, alice, { amount: deposit });
            const net = deposit - (deposit * BigInt(OPEN_FEE)) / 10000n;
            expect(await vault.lockedPrincipal(await ancr.getAddress())).to.equal(net);
        });

        it("8. событие VaultCreated с корректными args", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("100");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            const params = {
                name: "MyVault", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: deposit, emergencyAddress: frank.address
            };
            const net = deposit - (deposit * BigInt(OPEN_FEE)) / 10000n;
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.emit(vault, "VaultCreated")
                .withArgs(alice.address, 1, await ancr.getAddress(), net, "MyVault", frank.address, 0);
        });

        it("9. событие FeeCollected при открытии", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("100");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: deposit, emergencyAddress: frank.address
            };
            const fee = (deposit * BigInt(OPEN_FEE)) / 10000n;
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.emit(vault, "FeeCollected")
                .withArgs(alice.address, await ancr.getAddress(), fee);
        });

        it("10. activeVaultId = 1 после открытия", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            expect(await vault.activeVaultId(alice.address)).to.equal(1);
        });

        it("11. userVaultCount = 1 после открытия", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            expect(await vault.userVaultCount(alice.address)).to.equal(1);
        });

        it("12. getVaultSecurity: failCount = 0", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const sec = await vault.getVaultSecurity(alice.address, 1);
            expect(sec.failCount).to.equal(0);
            expect(sec.requiresCodeRotation).to.equal(false);
        });
    });

    describe("Реверты", function () {
        it("13. WeakCode для code", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.weak, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "WeakCode");
        });

        it("14. WeakCode для antiPhrase", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.weak, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "WeakCode");
        });

        it("15. WeakCode для recovery", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.weak,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "WeakCode");
        });

        it("16. CodeTooLong для code", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.tooLong, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "CodeTooLong");
        });

        it("17. CodeTooLong для antiPhrase", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.tooLong, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "CodeTooLong");
        });

        it("18. CodeTooLong для recovery", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.tooLong,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "CodeTooLong");
        });

        it("19. TokenNotSupported", async function () {
            const { vault, fot, alice, frank } = await loadFixture(deployFixture);
            await fot.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await fot.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "TokenNotSupported");
        });

        it("20. DepositBelowMinimum (amount < MIN_DEPOSIT)", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            const tiny = ethers.parseEther("0.001");
            await ancr.connect(alice).approve(await vault.getAddress(), tiny);
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: tiny, emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "DepositBelowMinimum");
        });

        it("21. InvalidLevel (level=3)", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 3))
                .to.be.revertedWithCustomError(vault, "InvalidLevel");
        });

        it("22. ZeroAddress emergencyAddress", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: ethers.ZeroAddress
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "ZeroAddress");
        });

        it("23. InvalidAddress emergencyAddress = msg.sender", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: alice.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "InvalidAddress");
        });

        it("24. InvalidAddress emergencyAddress = contract", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: await vault.getAddress()
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "InvalidAddress");
        });

        it("25. VaultLimitReached (уже есть active)", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V2", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.be.revertedWithCustomError(vault, "VaultLimitReached");
        });

        it("26. ContractPaused блокирует openVault", async function () {
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
    });

    describe("Multi-user и special", function () {
        it("27. alice и bob открывают сейфы независимо", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
            expect(await vault.activeVaultId(alice.address)).to.equal(1);
            expect(await vault.activeVaultId(bob.address)).to.equal(1);
        });

        it("28. разные уровни для разных пользователей", async function () {
            const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { level: 0 });
            await openSafe(vault, ancr, bob, { level: 1 });
            await openSafe(vault, ancr, carol, { level: 2 });
            expect((await vault.getVaultCore(alice.address, 1)).level).to.equal(0);
            expect((await vault.getVaultCore(bob.address, 1)).level).to.equal(1);
            expect((await vault.getVaultCore(carol.address, 1)).level).to.equal(2);
        });

        it("29. lockedPrincipal накапливается от разных пользователей", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            const d1 = ethers.parseEther("100");
            const d2 = ethers.parseEther("200");
            await openSafe(vault, ancr, alice, { amount: d1 });
            await openSafe(vault, ancr, bob, { amount: d2 });
            const net1 = d1 - (d1 * BigInt(OPEN_FEE)) / 10000n;
            const net2 = d2 - (d2 * BigInt(OPEN_FEE)) / 10000n;
            expect(await vault.lockedPrincipal(await ancr.getAddress())).to.equal(net1 + net2);
        });

        it("30. штраф при открытии распределяется (PenaltyDistributed)", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            const deposit = ethers.parseEther("100");
            await ancr.connect(alice).approve(await vault.getAddress(), deposit);
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: deposit, emergencyAddress: (await ethers.getSigners())[3].address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 0))
                .to.emit(vault, "PenaltyDistributed");
        });
    });

    describe("Краевые случаи", function () {
        it("31. открытие с большим количеством токенов", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            const bigAmount = ethers.parseEther("50000");
            await ancr.connect(alice).approve(await vault.getAddress(), bigAmount);
            await openSafe(vault, ancr, alice, { amount: bigAmount });
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.amount).to.be.gt(0);
        });

        it("32. второй сейф после закрытия первого", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).earlyClose(1, P.recovery);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("200") });
            expect(await vault.userVaultCount(alice.address)).to.equal(2);
            expect(await vault.activeVaultId(alice.address)).to.equal(2);
        });

        it("33. время lockedAt и depositedAt устанавливаются", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const timings = await vault.getVaultTimings(alice.address, 1);
            expect(timings.lockedAt).to.be.gt(0);
            expect(timings.depositedAt).to.be.gt(0);
        });

        it("34. status = ACTIVE (0) после открытия", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.status).to.equal(0);
        });

        it("35. id в хранилище = 1 для первого сейфа", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.id).to.equal(1);
        });

        it("36. нельзя открыть сейф с level > 2", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
            const params = {
                name: "V", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: ethers.parseEther("100"), emergencyAddress: frank.address
            };
            await expect(vault.connect(alice).openVault(await ancr.getAddress(), params, 255))
                .to.be.revertedWithCustomError(vault, "InvalidLevel");
        });

        it("37. name сохраняется корректно", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { name: "MyUniqueVault" });
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.name).to.equal("MyUniqueVault");
        });

        it("38. emergencyAddress сохраняется", async function () {
            const { vault, ancr, alice, frank } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { emergencyAddress: frank.address });
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.emergencyAddress).to.equal(frank.address);
        });

        it("39. токен vault'а совпадает с токеном депозита", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.token).to.equal(await ancr.getAddress());
        });
    });

    describe("FOT токены", function () {
        it("40. openVault с FOT токеном после добавления в supported", async function () {
            const { vault, fot, alice, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            await openSafe(vault, fot, alice, { amount: ethers.parseEther("200") });
            const core = await vault.getVaultCore(alice.address, 1);
            expect(core.token).to.equal(fotAddr);
            expect(core.amount).to.be.gt(0);
        });

        it("41. FOT: lockedPrincipal учитывает реально полученные токены", async function () {
            const { vault, fot, alice, frank, creator } = await loadFixture(deployFixture);
            const fotAddr = await fot.getAddress();
            await vault.connect(creator).addSupportedToken(fotAddr);
            const deposit = ethers.parseEther("200");
            await fot.connect(alice).approve(await vault.getAddress(), deposit);
            const params = {
                name: "FOT", code: P.code, antiPhrase: P.antiPhrase, recovery: P.recovery,
                amount: deposit, emergencyAddress: frank.address
            };
            await vault.connect(alice).openVault(fotAddr, params, 0);
            const lp = await vault.lockedPrincipal(fotAddr);
            expect(lp).to.be.lt(deposit);
            expect(lp).to.be.gt(0);
        });
    });
});
