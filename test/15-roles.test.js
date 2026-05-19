const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployFixture, openSafe, P } = require("./helpers");

describe("AnchorVaultV43 — roles", function () {
    describe("Creatorship", function () {
        it("1. transferCreatorship только creator", async function () {
            const { vault, creator, alice } = await loadFixture(deployFixture);
            await vault.connect(creator).transferCreatorship(alice.address);
            expect(await vault.pendingCreator()).to.equal(alice.address);
        });
        it("2. NotCreator ревертит", async function () {
            const { vault, alice, bob } = await loadFixture(deployFixture);
            await expect(vault.connect(alice).transferCreatorship(bob.address))
                .to.be.revertedWithCustomError(vault, "NotCreator");
        });
        it("3. ZeroAddress ревертит", async function () {
            const { vault, creator } = await loadFixture(deployFixture);
            await expect(vault.connect(creator).transferCreatorship(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(vault, "ZeroAddress");
        });
        it("4. CreatorshipTransferRequested событие", async function () {
            const { vault, creator, alice } = await loadFixture(deployFixture);
            await expect(vault.connect(creator).transferCreatorship(alice.address))
                .to.emit(vault, "CreatorshipTransferRequested");
        });
        it("5. acceptCreatorship только pending", async function () {
    const { vault, creator, alice, bob } = await loadFixture(deployFixture);
    await vault.connect(creator).transferCreatorship(alice.address);
    await expect(vault.connect(bob).acceptCreatorship())
        .to.be.revertedWithCustomError(vault, "NotPendingRole");
});
        it("6. CooldownNotExpired до 7 дней", async function () {
            const { vault, creator, alice } = await loadFixture(deployFixture);
            await vault.connect(creator).transferCreatorship(alice.address);
            await expect(vault.connect(alice).acceptCreatorship())
                .to.be.revertedWithCustomError(vault, "CooldownNotExpired");
        });
        it("7. успех через 7 дней", async function () {
            const { vault, creator, alice } = await loadFixture(deployFixture);
            await vault.connect(creator).transferCreatorship(alice.address);
            await time.increase(7 * 24 * 3600 + 1);
            await vault.connect(alice).acceptCreatorship();
            expect(await vault.creator()).to.equal(alice.address);
        });
    });
    describe("Guardianship", function () {
        it("8. transferGuardianship только creator", async function () {
            const { vault, creator, alice } = await loadFixture(deployFixture);
            await vault.connect(creator).transferGuardianship(alice.address);
            expect(await vault.pendingGuardian()).to.equal(alice.address);
        });
        it("9. acceptGuardianship через 2 дня", async function () {
            const { vault, creator, alice } = await loadFixture(deployFixture);
            await vault.connect(creator).transferGuardianship(alice.address);
            await time.increase(2 * 24 * 3600 + 1);
            await vault.connect(alice).acceptGuardianship();
            expect(await vault.guardian()).to.equal(alice.address);
        });
    });
    it("10. старый creator теряет права после accept", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        await expect(vault.connect(creator).transferCreatorship(alice.address))
            .to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("11. Guardian не может быть creator", async function () {
        const { vault, creator, guardian } = await loadFixture(deployFixture);
        await expect(vault.connect(creator).transferGuardianship(creator.address))
            .to.be.revertedWithCustomError(vault, "InvalidAddress");
    });
    it("12. acceptGuardianship сбрасывает pendingGuardian", async function () {
    const { vault, creator, alice } = await loadFixture(deployFixture);
    await vault.connect(creator).transferGuardianship(alice.address);
    await time.increase(2 * 24 * 3600 + 1);
    await vault.connect(alice).acceptGuardianship();
    expect(await vault.pendingGuardian()).to.equal(ethers.ZeroAddress);
});
    it("13. старый creator не может withdrawCreatorFees после смены", async function () {
        const { vault, ancr, alice, creator } = await loadFixture(deployFixture);
        // Заработаем комиссии
        await openSafe(vault, ancr, alice, { amount: ethers.parseEther("100") });
        await ancr.connect(alice).approve(await vault.getAddress(), ethers.parseEther("50"));
        await vault.connect(alice).depositToVault(1, ethers.parseEther("50"), P.code);
        const fee = await vault.creatorFees(await ancr.getAddress());
        // Передаём роль
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        // Старый creator пытается вывести
        await expect(vault.connect(creator).requestCreatorWithdraw(await ancr.getAddress(), creator.address, fee))
            .to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("10. старый creator теряет права после accept", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        await expect(vault.connect(creator).transferCreatorship(alice.address)).to.be.revertedWithCustomError(vault, "NotCreator");
    });
    it("11. acceptCreatorship сбрасывает pending", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        await time.increase(7 * 24 * 3600 + 1);
        await vault.connect(alice).acceptCreatorship();
        expect(await vault.pendingCreator()).to.equal(ethers.ZeroAddress);
    });
    it("12. acceptGuardianship сбрасывает pendingGuardian", async function () {
        const { vault, creator, alice } = await loadFixture(deployFixture);
        await vault.connect(creator).transferGuardianship(alice.address);
        await time.increase(2 * 24 * 3600 + 1);
        await vault.connect(alice).acceptGuardianship();
        expect(await vault.pendingGuardian()).to.equal(ethers.ZeroAddress);
    });
    it("13. transferCreatorship обновляет таймер при повторном", async function () {
        const { vault, creator, alice, bob } = await loadFixture(deployFixture);
        await vault.connect(creator).transferCreatorship(alice.address);
        const firstTimestamp = await vault.creatorshipRequestedAt();
        await time.increase(3600);
        await vault.connect(creator).transferCreatorship(bob.address);
        expect(await vault.creatorshipRequestedAt()).to.be.gt(firstTimestamp);
        expect(await vault.pendingCreator()).to.equal(bob.address);
    });
});
