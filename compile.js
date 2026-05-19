// compile.js — локальная компиляция через solc-js (без сетевых запросов)
// Запуск: node compile.js
// Кладёт артефакты в artifacts/contracts/<Name>.sol/<Name>.json в формате Hardhat

const fs = require('fs');
const path = require('path');
const solc = require('solc');

const SOURCES_DIR = path.join(__dirname, 'contracts');
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');
const NODE_MODULES = path.join(__dirname, 'node_modules');

function readSource(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// Резолвер импортов (OpenZeppelin из node_modules)
function findImports(importPath) {
    try {
        // OpenZeppelin
        if (importPath.startsWith('@openzeppelin/')) {
            const fullPath = path.join(NODE_MODULES, importPath);
            return { contents: fs.readFileSync(fullPath, 'utf8') };
        }
        // Локальные импорты
        const localPath = path.join(SOURCES_DIR, importPath);
        if (fs.existsSync(localPath)) {
            return { contents: fs.readFileSync(localPath, 'utf8') };
        }
        return { error: `Not found: ${importPath}` };
    } catch (e) {
        return { error: `Read error: ${importPath} - ${e.message}` };
    }
}

function collectSources(dir, baseDir = dir) {
    const sources = {};
    for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) {
            Object.assign(sources, collectSources(fp, baseDir));
        } else if (f.endsWith('.sol')) {
            const rel = path.relative(baseDir, fp);
            sources[rel] = { content: readSource(fp) };
        }
    }
    return sources;
}

function compile() {
    console.log('Compiler version:', solc.version());

    const sources = collectSources(SOURCES_DIR);
    console.log('Sources:', Object.keys(sources).join(', '));

    const input = {
        language: 'Solidity',
        sources: sources,
        settings: {
            viaIR: true,
            optimizer: { enabled: true, runs: 200 },
            outputSelection: {
                '*': {
                    '*': [
                        'abi',
                        'evm.bytecode.object',
                        'evm.deployedBytecode.object',
                        'evm.methodIdentifiers'
                    ]
                }
            }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    // Ошибки/предупреждения
    let hasErrors = false;
    if (output.errors) {
        for (const err of output.errors) {
            if (err.severity === 'error') {
                hasErrors = true;
                console.error('❌', err.formattedMessage);
            } else {
                console.warn('⚠️', err.formattedMessage);
            }
        }
    }
    if (hasErrors) { process.exit(1); }

    // Сохраняем артефакты
    for (const fileName in output.contracts) {
        for (const contractName in output.contracts[fileName]) {
            const c = output.contracts[fileName][contractName];
            // Только локальные контракты (не node_modules)
            if (!sources[fileName]) continue;

            const outDir = path.join(ARTIFACTS_DIR, 'contracts', fileName);
            fs.mkdirSync(outDir, { recursive: true });

            // Hardhat-формат
            const artifact = {
                _format: 'hh-sol-artifact-1',
                contractName: contractName,
                sourceName: 'contracts/' + fileName,
                abi: c.abi,
                bytecode: '0x' + c.evm.bytecode.object,
                deployedBytecode: '0x' + c.evm.deployedBytecode.object,
                linkReferences: {},
                deployedLinkReferences: {}
            };
            const outPath = path.join(outDir, contractName + '.json');
            fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
            console.log('✅', contractName, '→', path.relative(__dirname, outPath));

            // dbg.json (требуется Hardhat для loadArtifact)
            const dbg = { _format: 'hh-sol-dbg-1', buildInfo: '../../../build-info/dummy.json' };
            fs.writeFileSync(path.join(outDir, contractName + '.dbg.json'), JSON.stringify(dbg));
        }
    }

    // build-info заглушка (Hardhat ищет)
    const buildInfoDir = path.join(ARTIFACTS_DIR, 'build-info');
    fs.mkdirSync(buildInfoDir, { recursive: true });
    fs.writeFileSync(path.join(buildInfoDir, 'dummy.json'), JSON.stringify({
        _format: 'hh-sol-build-info-1',
        id: 'dummy',
        solcVersion: '0.8.20',
        solcLongVersion: '0.8.20+commit.a1b79de6',
        input: input,
        output: { contracts: {}, sources: {} }
    }));

    console.log('\n✅ Compilation done');
}

compile();
