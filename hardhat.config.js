"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@nomicfoundation/hardhat-toolbox-viem");
require("@nomicfoundation/hardhat-verify");
const config_1 = require("hardhat/config");
if (!config_1.vars.has("DEPLOYER_PRIVATE_KEY")) {
    console.error("Missing env var DEPLOYER_PRIVATE_KEY");
}
const deployerPrivateKey = config_1.vars.get("DEPLOYER_PRIVATE_KEY");
const config = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1,
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
            gas: 30000000,
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
exports.default = config;
