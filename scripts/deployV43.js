const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ANCR     = "0x2eC26403084A4b3102059C70E349409288c1B1EE";
const GUARDIAN = "0x528460cED8Ec256FF2c9f8Ac359f4fa0150996C8";
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

    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "AnchorVaultV43.sol", "AnchorVaultV43.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log("Deploying AnchorVaultV43...");
    const contract = await factory.deploy(ANCR, GUARDIAN);
    console.log("Tx hash:", contract.deploymentTransaction().hash);

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ AnchorVaultV43 deployed at:", address);
    fs.writeFileSync("deployments-sepolia.json", JSON.stringify({
        chainId: 11155111, ancr: ANCR, guardian: GUARDIAN,
        v43: address, deployer: wallet.address,
        txHash: contract.deploymentTransaction().hash
    }, null, 2));
    console.log("Saved: deployments-sepolia.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
