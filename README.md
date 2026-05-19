# AnchorVault V43 — локальная среда

Готовый проект под Hardhat 2 + локальный solc (работает за провайдером, блокирующим solc download).

## Структура

```
av43/
├── contracts/                # Solidity-исходники
│   ├── AnchorVaultV43.sol
│   ├── MockANCR.sol
│   └── MockFOT.sol
├── scripts/
│   ├── deployLocal.js        # деплой в hardhat node
│   └── deployV43.js          # деплой в Sepolia
├── test/
│   ├── helpers.js            # общие фикстуры
│   └── 00-smoke.test.js      # 8 базовых тестов
├── compile.js                # локальная компиляция (без сети)
├── hardhat.config.js
└── package.json
```

## Установка (один раз)

```bash
npm install --legacy-peer-deps
```

## Команды

```bash
# Компиляция
npm run compile

# Тесты (включая компиляцию)
npm test

# Локальный node (терминал 1)
npm run node

# Деплой в локальный node (терминал 2)
npm run deploy:local

# Деплой в Sepolia
PRIVATE_KEY=0x... npm run deploy:sepolia
```

## Зависимости версий

- Node 22+
- hardhat 2.22+
- solc 0.8.20 (npm package, локально)
- ethers 6.x
- @openzeppelin/contracts 5.x

## Особенности

- `compile.js` использует solc напрямую без скачивания (для окружений с блокировкой `binaries.soliditylang.org`)
- `npm test` всегда вызывает `node compile.js` + `hardhat test --no-compile`
- `viaIR: true` включён в компиляции (нужно для V43)

## Адреса локального деплоя (детерминированные)

```
MockANCR : 0x5FbDB2315678afecb367f032d93F642f64180aa3
MockFOT  : 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
V43      : 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Deployer : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Hardhat #0)
Guardian : 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Hardhat #1)
```
