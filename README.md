# Bluvfi – IP Management Platform

Decentralized intellectual property management on **BNB Smart Chain (BSC Testnet)**: register IP assets (ERC-6551), mint licenses, collect royalties, monitor infringements (Yakoa), and resolve disputes—all from one dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![BNB Chain](https://img.shields.io/badge/BNB%20Chain-F0B90B?style=flat&logo=binance&logoColor=white)](https://www.bnbchain.org/)

---

## Table of Contents

- [Vision & Commitment](#vision--commitment)
  - [Vision](#vision)
  - [Mission](#mission)
  - [Commitment](#commitment)
- [Schedule](#schedule)
- [Project Structure](#project-structure)
- [Implementation Summary](#implementation-summary)
- [Network & Contracts](#network--contracts)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
  - [Environment Variables](#environment-variables)
  - [Scripts](#scripts)
  - [Documentation](#documentation)
- [License](#license)

---

## Vision & Commitment

### Vision

To democratize intellectual property management by creating a decentralized, transparent, and automated platform that empowers creators to protect, monetize, and manage their IP assets with unprecedented efficiency.

### Mission

Bluvfi revolutionizes IP management by combining blockchain technology with AI-powered infringement detection, creating a comprehensive ecosystem where creators can register, license, monetize, and protect their intellectual property with built-in enforcement mechanisms.

### Commitment

We are committed to building in the open, putting creators first, and delivering public-good infrastructure for IP on **BNB Smart Chain**: transparent on-chain provenance, fair royalty flows, and enforceable rights without gatekeepers. We ship iteratively, document clearly, and welcome contributions that align with this mission.

---

## Schedule

| Phase | Scope | Status |
|-------|--------|--------|
| **Phase 1 – Foundation** | Smart contracts (ModredIP, ERC-6551), frontend, backend, IPFS, Yakoa infringement, arbitration | Done |
| **Phase 2 – Launch & hardening** | Testnet launch, documentation, deployment automation, first users | Done |
| **Phase 3 – Advanced** | License templates, royalty preview, infringement dashboard | Done |
| **Phase 4 – Mobile & API** | Mobile app, public API for third-party integrations | In progress |
| **Phase 5+** | Marketplace, analytics, multi-chain, enterprise | Planned |

We are committed to completing Phase 4 (mobile, API), then advancing toward Phase 5+. For full roadmap and team, see [PROJECT_DETAILS.md](PROJECT_DETAILS.md).

---

## Project Structure

```
lobos/
├── app/                    # React frontend (Vite + Thirdweb)
│   ├── public/             # Static assets (e.g. Bluvfiv2.jpg)
│   ├── src/
│   │   ├── deployed_addresses.json   # Contract addresses (from Ignition)
│   │   └── ...
│   └── README.md           # App-specific docs
├── backend/                # Node + Express API (BNB Chain, Yakoa, IPFS)
│   ├── src/
│   │   ├── index.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   └── ...
│   └── README.md           # Backend API & env docs
├── contracts/              # Solidity
├── ignition/               # Hardhat Ignition deployment
│   ├── modules/
│   └── deployments/chain-97/
│       └── deployed_addresses.json   # Canonical contract addresses
├── hardhat.config.ts       # Hardhat + BSC Testnet / BSC mainnet
├── DEPLOYMENT_GUIDE.md     # Contract deploy & verify
├── PROJECT_DETAILS.md      # Vision, team, roadmap
└── README.md               # This file
```

---

## Implementation Summary

| Layer | Stack |
|-------|--------|
| **Network** | BSC Testnet (Chapel), **Chain ID 97**. RPC: `https://data-seed-prebsc-1-s1.binance.org:8545/`. Explorer: [BscScan Testnet](https://testnet.bscscan.com/). |
| **Frontend** | React 18, Vite, TypeScript. Thirdweb for wallet connect; Viem for on-chain reads/writes (IP assets, licenses, pay revenue, claim royalties). Logo/favicon: `app/public/Bluvfiv2.jpg`. |
| **Backend** | Node.js, Express, Viem. Registers IP on-chain (ModredIP), mints licenses, Pinata for IPFS, Yakoa for infringement (when configured). |
| **Contracts** | ModredIP (ERC-721 + ERC-6551), ERC6551Registry, ERC6551Account. Deployed via Hardhat Ignition. |
| **IP registration** | App uploads NFT metadata to IPFS and sends data to the backend; the contract stores registration so on-chain state and explorers stay consistent with your deployment. |
| **Branding** | “Bluvfi” in product copy. API accepts **`lobosContractAddress`** (legacy **`modredIpContractAddress`** supported on register). |

---

## Network & Contracts

| | |
|--|--|
| **Network** | BSC Testnet (Chapel) |
| **Chain ID** | `97` |
| **RPC** | `https://data-seed-prebsc-1-s1.binance.org:8545/` |
| **Explorer** | [https://testnet.bscscan.com/](https://testnet.bscscan.com/) |
| **Native token** | tBNB ([faucet](https://testnet.bnbchain.org/faucet-smart)) |

### Deployed contracts (BSC Testnet)

| Contract key | Role | Address |
|--------------|------|---------|
| `ModredIPModule#ModredIP` | Main contract (ERC-721, IP registration, licenses, royalties, disputes) | `0x667C61aa019EFEbECC88deF8fB3AFa0828A55Edf` |
| `ModredIPModule#ERC6551Registry` | ERC-6551 registry (token-bound accounts) | `0x0d5ab973475A411213fb57Ad6Ac216995924F62F` |
| `ModredIPModule#ERC6551Account` | ERC-6551 account implementation | `0xC022Af5441732c2b3776dF9e66C96cB98eCC6F8E` |

Addresses are in [`app/src/deployed_addresses.json`](app/src/deployed_addresses.json) (synced from `ignition/deployments/chain-97/deployed_addresses.json` on `yarn install` in `app/` when present). To redeploy, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Yarn** (or npm)
- **Wallet** with BSC Testnet (tBNB for gas — [faucet](https://testnet.bnbchain.org/faucet-smart))
- **Thirdweb** Client ID (for the app)
- **Pinata** JWT (for IPFS uploads)
- **Yakoa** API key (optional; for infringement monitoring)

### Quick Start

#### 1. Clone and install

```bash
git clone https://github.com/your-org/lobos.git
cd lobos
yarn install
```

#### 2. Frontend (`app`)

```bash
cd app
yarn install
```

Create `app/.env`:

```env
VITE_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

Start the dev server:

```bash
yarn dev
```

The app runs at **http://localhost:5173** (or the port Vite prints).

#### 3. Backend

```bash
cd backend
yarn install
```

Create `backend/.env` (see [Environment Variables](#environment-variables)):

```env
WALLET_PRIVATE_KEY=your_private_key
PINATA_JWT=your_pinata_jwt
# Optional: RPC_PROVIDER_URL, YAKOA_* for infringement
```

Start the API:

```bash
yarn start
```

Backend runs at **http://localhost:5000**.

#### 4. Connect the app to the backend

Set the backend URL in the app (e.g. in `app/src/App.tsx` or via env). Connect your wallet to **BSC Testnet** (chain ID **97**) and use the dashboard.

### Environment Variables

| Location | Purpose |
|----------|---------|
| **app/** | `VITE_THIRDWEB_CLIENT_ID` — Thirdweb client ID. See [app/README.md](app/README.md). |
| **backend/** | Required: `WALLET_PRIVATE_KEY`, `PINATA_JWT`. Optional: `RPC_PROVIDER_URL`, `YAKOA_API_KEY`, `YAKOA_SUBDOMAIN`, `YAKOA_NETWORK`. See [backend/README.md](backend/README.md). |
| **Root** | `DEPLOYER_PRIVATE_KEY` (Hardhat vars) for contract deploy. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). |

### Scripts

| Where | Command | Description |
|-------|---------|-------------|
| **Root** | `yarn install` | Install root deps (e.g. Hardhat). |
| **Root** | `npx hardhat ignition deploy ./ignition/modules/ModredIP.ts --network bscTestnet` | Deploy contracts (see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)). |
| **app/** | `yarn dev` | Start Vite dev server. |
| **app/** | `yarn build` | Production build; copies `deployed_addresses.json` from `ignition/deployments/chain-97/` when present. |
| **backend/** | `yarn start` | Run API with `ts-node`. |

### Documentation

- **[app/README.md](app/README.md)** — Frontend features, usage, contract addresses.
- **[backend/README.md](backend/README.md)** — API endpoints, env vars, network config.
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** — Deploy and verify contracts on BSC Testnet.
- **[PROJECT_DETAILS.md](PROJECT_DETAILS.md)** — Vision, team, roadmap, and project description.

---

## License

This project is licensed under the [MIT License](LICENSE).

**Built with ❤️ by the Bluvfi team**
