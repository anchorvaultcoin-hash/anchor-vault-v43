// scripts/deployLocal.js
// Запуск: 
//   терминал 1: npx hardhat node
//   терминал 2: npx hardhat run scripts/deployLocal.js --network localhost

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const { ethers } = hre;
    const [deployer, guardian] = await ethers.getSigners();

    console.log("=== LOCAL DEPLOY ===");
    console.log("Deployer:", deployer.address);
    console.log("Guardian:", guardian.address);

    const Ancr = await ethers.getContractFactory("MockANCR");
    const ancr = await Ancr.deploy(ethers.parseEther("1000000"));
    await ancr.waitForDeployment();
    const ancrAddr = await ancr.getAddress();
    console.log("MockANCR  :", ancrAddr);

    const Fot = await ethers.getContractFactory("MockFOT");
    const fot = await Fot.deploy(ethers.parseEther("1000000"));
    await fot.waitForDeployment();
    const fotAddr = await fot.getAddress();
    console.log("MockFOT   :", fotAddr);

    const V43 = await ethers.getContractFactory("AnchorVaultV43");
    const v43 = await V43.deploy(ancrAddr, guardian.address);
    await v43.waitForDeployment();
    const v43Addr = await v43.getAddress();
    console.log("V43       :", v43Addr);

    const out = {
        chainId: 31337,
        rpc: "http://127.0.0.1:8545",
        ancr: ancrAddr,
        fot: fotAddr,
        v43: v43Addr,
        deployer: deployer.address,
        guardian: guardian.address
    };
    fs.writeFileSync(path.join(__dirname, "..", "deployments-local.json"), JSON.stringify(out, null, 2));
    console.log("\n✅ Saved: deployments-local.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
