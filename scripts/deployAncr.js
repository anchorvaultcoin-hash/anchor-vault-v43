const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const RPC = "https://1rpc.io/sepolia";

function ask(q) {
    return new Promise(r => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(q, a => { rl.close(); r(a.trim()); });
    });
}

async function main() {
    let pk = process.env.PRIVATE_KEY;
    if (!pk) pk = await ask("Введи приватник (0x...): ");
    if (!pk.startsWith("0x")) pk = "0x" + pk;

    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(pk, provider);
    console.log("Deployer:", wallet.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "MockANCR.sol", "MockANCR.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log("Deploying MockANCR (1M supply)...");
    const initialSupply = ethers.parseEther("1000000");
    const contract = await factory.deploy(initialSupply);
    console.log("Tx:", contract.deploymentTransaction().hash);

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ ANCR deployed at:", address);

    fs.writeFileSync(path.join(__dirname, "..", "ancr-sepolia.json"), JSON.stringify({
        chainId: 11155111,
        ancr: address,
        deployer: wallet.address,
        tx: contract.deploymentTransaction().hash
    }, null, 2));
    console.log("Saved: ancr-sepolia.json");
}

main().catch(e => { console.error(e); process.exit(1); });
