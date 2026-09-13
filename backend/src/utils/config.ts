import { Chain, createPublicClient, createWalletClient, http, WalletClient } from 'viem'
import { privateKeyToAccount, Address, Account } from 'viem/accounts'
import dotenv from 'dotenv'

dotenv.config()

// BNB Smart Chain — BSC Testnet (Chapel)
const bnbChain: Chain = {
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
}

interface NetworkConfig {
    rpcProviderUrl: string
    blockExplorer: string
    chain: Chain
    nativeTokenAddress: Address
}

const networkConfig: NetworkConfig = {
    rpcProviderUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com/',
    chain: bnbChain,
    nativeTokenAddress: '0x0000000000000000000000000000000000000000' as Address, // Native tBNB (testnet faucet)
}

// Use RPC_PROVIDER_URL when it clearly targets BNB Chain / BSC (mainnet or testnet)
function getRpcUrl(): string {
    const env = process.env.RPC_PROVIDER_URL?.trim()
    if (!env) return networkConfig.rpcProviderUrl
    const lower = env.toLowerCase()
    if (
        lower.includes('binance') ||
        lower.includes('bsc') ||
        lower.includes('bsc-dataseed') ||
        lower.includes('prebsc') ||
        lower.includes('testnet.bscscan')
    ) {
        return env
    }
    return networkConfig.rpcProviderUrl
}

const validateEnvironmentVars = () => {
    if (!process.env.WALLET_PRIVATE_KEY) {
        throw new Error('WALLET_PRIVATE_KEY is required in .env file')
    }
}

validateEnvironmentVars()

export const networkInfo = {
    ...networkConfig,
    rpcProviderUrl: getRpcUrl(),
}

export const account: Account = privateKeyToAccount(`0x${process.env.WALLET_PRIVATE_KEY}` as Address)

const baseConfig = {
    chain: networkInfo.chain,
    transport: http(networkInfo.rpcProviderUrl, {
        timeout: 60000,
        retryCount: 3,
        retryDelay: 1000,
    }),
} as const

export const publicClient = createPublicClient(baseConfig)
export const walletClient = createWalletClient({
    ...baseConfig,
    account,
}) as WalletClient

export const NATIVE_TOKEN_ADDRESS = networkInfo.nativeTokenAddress
export const BLOCK_EXPLORER_URL = networkInfo.blockExplorer
