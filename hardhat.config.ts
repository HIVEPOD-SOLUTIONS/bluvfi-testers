import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-verify";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";

if (!vars.has("DEPLOYER_PRIVATE_KEY")) {
  console.error("Missing env var DEPLOYER_PRIVATE_KEY");
}

const deployerPrivateKey = vars.get("DEPLOYER_PRIVATE_KEY");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, // Minimize deployment bytecode size (fits EIP-170 24KB limit on many networks)
      },
    },
  },

  networks: {
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [deployerPrivateKey],
      chainId: 56,
      timeout: 120000,
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [deployerPrivateKey],
      chainId: 97,
      timeout: 120000,
      gas: 30_000_000,
    },
  },
  etherscan: {
    apiKey: {
      bsc: "YOUR_BSCSCAN_API_KEY",
      bscTestnet: "YOUR_BSCSCAN_API_KEY",
    },
    customChains: [
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com/",
        },
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com/",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
