"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOCK_EXPLORER_URL = exports.NATIVE_TOKEN_ADDRESS = exports.walletClient = exports.publicClient = exports.account = exports.networkInfo = void 0;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// BNB Smart Chain — BSC Testnet (Chapel)
const bnbChain = {
    id: 97,
    name: 'BNB Smart Chain Testnet',
    nativeCurrency: {
        name: 'BNB',
        symbol: 'tBNB',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
        },
        public: {
            http: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
        },
    },
    blockExplorers: {
        default: {
            name: 'BscScan',
            url: 'https://testnet.bscscan.com/',
        },
    },
    testnet: true,
};
const networkConfig = {
    rpcProviderUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com/',
    chain: bnbChain,
    nativeTokenAddress: '0x0000000000000000000000000000000000000000', // Native tBNB (testnet faucet)
};
// Use RPC_PROVIDER_URL when it clearly targets BNB Chain / BSC (mainnet or testnet)
function getRpcUrl() {
    const env = process.env.RPC_PROVIDER_URL?.trim();
    if (!env)
        return networkConfig.rpcProviderUrl;
    const lower = env.toLowerCase();
    if (lower.includes('binance') ||
        lower.includes('bsc') ||
        lower.includes('bsc-dataseed') ||
        lower.includes('prebsc') ||
        lower.includes('testnet.bscscan')) {
        return env;
    }
    return networkConfig.rpcProviderUrl;
}
const validateEnvironmentVars = () => {
    if (!process.env.WALLET_PRIVATE_KEY) {
        throw new Error('WALLET_PRIVATE_KEY is required in .env file');
    }
};
validateEnvironmentVars();
exports.networkInfo = {
    ...networkConfig,
    rpcProviderUrl: getRpcUrl(),
};
exports.account = (0, accounts_1.privateKeyToAccount)(`0x${process.env.WALLET_PRIVATE_KEY}`);
const baseConfig = {
    chain: exports.networkInfo.chain,
    transport: (0, viem_1.http)(exports.networkInfo.rpcProviderUrl, {
        timeout: 60000,
        retryCount: 3,
        retryDelay: 1000,
    }),
};
exports.publicClient = (0, viem_1.createPublicClient)(baseConfig);
exports.walletClient = (0, viem_1.createWalletClient)({
    ...baseConfig,
    account: exports.account,
});
exports.NATIVE_TOKEN_ADDRESS = exports.networkInfo.nativeTokenAddress;
exports.BLOCK_EXPLORER_URL = exports.networkInfo.blockExplorer;
