const fs = require("fs");
const path = require("path");

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const NM = path.join(__dirname, "..", "node_modules");

const sources = {};
const queue = [];

function pullImports(content) {
    const imports = [];
    const re = /import\s+(?:\{([^}]+)\}\s+)from\s+["']([^"']+)["']/g;
    const re2 = /import\s+["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(content)) !== null) imports.push(m[2]);
    while ((m = re2.exec(content)) !== null) {
        if (!imports.includes(m[1])) imports.push(m[1]);
    }
    return imports;
}

function resolveImport(fromKey, imp) {
    // fromKey e.g. "@openzeppelin/contracts/token/ERC20/ERC20.sol"
    // imp e.g. "../../utils/Context.sol" or "@openzeppelin/..."
    if (imp.startsWith("@")) return imp;
    if (imp.startsWith(".")) {
        const dir = path.posix.dirname(fromKey);
        return path.posix.normalize(path.posix.join(dir, imp));
    }
    return imp;
}

function addFile(key, content) {
    if (sources[key]) return;
    sources[key] = { content };
    const imps = pullImports(content);
    for (const imp of imps) {
        const resolved = resolveImport(key, imp);
        if (!resolved.startsWith("@") && !resolved.startsWith("contracts/")) {
            console.error("UNRESOLVED:", resolved, "from", key);
            continue;
        }
        queue.push(resolved);
    }
}

// 1. Local contracts
for (const f of fs.readdirSync(CONTRACTS_DIR)) {
    if (f.endsWith(".sol")) {
        const key = "contracts/" + f;
        const content = fs.readFileSync(path.join(CONTRACTS_DIR, f), "utf8");
        addFile(key, content);
    }
}

// 2. Process queue
while (queue.length > 0) {
    const key = queue.shift();
    if (sources[key]) continue;
    if (!key.startsWith("@")) continue;
    const fp = path.join(NM, key);
    if (!fs.existsSync(fp)) { console.error("MISSING:", fp); continue; }
    const content = fs.readFileSync(fp, "utf8");
    addFile(key, content);
}

const input = {
    language: "Solidity",
    sources: sources,
    settings: {
        viaIR: true,
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
            "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"] }
        }
    }
};

const outPath = path.join(__dirname, "..", "v44-verify-input.json");
fs.writeFileSync(outPath, JSON.stringify(input, null, 2));
console.log("Saved:", outPath);
console.log("Sources:", Object.keys(sources).length);
Object.keys(sources).sort().forEach(s => console.log("  -", s));