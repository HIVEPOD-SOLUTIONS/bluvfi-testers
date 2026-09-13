# Contract Redeployment Instructions

## Prerequisites

1. **Set your deployer private key** (the wallet that will deploy the contract):
   
   **PowerShell:**
   ```powershell
   $env:DEPLOYER_PRIVATE_KEY = "your_private_key_without_0x_prefix"
   ```
   
   **Or create a `.env` file** in the project root:
   ```
   DEPLOYER_PRIVATE_KEY=your_private_key_without_0x_prefix
   ```

2. **Ensure you have testnet tBNB** in your deployer wallet for gas fees on BSC Testnet

## Step 2: Deploy the Contract

From the **project root** run:

**PowerShell:**
```powershell
npx hardhat ignition deploy ignition/modules/ModredIP.ts --network bscTestnet
```

**Or use the deployment script:**
```powershell
.\deploy.ps1
```

## Step 3: Update Contract Address

After deployment, you'll see output like:
```
✅ ModredIPModule#ModredIP deployed to: 0x...
```

1. **Copy the deployed contract address**

2. **Update addresses:** Either copy `ignition/deployments/chain-97/deployed_addresses.json` to `app/src/deployed_addresses.json`, or run `yarn install` in the `app/` folder (postinstall copies it). Or edit `app/src/deployed_addresses.json`:
   ```json
   {
     "ModredIPModule#ERC6551Account": "0x...",
     "ModredIPModule#ERC6551Registry": "0x...",
     "ModredIPModule#ModredIP": "NEW_DEPLOYED_ADDRESS_HERE"
   }
   ```

## Step 4: Restart Services

1. **Restart your backend server** (if running)
2. **Refresh your frontend** (or restart the dev server)

## Verification

After deployment, verify the contract has the `unstake` function:

1. Visit: https://testnet.bscscan.com/address/YOUR_NEW_CONTRACT_ADDRESS
2. Go to the "Contract" tab
3. Check for the `unstake` function in the "Write Contract" section

## Troubleshooting

### "already known" Error

If you get an `already known` error during deployment, it means there's a pending transaction with the same nonce. Solutions:

1. **Wait for pending transactions to confirm:**
   - Check your deployer address on the explorer: https://testnet.bscscan.com/address/YOUR_DEPLOYER_ADDRESS
   - Wait for any pending transactions to be confirmed (usually 1-2 minutes)
   - Then try deploying again

2. **Check nonce status:**
   ```powershell
   node check-nonce.js
   ```
   This will show if you have pending transactions.

3. **Wait and retry:**
   - Wait 2-3 minutes
   - Run the deployment command again

### Other Issues

- **"Missing env var DEPLOYER_PRIVATE_KEY"**: Make sure you set the environment variable before running the deploy command
- **"Insufficient funds"**: Make sure your deployer wallet has tBNB for gas
- **Network errors**: Check your internet connection and that the BNB Chain RPC endpoint is accessible

## What Changed

The new contract includes:
- `unstake()` function - allows arbitrators to withdraw their stake
- `ArbitratorUnstaked` event - emitted when an arbitrator unstakes
- Safety check - prevents unstaking if assigned to active disputes

