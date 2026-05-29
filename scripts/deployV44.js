const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ANCR     = "0x5DD724204B36E95Fd7e5578504e145FB876716b1";
const GUARDIAN = "0x13ACB3b72c62A969753Ca4Ea04666B0e43c96dDa";
const RPC      = "https://1rpc.io/sepolia";

function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
    });
}

async function main() {
    let pk = process.env.PRIVATE_KEY;
    if (!pk) {
        pk = await ask("Введи приватный ключ (0x...): ");
    }
    if (!pk.startsWith("0x")) pk = "0x" + pk;

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(pk, provider);
    console.log("Deployer:", wallet.address);

    const bal = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(bal), "ETH");

    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "AnchorVaultV44.sol", "AnchorVaultV44.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log("Deploying AnchorVaultV44...");
    console.log("  ANCR    :", ANCR);
    console.log("  GUARDIAN:", GUARDIAN);

    const contract = await factory.deploy(ANCR, GUARDIAN);
    console.log("Tx hash:", contract.deploymentTransaction().hash);

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ AnchorVaultV44 deployed at:", address);
    fs.writeFileSync("deployments-sepolia-v44.json", JSON.stringify({
        chainId: 11155111,
        ancr: ANCR,
        guardian: GUARDIAN,
        v44: address,
        deployer: wallet.address,
        txHash: contract.deploymentTransaction().hash
    }, null, 2));
    console.log("Saved: deployments-sepolia-v44.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
