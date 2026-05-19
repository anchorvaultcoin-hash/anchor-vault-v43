// test/06-transfer.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — transferVault", function () {
    describe("Успешные сценарии", function () {
        it("1. перевод сейфа от alice к bob", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            });
            const core = await vault.getVaultCore(bob.address, 1);
            expect(core.token).to.equal(await ancr.getAddress());
        });
        it("2. старый сейф alice удалён", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            });
            await expect(vault.getVaultCore(alice.address, 1)).to.be.revertedWithCustomError(vault, "BadVaultId");
        });
        it("3. activeVaultId сброшен у alice", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            });
            expect(await vault.activeVaultId(alice.address)).to.equal(0);
        });
        it("4. activeVaultId = 1 у bob", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            });
            expect(await vault.activeVaultId(bob.address)).to.equal(1);
        });
        it("5. новый владелец может использовать новые коды", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            });
            await vault.connect(bob).withdrawFromVault(1, ethers.parseEther("10"), bob.address, P.newCode, P.newAntiPhrase);
        });
        it("6. старые коды не работают", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            });
            await vault.connect(bob).depositToVault(1, ethers.parseEther("10"), P.code);
            expect((await vault.getVaultSecurity(bob.address, 1)).failCount).to.equal(1);
        });
        it("7. событие VaultTransferred", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            })).to.emit(vault, "VaultTransferred");
        });
    });
    describe("Реверты", function () {
        it("8. InvalidAddress to=0", async function () {
            const { vault, ancr, alice } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await expect(vault.connect(alice).transferVault(1, ethers.ZeroAddress, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            })).to.be.revertedWithCustomError(vault, "InvalidAddress");
        });
        it("9. BadVaultId", async function () {
            const { vault, alice, bob } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).transferVault(99, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            })).to.be.revertedWithCustomError(vault, "BadVaultId");
        });
        it("10. NotActive", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            const full = (await vault.getVaultCore(alice.address, 1)).amount;
            await vault.connect(alice).withdrawFromVault(1, full, alice.address, P.code, P.antiPhrase);
            await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            })).to.be.revertedWithCustomError(vault, "NotActive");
        });
        it("11. VaultLimitReached", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
            await openSafe(vault, ancr, bob, { amount: ethers.parseEther("200") });
            await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            })).to.be.revertedWithCustomError(vault, "VaultLimitReached");
        });
        it("12. WrongCode на antiPhrase", async function () {
            const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
            await openSafe(vault, ancr, alice);
            await expect(vault.connect(alice).transferVault(1, bob.address, P.code, "Wrong!!", {
                newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
            })).to.be.revertedWithCustomError(vault, "WrongCode");
        });
    });
    it("13. name переносится", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { name: "MyVault", amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultCore(bob.address, 1)).name).to.equal("MyVault");
    });
    it("14. emergencyAddress переносится", async function () {
        const { vault, ancr, alice, bob, frank } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { emergencyAddress: frank.address, amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultCore(bob.address, 1)).emergencyAddress).to.equal(frank.address);
    });
    it("15. level переносится", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { level: 2, amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultCore(bob.address, 1)).level).to.equal(2);
    });
    it("16. token переносится", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        expect((await vault.getVaultCore(bob.address, 1)).token).to.equal(await ancr.getAddress());
    });
    it("17. WeakCode newCode", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.weak, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "WeakCode");
    });
    it("18. CodeTooLong newCode", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.tooLong, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "CodeTooLong");
    });
    it("19. AntiPhishRequired", async function () {
        const { vault, ancr, alice, bob } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice);
        await expect(vault.connect(alice).transferVault(1, bob.address, P.code, "", {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        })).to.be.revertedWithCustomError(vault, "AntiPhishRequired");
    });
    it("20. цепочка alice → bob → carol", async function () {
        const { vault, ancr, alice, bob, carol } = await loadFixture(deployFixture);
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await vault.connect(alice).transferVault(1, bob.address, P.code, P.antiPhrase, {
            newCode: P.newCode, newAntiPhrase: P.newAntiPhrase, newRecovery: P.newRecovery
        });
        await vault.connect(bob).transferVault(1, carol.address, P.newCode, P.newAntiPhrase, {
            newCode: "CodeForCarol1234", newAntiPhrase: "AntiCarol123456", newRecovery: "RecCarol12345678"
        });
        expect((await vault.getVaultCore(carol.address, 1)).token).to.equal(await ancr.getAddress());
    });
});
