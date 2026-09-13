# Bluvfi Frontend

A React-based frontend for the Bluvfi intellectual property management system on BSC Testnet (BNB Chain).

## Features

### 1. Register IP Asset
- Mint an NFT representing ownership of your intellectual property
- Register the NFT as an IP Asset on the Bluvfi system
- Upload IP content and metadata to IPFS
- Set encryption flags for sensitive content

### 2. Mint License Tokens
- Create license tokens from registered IP Assets
- **One License Per IP**: Only one license can be minted per IP asset (enforced validation)
- **Advanced License Templates**: Choose from 8 predefined templates:
  - 💼 Commercial License - Full commercial rights with attribution
  - 🚫 Non-Commercial License - Non-commercial use only
  - 📝 Creative Commons BY - Attribution required
  - 🎨 Creative Commons BY-NC - Attribution, non-commercial
  - 🔗 Creative Commons BY-SA - Attribution-ShareAlike
  - 🔒 All Rights Reserved - Strict license, no derivatives
  - 🌍 Public Domain - No restrictions
  - ⭐ Exclusive Commercial - High royalty, exclusive rights
  - ⚙️ Custom - Manual configuration
- Templates auto-fill all license parameters and can be customized
- Set royalty percentages (1-100%)
- Define license duration in seconds
- Specify commercial use permissions
- Attach license terms (stored on IPFS)

### 3. Pay Revenue
- Send payments to IP Assets
- **Automated Royalty Calculation**: Real-time preview of how royalties will be distributed
- **Royalty Breakdown**: See platform fees, license holder shares, and IP owner share before payment
- Automatic royalty distribution to license holders
- Support for both tips and revenue sharing

### 4. Claim Royalties
- License holders can claim their accumulated royalties
- Automatic calculation based on royalty percentages
- Direct transfer to wallet addresses

### 5. Infringement Detection
- **Automated Monitoring**: Periodic scanning for potential IP infringements
- **Real-time Dashboard**: View infringement status for all your IP assets
- **Severity Analysis**: Automatic classification of infringement severity
- **Detailed Reports**: See in-network and external platform infringements
- **Action Recommendations**: Get AI-suggested steps based on infringement type
- **Auto-Monitoring**: Enable automatic periodic checks with configurable intervals
- **Instant Alerts**: Receive notifications when new infringements are detected

### 6. Arbitration System
- **Register as Arbitrator**: Stake tBNB to become an arbitrator
- **Unstake**: Withdraw stake when no active disputes assigned
- **Submit Decisions**: Vote on disputes (uphold or reject)
- **Auto-Resolution**: Disputes resolve automatically when majority is clear
- **Reputation System**: Earn reputation for correct decisions

## Getting Started

1. **Install Dependencies**
   ```bash
   yarn install
   ```

2. **Set Environment Variables**
   - Get a Thirdweb Client ID from [thirdweb.com](https://thirdweb.com)
   - Update `src/main.tsx` with your client ID

3. **Start Development Server**
   ```bash
   yarn dev
   ```

4. **Connect Wallet**
   - Use the Connect button to link your wallet
   - Supported wallets: MetaMask, Coinbase Wallet, Trust Wallet, and more

## Usage Guide

### Registering an IP Asset
1. Prepare your IP content and upload to IPFS
2. Upload metadata (JSON) to IPFS
3. Enter the IPFS hashes in the "Register IP Asset" section
4. Check "Encrypted Content" if your IP is encrypted
5. Click "Register IP" and confirm the transaction

### Creating Licenses
1. Select an existing IP Asset from the dropdown
2. **Choose a License Template** (or select "Custom" for manual configuration):
   - Select from predefined templates that auto-configure all settings
   - Templates include Commercial, Non-Commercial, Creative Commons variants, and more
   - You can customize any template after selection
   - Use "Reset to Template" to restore original template values
3. Review and adjust settings as needed:
   - Royalty percentage (e.g., 10 for 10%)
   - License duration (minimum 1 hour = 3600 seconds)
   - Commercial use permissions
   - Derivatives and attribution settings
4. Click "Mint License" and confirm the transaction

### Paying Revenue
1. Select the target IP Asset
2. Enter the payment amount in tBNB
3. **View Royalty Breakdown**: The system automatically calculates and displays:
   - Platform fee (2.5%)
   - Each license holder's share based on their royalty percentage
   - IP owner's remaining share
4. Review the breakdown and click "Pay Revenue"
5. Confirm the transaction
6. Royalties are automatically distributed to license holders on-chain

### Claiming Royalties
1. Select the IP Asset you have licenses for
2. **View Accumulated Royalties**: See your total claimable amount for the selected IP
3. The system displays:
   - Your accumulated royalties (if any)
   - Your active licenses and their royalty rates
   - Claimable amount in tBNB
4. Click "Claim Royalties" (enabled only if you have claimable royalties)
5. Confirm the transaction to receive your accumulated royalties

### Monitoring Infringements
1. Navigate to the "Infringement Detection" tab
2. Select an IP Asset to monitor
3. **Enable Auto-Monitoring**: Toggle automatic periodic checks (default: every 5 minutes)
4. **Check Now**: Manually trigger an immediate infringement scan
5. **View Results**: See detailed infringement reports including:
   - Severity level (Low, Medium, High, Critical)
   - In-network infringements (on-chain)
   - External platform infringements (off-chain)
   - Similarity scores and detection timestamps
   - Recommended actions based on infringement type
6. **Take Action**: Follow recommended steps such as:
   - Raising disputes through arbitration
   - Sending DMCA takedown notices
   - Documenting evidence
   - Contacting infringing parties

## Technical Details

- **Blockchain**: BSC Testnet (Chain ID: 97)
- **Smart Contract**: ModredIP (Bluvfi)
- **Wallet Integration**: Thirdweb SDK
- **IPFS**: Used for storing IP content, metadata, and license terms
- **ERC-6551**: Token-bound accounts for IP management

## Contract Addresses

Current deployed contract addresses are stored in `src/deployed_addresses.json`:
- **ModredIP (Bluvfi)**: `0x667C61aa019EFEbECC88deF8fB3AFa0828A55Edf` (ModredIPModule#ModredIP)
- **ERC6551Registry**: `0x0d5ab973475A411213fb57Ad6Ac216995924F62F`
- **ERC6551Account**: `0xC022Af5441732c2b3776dF9e66C96cB98eCC6F8E`

**Note**: The contract key "ModredIPModule#ModredIP" is maintained for compatibility, but the application name is "Bluvfi".

## Security Features

- Reentrancy protection
- Access control for admin functions
- Dispute resolution system with arbitration
- Encrypted content support
- On-chain royalty tracking
- License validation (one license per IP)
- Nonce management with retry logic
- Transaction error handling and recovery

## Support

For issues or questions, please refer to the main project documentation or create an issue in the repository.
