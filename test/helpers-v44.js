const { ethers } = require("hardhat");

const P = {
    code:       "MyMainCode123!@#",
    antiPhrase: "AnchorIsLegit!Verify",
    recovery:   "RecoveryEmergency2026",
    confirm:    "ConfirmCode2026!Secure",
    newCode:       "NewMainCodeForRotation99",
    newAntiPhrase: "NewAntiPhish2026Verify!",
    newRecovery:   "NewRecoveryEmergency2026!",
    weak: "short",
    tooLong: "x".repeat(65),
};

async function deployFixture() {
    const [creator, guardian, alice, bob, carol, dave, eve, frank] = await ethers.getSigners();
    const Ancr = await ethers.getContractFactory("MockANCR", creator);
    const ancr = await Ancr.deploy(ethers.parseEther("10000000"));
    await ancr.waitForDeployment();
    const Fot = await ethers.getContractFactory("MockFOT", creator);
    const fot = await Fot.deploy(ethers.parseEther("10000000"));
    await fot.waitForDeployment();
    const Vault = await ethers.getContractFactory("AnchorVaultV44", creator);
    const vault = await Vault.deploy(await ancr.getAddress(), guardian.address);
    await vault.waitForDeployment();
    for (const u of [alice, bob, carol, dave, eve, frank]) {
        await ancr.transfer(u.address, ethers.parseEther("100000"));
        await fot.transfer(u.address, ethers.parseEther("100000"));
    }
    return { vault, ancr, fot, creator, guardian, alice, bob, carol, dave, eve, frank };
}

async function openSafe(vault, token, user, opts = {}) {
    const signers = await ethers.getSigners();
    const emergencyAddress = opts.emergencyAddress ?? signers[7].address;
    if (await vault.globalEmergency(user.address) === ethers.ZeroAddress) {
        await vault.connect(user).setGlobalEmergency(emergencyAddress);
    }
    const amount = opts.amount ?? ethers.parseEther("100");
    const level = opts.level ?? 0;
    await token.connect(user).approve(await vault.getAddress(), amount);
    const params = {
        name: opts.name ?? "TestVault",
        code: opts.code ?? P.code,
        antiPhrase: opts.antiPhrase ?? P.antiPhrase,
        recovery: opts.recovery ?? P.recovery,
        amount
    };
    const tx = await vault.connect(user).openVault(await token.getAddress(), params, level);
    await tx.wait();
    const vaultId = await vault.userVaultCount(user.address);
    return { vaultId: Number(vaultId), amount };
}

module.exports = { deployFixture, openSafe, P };	
