# Contract Deployment Guide

> **BSC Testnet:** The `ignition/deployments/chain-97/` folder is keyed by chain ID. **Deploy fresh contracts on BSC Testnet** and update `app/src/deployed_addresses.json` before relying on addresses in production.

## Current Contract Status

The application is currently using the V2 contract:
- **ModredIP (Bluvfi app)**: `0x667C61aa019EFEbECC88deF8fB3AFa0828A55Edf`
- **Contract Key**: `ModredIPModule#ModredIP` (maintained for compatibility)
- **Status**: ✅ Active and verified to have `registerIP` function

**Note**: The contract key name "ModredIPModule#ModredIP" is maintained for backward compatibility; the application is branded as **Bluvfi**.

## Option 2: Deploy a New Contract

### Prerequisites

1. Install dependencies (from project root):
   ```bash
   yarn install
   ```

2. Set up environment variable:
   Create a `.env` file or set:
   ```
   DEPLOYER_PRIVATE_KEY=your_private_key_here
   ```

### Deploy to BSC Testnet (Chapel, chain ID 97)

**Run all deploy commands from the repository root** (the folder that contains `hardhat.config.ts` and the `ignition/` directory). If you run from `backend/`, `app/`, or another subfolder, Hardhat will fail with *Could not find a module file* because `ignition/modules/ModredIP.ts` is resolved relative to your current directory.

#### IGN900: deployment chain cannot be changed

If you see **`IGN900: The deployment's chain cannot be changed between runs`** (e.g. a previous run used Creditcoin `102031` but you now deploy to BSC testnet `97`), Ignition’s saved state under `ignition/deployments/chain-*` no longer matches the network. Fix it by either:

- **Recommended:** wipe state and deploy again:
  ```bash
  npm run deploy:modred:bsc-testnet:reset
  ```
  (`--reset` clears Ignition’s deployment journal for that module run.)

- **Or** delete the folder for the target chain (e.g. `ignition/deployments/chain-97`) and run a normal deploy again.

1. **Deploy using Hardhat Ignition:**
   ```bash
   cd /path/to/lobos   # project root
   npx hardhat ignition deploy ./ignition/modules/ModredIP.ts --network bscTestnet
   ```
   Or use the npm script (also from project root):
   ```bash
   npm run deploy:modred:bsc-testnet
   ```
   For BSC mainnet: `--network bsc` (chain ID 56).

2. **After deployment**, update `app/src/deployed_addresses.json` (or run `yarn install` in `app/` to copy from `ignition/deployments/chain-97/`):
   ```json
   {
     "ModredIPModule#ERC6551Account": "0x...",
     "ModredIPModule#ERC6551Registry": "0x...",
     "ModredIPModule#ModredIP": "NEW_DEPLOYED_ADDRESS_HERE"
   }
   ```
   
   **Note**: The key "ModredIPModule#ModredIP" is maintained for compatibility; the application name is **Bluvfi**.

3. **Verify the contract** (optional; set `BSCSCAN_API_KEY` in Hardhat vars or replace placeholder in `hardhat.config.ts`):
   ```bash
   npx hardhat verify --network bscTestnet DEPLOYED_ADDRESS "REGISTRY_ADDRESS" "ACCOUNT_IMPL_ADDRESS" 97 "PLATFORM_FEE_COLLECTOR"
   ```

### Deployment Steps

1. Make sure you have testnet tBNB in your deployer wallet for gas fees ([faucet](https://testnet.bnbchain.org/faucet-smart))
2. Run the deployment command above
3. Copy the deployed contract address from the output
4. Update `deployed_addresses.json` with the new address
5. Restart your backend and frontend

## Option 3: Use Testing Mode (Temporary)

If you just want to test IPFS uploads without contract registration:

1. In `App.tsx` line ~1157, change:
   ```typescript
   skipContractCall: true
   ```

2. Or set environment variable in backend:
   ```
   SKIP_CONTRACT_CALL=true
   ```

## Verifying Contract Functions

To check if a contract has the `registerIP` function:

1. Visit: https://testnet.bscscan.com/address/CONTRACT_ADDRESS
2. Go to the "Contract" tab
3. Check the "Read Contract" or "Write Contract" section
4. Look for `registerIP` function

## Contract Source

The contract source is at: `contracts/ModredIP.sol`

### Key Functions

**IP Registration:**
```solidity
function registerIP(
    string memory ipHash,
    string memory metadata,
    bool isEncrypted
) public returns (uint256)
```

**License Minting:**
```solidity
function mintLicense(
    uint256 tokenId,
    uint256 royaltyPercentage,
    uint256 duration,
    bool commercialUse,
    string memory terms
) public returns (uint256)
```

**Arbitrator Management:**
```solidity
function registerArbitrator() public payable
function unstake() public nonReentrant
```

## Contract Features

- ✅ IP Asset Registration with IPFS metadata
- ✅ License Management (one license per IP enforced)
- ✅ Revenue Distribution and Royalty Claims
- ✅ Dispute Resolution with Arbitration System
- ✅ Arbitrator Registration and Unstaking
- ✅ Reputation System for Arbitrators
