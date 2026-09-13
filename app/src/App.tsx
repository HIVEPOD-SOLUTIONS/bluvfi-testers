import { useEffect, useState } from 'react'
import './App.css'
import './landing-redesign.css'
import { useNotificationHelpers } from './contexts/NotificationContext'
import { NotificationButton } from './components/NotificationButton'
import { NotificationToasts } from './components/NotificationCenter'
import { IPPortfolio } from './components/IPPortfolio'
import './components/IPPortfolio.css'

import {
  defineChain,
  getContract,
  prepareContractCall,
  readContract,
  sendTransaction,
  ThirdwebClient,
  waitForReceipt,
} from 'thirdweb'
import { ConnectButton, useActiveAccount } from 'thirdweb/react'
import { createWallet, inAppWallet } from 'thirdweb/wallets'
import { parseEther, formatEther } from 'viem'
import CONTRACT_ADDRESS_JSON from './deployed_addresses.json'

// Type assertion to include the ModredIP contract address
type ContractAddresses = {
  'ModredIPModule#ERC6551Account': string
  'ModredIPModule#ERC6551Registry': string
  'ModredIPModule#ModredIP': string
}

const CONTRACT_ADDRESSES = CONTRACT_ADDRESS_JSON as ContractAddresses

// BNB Smart Chain — BSC Testnet (Chapel, chain ID 97)
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
      http: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    },
    public: {
      http: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BscScan',
      url: 'https://testnet.bscscan.com',
    },
  },
  testnet: true,
}

// Backend API configuration
const BACKEND_URL = 'http://localhost:5000'

// File validation and preview utilities
const MAX_FILE_SIZE_MB = 50 // Maximum file size in megabytes
const ALLOWED_FILE_TYPES = [
  'application/pdf', // PDF
  'application/msword', // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain', // TXT
  'image/jpeg', // JPG/JPEG
  'image/png', // PNG
  'image/gif', // GIF
  'audio/mpeg', // MP3
  'audio/wav', // WAV
  'video/mp4', // MP4
]

// File validation function
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024)
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
    }
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type',
    }
  }

  return { valid: true }
}

// File preview generator
const generateFilePreview = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    }
    // Preview for PDFs (basic)
    else if (file.type === 'application/pdf') {
      resolve('📄 PDF Document')
    }
    // Preview for text files
    else if (file.type === 'text/plain') {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.readAsText(file)
    }
    // Preview for other file types
    else {
      resolve(null)
    }
  })
}

// Remove hardcoded Pinata credentials
const PINATA_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJmZDYzMDVmZS1kMjNjLTQ4OGEtOGE1Zi1kMmQ4YjMzNjZiNGUiLCJlbWFpbCI6ImFmb2xhYmlpZmVvbHV3YTg5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJhZjRlYTllNzVkYjJmMDBlNDAwNyIsInNjb3BlZEtleVNlY3JldCI6ImQzMDZkNjZmOWI3ODlhYzIyNTY5YTY5NTY4YTNlNGNiNDExMDgzZjkyY2ZmNzg5NmY2MjU1Y2VjNmY1MzEzNjYiLCJleHAiOjE3OTgzMDkwNjd9.jCTgzS_Ygop0pniQNNhcN_ARaqu16JgXv-PJRyQCxxk'

/**
 * Uploads a file to IPFS via Pinata
 * @param file The file to upload
 * @returns Object with success status, CID and message
 */
const pinFileToIPFS = async (
  file: File,
): Promise<{
  success: boolean
  cid?: string
  message?: string
}> => {
  try {
    // Validate JWT is present
    if (!PINATA_JWT) {
      throw new Error(
        'Pinata JWT is not configured. Please set VITE_PINATA_JWT in your environment.',
      )
    }

    // Create form data
    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = {
      name: file.name,
      description: `Uploaded via Bluvfi frontend`,
      attributes: {
        uploadedBy: 'Bluvfi',
        timestamp: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size,
      },
    }
    formData.append('pinataMetadata', JSON.stringify(metadata))

    // Make request to Pinata
    const response = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Pinata API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(
        `Pinata upload failed: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    const result = await response.json()
    console.log('Pinata upload successful:', result)

    return {
      success: true,
      cid: result.IpfsHash,
      message: 'File uploaded successfully to IPFS',
    }
  } catch (error) {
    console.error('Error uploading to IPFS:', error)
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Converts an IPFS URL to a gateway URL for better compatibility
 * @param url IPFS URL (ipfs://, /ipfs/, or already a gateway URL)
 * @returns Gateway URL
 */
const getIPFSGatewayURL = (url: string): string => {
  if (!url) return ''

  // Use preferred gateway
  const gateway = 'https://gateway.pinata.cloud'

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '')
    return `${gateway}/ipfs/${cid}`
  }

  // Handle /ipfs/ path
  if (url.includes('/ipfs/')) {
    const parts = url.split('/ipfs/')
    if (parts.length > 1) {
      return `${gateway}/ipfs/${parts[1]}`
    }
  }

  // If it's already a gateway URL or something else, return as is
  return url
}

// Parse metadata to extract name and description
const parseMetadata = async (metadataUri: string) => {
  try {
    // If metadata is a direct JSON string, parse it
    if (metadataUri.startsWith('{')) {
      return JSON.parse(metadataUri)
    }

    // If it's an IPFS URI, fetch it
    if (metadataUri.startsWith('ipfs://')) {
      const gatewayUrl = getIPFSGatewayURL(metadataUri)
      const response = await fetch(gatewayUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }

      const metadata = await response.json()
      return metadata
    }

    // If it's already a gateway URL, fetch it
    if (metadataUri.includes('gateway.pinata.cloud')) {
      const response = await fetch(metadataUri)

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }

      const metadata = await response.json()
      return metadata
    }

    // Default fallback
    return {
      name: 'Unknown',
      description: 'No description available',
    }
  } catch (error) {
    console.error('Error parsing metadata:', error)
    return {
      name: 'Unknown',
      description: 'No description available',
    }
  }
}

const wallets = [
  inAppWallet({
    auth: {
      options: ['google', 'email', 'passkey', 'phone'],
    },
  }),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('io.rabby'),
  createWallet('com.trustwallet.app'),
  createWallet('global.safe'),
]

// ModredIP contract ABI (simplified for the functions we need)
const MODRED_IP_ABI = [
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getIPAsset',
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'ipHash', type: 'string' },
      { name: 'metadata', type: 'string' },
      { name: 'isEncrypted', type: 'bool' },
      { name: 'isDisputed', type: 'bool' },
      { name: 'registrationDate', type: 'uint256' },
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'royaltyTokens', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'licenseId', type: 'uint256' }],
    name: 'getLicense',
    outputs: [
      { name: 'licensee', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'royaltyPercentage', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'startDate', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'commercialUse', type: 'bool' },
      { name: 'terms', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'claimant', type: 'address' },
    ],
    name: 'getRoyaltyInfo',
    outputs: [
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'claimableAmount', type: 'uint256' },
      { name: 'lastClaimed', type: 'uint256' },
      { name: 'totalAccumulated', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTokenId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextLicenseId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'ipHash', type: 'string' },
      { name: 'metadata', type: 'string' },
      { name: 'isEncrypted', type: 'bool' },
    ],
    name: 'registerIP',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'royaltyPercentage', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'commercialUse', type: 'bool' },
      { name: 'terms', type: 'string' },
    ],
    name: 'mintLicense',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'payRevenue',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'claimRoyalties',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    name: 'raiseDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'registerArbitrator',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'selectedArbitrators', type: 'address[]' },
    ],
    name: 'assignArbitrators',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'decision', type: 'bool' },
      { name: 'resolution', type: 'string' },
    ],
    name: 'submitArbitrationDecision',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'checkAndResolveArbitration',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'resolveArbitrationAfterDeadline',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'resolveDisputeWithoutArbitrators',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getTokenDisputes',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'hasActiveDisputes',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    name: 'transferIP',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    name: 'getDispute',
    outputs: [
      { name: 'disputeId_', type: 'uint256' },
      { name: 'tokenId_', type: 'uint256' },
      { name: 'disputer_', type: 'address' },
      { name: 'reason_', type: 'string' },
      { name: 'timestamp_', type: 'uint256' },
      { name: 'isResolved_', type: 'bool' },
      { name: 'arbitrationId_', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'arbitrationId', type: 'uint256' }],
    name: 'getArbitration',
    outputs: [
      { name: 'arbitrationId_', type: 'uint256' },
      { name: 'disputeId_', type: 'uint256' },
      { name: 'arbitrators_', type: 'address[]' },
      { name: 'votesFor_', type: 'uint256' },
      { name: 'votesAgainst_', type: 'uint256' },
      { name: 'deadline_', type: 'uint256' },
      { name: 'isResolved_', type: 'bool' },
      { name: 'resolution_', type: 'string' },
      { name: 'threeUpholdVotesTimestamp_', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'arbitrator', type: 'address' }],
    name: 'getArbitratorActiveDisputes',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'arbitrator', type: 'address' }],
    name: 'getArbitrator',
    outputs: [
      { name: 'arbitrator_', type: 'address' },
      { name: 'stake_', type: 'uint256' },
      { name: 'reputation_', type: 'uint256' },
      { name: 'totalCases_', type: 'uint256' },
      { name: 'successfulCases_', type: 'uint256' },
      { name: 'isActive_', type: 'bool' },
      { name: 'registrationDate_', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllArbitrators',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_ARBITRATOR_STAKE',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'REQUIRED_ARBITRATORS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveArbitratorsCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextDisputeId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface IPAsset {
  owner: string
  ipHash: string
  metadata: string
  isEncrypted: boolean
  isDisputed: boolean
  registrationDate: bigint
  totalRevenue: bigint
  royaltyTokens: bigint
}

interface License {
  licensee: string
  tokenId: bigint
  royaltyPercentage: bigint
  duration: bigint
  startDate: bigint
  isActive: boolean
  commercialUse: boolean
  terms: string
}

interface AppProps {
  thirdwebClient: ThirdwebClient
}

// License Template Interface
interface LicenseTemplate {
  id: string
  name: string
  description: string
  icon: string
  royaltyPercentage: number
  duration: number // in seconds
  commercialUse: boolean
  commercialAttribution: boolean
  derivativesAllowed: boolean
  derivativesAttribution: boolean
  derivativesApproval: boolean
  derivativesReciprocal: boolean
  commercialRevShare: number // in basis points (100000000 = 100%)
  commercialRevCeiling: number
  derivativeRevCeiling: number
  commercializerChecker: string
  commercializerCheckerData: string
  currency: string
}

// Predefined License Templates
const LICENSE_TEMPLATES: LicenseTemplate[] = [
  {
    id: 'commercial',
    name: 'Commercial License',
    description:
      'Full commercial rights with attribution. Allows commercial use, derivatives, and sharing.',
    icon: '💼',
    royaltyPercentage: 15,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 100000000, // 100%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'non-commercial',
    name: 'Non-Commercial License',
    description:
      'Non-commercial use only. Allows derivatives and sharing, but no commercial use.',
    icon: '🚫',
    royaltyPercentage: 10,
    duration: 31536000, // 1 year
    commercialUse: false,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'cc-by',
    name: 'Creative Commons BY',
    description:
      'Attribution required. Allows commercial use, derivatives, and sharing with credit.',
    icon: '📝',
    royaltyPercentage: 5,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 50000000, // 50%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'cc-by-nc',
    name: 'Creative Commons BY-NC',
    description:
      'Attribution required, non-commercial only. No commercial use, but allows derivatives and sharing.',
    icon: '🎨',
    royaltyPercentage: 5,
    duration: 31536000, // 1 year
    commercialUse: false,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'cc-by-sa',
    name: 'Creative Commons BY-SA',
    description:
      'Attribution-ShareAlike. Allows commercial use and derivatives, but derivatives must use same license.',
    icon: '🔗',
    royaltyPercentage: 10,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 75000000, // 75%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'all-rights',
    name: 'All Rights Reserved',
    description:
      'Strict license. No commercial use, no derivatives. Attribution required for any use.',
    icon: '🔒',
    royaltyPercentage: 20,
    duration: 31536000, // 1 year
    commercialUse: false,
    commercialAttribution: true,
    derivativesAllowed: false,
    derivativesAttribution: false,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'public-domain',
    name: 'Public Domain',
    description:
      'No restrictions. Free for commercial use, derivatives, and sharing. No attribution required.',
    icon: '🌍',
    royaltyPercentage: 0,
    duration: 31536000, // 1 year
    commercialUse: true,
    commercialAttribution: false,
    derivativesAllowed: true,
    derivativesAttribution: false,
    derivativesApproval: false,
    derivativesReciprocal: false,
    commercialRevShare: 0,
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'exclusive',
    name: 'Exclusive Commercial',
    description:
      'Exclusive commercial license with high royalty. No derivatives, commercial use only with approval.',
    icon: '⭐',
    royaltyPercentage: 25,
    duration: 63072000, // 2 years
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: false,
    derivativesAttribution: false,
    derivativesApproval: true,
    derivativesReciprocal: false,
    commercialRevShare: 100000000, // 100%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
  {
    id: 'custom',
    name: 'Custom License',
    description:
      'Manually configure all license parameters to your specific needs.',
    icon: '⚙️',
    royaltyPercentage: 10,
    duration: 86400, // 1 day default
    commercialUse: true,
    commercialAttribution: true,
    derivativesAllowed: true,
    derivativesAttribution: true,
    derivativesApproval: false,
    derivativesReciprocal: true,
    commercialRevShare: 100000000, // 100%
    commercialRevCeiling: 0,
    derivativeRevCeiling: 0,
    commercializerChecker: '0x0000000000000000000000000000000000000000',
    commercializerCheckerData: '0000000000000000000000000000000000000000',
    currency: '0x15140000000000000000000000000000000000000',
  },
]

// Tally waitlist embed — uses useEffect to call loadEmbeds() after mount,
// which is required in SPAs where the Tally script has already executed.
declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void }
  }
}

const TallyEmbed: React.FC = () => {
  useEffect(() => {
    if (typeof window.Tally !== 'undefined') {
      window.Tally.loadEmbeds()
    }
  }, [])

  return (
    <iframe
      data-tally-src="https://tally.so/embed/obzra5?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
      loading="lazy"
      width="100%"
      height="387"
      frameBorder="0"
      marginHeight={0}
      marginWidth={0}
      title="Bluvfi Waitlist"
      style={{ maxWidth: '520px', display: 'block' }}
    />
  )
}

// Enhanced Asset Preview Component
const EnhancedAssetPreview: React.FC<{
  assetId: number
  asset: IPAsset
  metadata: any
  mediaUrl: string
}> = ({ assetId, asset, metadata, mediaUrl }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const fetchImageFromMetadata = async () => {
      try {
        setLoading(true)
        setImageError(false)

        // Priority 1: Check if metadata has image field
        if (metadata?.image) {
          let imageSource = metadata.image

          // Convert IPFS URLs to gateway URLs
          if (imageSource.startsWith('ipfs://')) {
            imageSource = `https://gateway.pinata.cloud/ipfs/${imageSource.replace('ipfs://', '')}`
          }

          setImageUrl(imageSource)
        }
        // Priority 2: Try the asset's ipHash directly
        else if (asset.ipHash) {
          let gatewayUrl = asset.ipHash
          if (gatewayUrl.startsWith('ipfs://')) {
            gatewayUrl = `https://gateway.pinata.cloud/ipfs/${gatewayUrl.replace('ipfs://', '')}`
          }
          setImageUrl(gatewayUrl)
        }
        // Priority 3: Use mediaUrl as fallback
        else if (mediaUrl) {
          setImageUrl(mediaUrl)
        } else {
          setImageUrl(null)
        }
      } catch (error) {
        console.error('Error fetching image from metadata:', error)
        setImageUrl(null)
      } finally {
        setLoading(false)
      }
    }

    fetchImageFromMetadata()
  }, [metadata, asset.ipHash, mediaUrl])

  const handleImageError = () => {
    setImageError(true)
  }

  if (loading) {
    return (
      <div
        className="preview-skeleton"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="skeleton skeleton-image"
          style={{ width: '100%', height: '100%' }}
        ></div>
      </div>
    )
  }

  const showImage = imageUrl && !imageError
  const finalMediaUrl = imageUrl || mediaUrl || asset.ipHash || ''

  return (
    <>
      {showImage ? (
        <img
          src={imageUrl!}
          alt={metadata?.name || `IP Asset ${assetId}`}
          className="media-image"
          onError={handleImageError}
          style={{ display: 'block' }}
        />
      ) : null}
      <div
        className="media-fallback"
        style={{ display: showImage ? 'none' : 'flex' }}
      >
        <div className="media-fallback-icon">📄</div>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          Media Preview
        </p>
        {finalMediaUrl && (
          <a
            href={finalMediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="media-link"
          >
            🔗 View Media
          </a>
        )}
      </div>
    </>
  )
}

export default function App({ thirdwebClient }: AppProps) {
  const account = useActiveAccount()
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } =
    useNotificationHelpers()

  const [loading, setLoading] = useState<boolean>(false)
  const [backendStatus, setBackendStatus] = useState<boolean>(false)

  // IP Assets state
  const [ipAssets, setIpAssets] = useState<Map<number, IPAsset>>(new Map())

  // Licenses state
  const [licenses, setLicenses] = useState<Map<number, License>>(new Map())

  // Parsed metadata state
  const [parsedMetadata, setParsedMetadata] = useState<Map<number, any>>(
    new Map(),
  )

  // Form states
  const [ipFile, setIpFile] = useState<File | null>(null)
  const [ipHash, setIpHash] = useState<string>('')
  const [ipName, setIpName] = useState<string>('')
  const [ipDescription, setIpDescription] = useState<string>('')
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false)

  const [selectedTokenId, setSelectedTokenId] = useState<number>(1)
  const [royaltyPercentage, setRoyaltyPercentage] = useState<number>(10)
  const [licenseDuration, setLicenseDuration] = useState<number>(86400)
  // License parameters
  const [commercialUse, setCommercialUse] = useState<boolean>(true)
  const [commercialAttribution, setCommercialAttribution] =
    useState<boolean>(true)
  const [commercializerChecker, setCommercializerChecker] = useState<string>(
    '0x0000000000000000000000000000000000000000',
  )
  const [commercializerCheckerData, setCommercializerCheckerData] =
    useState<string>('0000000000000000000000000000000000000000')
  const [commercialRevShare, setCommercialRevShare] =
    useState<number>(100000000)
  const [commercialRevCeiling, setCommercialRevCeiling] = useState<number>(0)
  const [derivativesAllowed, setDerivativesAllowed] = useState<boolean>(true)
  const [derivativesAttribution, setDerivativesAttribution] =
    useState<boolean>(true)
  const [derivativesApproval, setDerivativesApproval] = useState<boolean>(false)
  const [derivativesReciprocal, setDerivativesReciprocal] =
    useState<boolean>(true)
  const [derivativeRevCeiling, setDerivativeRevCeiling] = useState<number>(0)
  const [licenseCurrency, setLicenseCurrency] = useState<string>(
    '0x15140000000000000000000000000000000000000',
  )
  const [selectedLicenseTemplate, setSelectedLicenseTemplate] =
    useState<string>('custom')

  const [paymentAmount, setPaymentAmount] = useState<string>('0.001')
  const [paymentTokenId, setPaymentTokenId] = useState<number>(1)

  const [claimTokenId, setClaimTokenId] = useState<number>(1)

  // Royalty calculation states
  interface RoyaltyBreakdown {
    totalAmount: number
    platformFee: number
    remainingAfterFee: number
    licenseRoyalties: Array<{
      licenseId: number
      licensee: string
      royaltyPercentage: number
      amount: number
    }>
    ipOwnerShare: number
  }

  const [royaltyBreakdown, setRoyaltyBreakdown] =
    useState<RoyaltyBreakdown | null>(null)
  const [accumulatedRoyalties, setAccumulatedRoyalties] = useState<
    Map<number, bigint>
  >(new Map()) // tokenId => claimable amount

  // Constants matching contract
  const ROYALTY_DECIMALS = 10000 // 10000 = 100%
  const PLATFORM_FEE_PERCENTAGE = 250 // 2.5% = 250 basis points

  // Calculate royalty breakdown (mirrors contract logic)
  const calculateRoyaltyBreakdown = (
    paymentAmount: number,
    tokenId: number,
  ): RoyaltyBreakdown | null => {
    if (!paymentAmount || paymentAmount <= 0) return null
    if (!ipAssets.has(tokenId)) return null

    const paymentAmountWei = parseFloat(paymentAmount.toString()) * 1e18 // Convert to wei for calculation
    const paymentAmountBigInt = BigInt(Math.floor(paymentAmountWei))

    // Calculate platform fee
    const platformFee =
      (paymentAmountBigInt * BigInt(PLATFORM_FEE_PERCENTAGE)) /
      BigInt(ROYALTY_DECIMALS)
    const remainingAfterFee = paymentAmountBigInt - platformFee

    // Get active licenses for this token
    const activeLicenses: Array<{
      licenseId: number
      license: License
    }> = []

    licenses.forEach((license, licenseId) => {
      if (
        Number(license.tokenId) === tokenId &&
        license.isActive &&
        Date.now() / 1000 < Number(license.startDate) + Number(license.duration)
      ) {
        activeLicenses.push({ licenseId, license })
      }
    })

    // Calculate license royalties
    const licenseRoyalties = activeLicenses.map(({ licenseId, license }) => {
      const royaltyAmount =
        (remainingAfterFee * license.royaltyPercentage) /
        BigInt(ROYALTY_DECIMALS)
      return {
        licenseId,
        licensee: license.licensee,
        royaltyPercentage: Number(license.royaltyPercentage) / 100, // Convert to percentage
        amount: Number(royaltyAmount) / 1e18, // Convert from wei
      }
    })

    const totalLicenseRoyalties = licenseRoyalties.reduce(
      (sum, lr) => sum + lr.amount,
      0,
    )
    const ipOwnerShare =
      Number(remainingAfterFee) / 1e18 - totalLicenseRoyalties

    return {
      totalAmount: paymentAmount,
      platformFee: Number(platformFee) / 1e18,
      remainingAfterFee: Number(remainingAfterFee) / 1e18,
      licenseRoyalties,
      ipOwnerShare: Math.max(0, ipOwnerShare), // Ensure non-negative
    }
  }

  // Load accumulated royalties for a token
  const loadAccumulatedRoyalties = async (tokenId: number) => {
    if (!account?.address) return

    try {
      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Get royalty info for the connected account
      const royaltyInfo = (await readContract({
        contract,
        method: 'getRoyaltyInfo' as any,
        params: [BigInt(tokenId), account.address],
      })) as readonly [bigint, bigint, bigint, bigint]

      const claimableAmount = royaltyInfo[1] // claimableAmount_
      setAccumulatedRoyalties((prev) => {
        const newMap = new Map(prev)
        newMap.set(tokenId, claimableAmount)
        return newMap
      })
    } catch (error: any) {
      // Silently handle errors (e.g., if no royalties exist)
      console.log('No royalties found or error loading:', error)
      setAccumulatedRoyalties((prev) => {
        const newMap = new Map(prev)
        newMap.set(tokenId, 0n)
        return newMap
      })
    }
  }

  // Arbitration states
  const [disputesMap, setDisputesMap] = useState<Map<number, any>>(new Map())
  // const [arbitrationsMap, setArbitrationsMap] = useState<Map<number, any>>(new Map()); // Reserved for future use
  const [arbitratorsMap, setArbitratorsMap] = useState<Map<string, any>>(
    new Map(),
  )
  const [disputeTokenId, setDisputeTokenId] = useState<number>(1)
  const [disputeReason, setDisputeReason] = useState<string>('')
  const [arbitrationDecision, setArbitrationDecision] = useState<boolean>(true)
  const [arbitrationResolution, setArbitrationResolution] = useState<string>('')
  const [arbitrationDisputeId, setArbitrationDisputeId] = useState<number>(0)
  const [minArbitratorStake, setMinArbitratorStake] =
    useState<string>('0.000000001')
  const [allArbitrators, setAllArbitrators] = useState<string[]>([])
  const [activeArbitratorsCount, setActiveArbitratorsCount] =
    useState<number>(0)
  const [resolveDisputeId, setResolveDisputeId] = useState<number>(0)
  const [assignDisputeId, setAssignDisputeId] = useState<number>(0)
  const [selectedArbitrators, setSelectedArbitrators] = useState<string[]>([])
  const [arbitrationsMap, setArbitrationsMap] = useState<Map<number, any>>(
    new Map(),
  )
  const [isOwner, setIsOwner] = useState<boolean>(false)

  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'register'
    | 'license'
    | 'revenue'
    | 'arbitration'
    | 'infringement'
  >('dashboard')

  // Infringement detection states
  interface InfringementData {
    id: string
    status: string
    result: string
    inNetworkInfringements: Array<{
      id?: string
      url?: string
      similarity?: number
      detected_at?: string
      type?: string
    }>
    externalInfringements: Array<{
      id?: string
      url?: string
      similarity?: number
      detected_at?: string
      type?: string
      platform?: string
    }>
    credits?: {
      used?: number
      remaining?: number
    }
    lastChecked: string | null
    totalInfringements: number
  }

  const [infringementData, setInfringementData] = useState<
    Map<number, InfringementData>
  >(new Map())
  const [infringementLoadingIds, setInfringementLoadingIds] = useState<
    Set<number>
  >(new Set())
  const [selectedInfringementTokenId, setSelectedInfringementTokenId] =
    useState<number>(1)
  const autoMonitoringEnabled = true // Auto-monitoring is always enabled
  const monitoringInterval = 300000 // 5 minutes default

  // Load infringement status for an IP asset
  const loadInfringementStatus = async (
    tokenId: number,
    options?: { silent?: boolean },
  ) => {
    if (!ipAssets.has(tokenId)) {
      console.warn(`IP Asset ${tokenId} not found`)
      return
    }

    setInfringementLoadingIds((prev) => new Set(prev).add(tokenId))
    try {
      const contractAddress =
        CONTRACT_ADDRESSES['ModredIPModule#ModredIP'].toLowerCase()
      const response = await fetch(
        `${BACKEND_URL}/api/infringement/status/${contractAddress}/${tokenId}`,
      )

      if (!response.ok) {
        throw new Error(
          `Failed to fetch infringement status: ${response.statusText}`,
        )
      }

      const result = await response.json()
      const infringementStatus: InfringementData = result.data

      setInfringementData((prev) => {
        const newMap = new Map(prev)
        newMap.set(tokenId, infringementStatus)
        return newMap
      })

      // Show notification only when not silent (e.g. user clicked "Check Status")
      if (!options?.silent) {
        if (infringementStatus.totalInfringements > 0) {
          notifyWarning(
            'Infringements Detected',
            `Found ${infringementStatus.totalInfringements} potential infringement(s) for IP Asset #${tokenId}`,
          )
        } else {
          notifyInfo(
            'No Infringements',
            `No infringements detected for IP Asset #${tokenId}`,
          )
        }
      }
    } catch (error: any) {
      console.error('Error loading infringement status:', error)
      if (!options?.silent && !error.message?.includes('404')) {
        notifyError(
          'Infringement Check Failed',
          error.message || 'Failed to check infringement status',
        )
      }
    } finally {
      setInfringementLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(tokenId)
        return next
      })
    }
  }

  // Calculate infringement severity
  const calculateSeverity = (
    infringement: InfringementData,
  ): 'low' | 'medium' | 'high' | 'critical' => {
    if (infringement.totalInfringements === 0) return 'low'

    const hasHighSimilarity = [
      ...infringement.inNetworkInfringements,
      ...infringement.externalInfringements,
    ].some((inf) => (inf.similarity || 0) > 0.9)

    if (hasHighSimilarity && infringement.totalInfringements > 5)
      return 'critical'
    if (hasHighSimilarity || infringement.totalInfringements > 3) return 'high'
    if (infringement.totalInfringements > 1) return 'medium'
    return 'low'
  }

  // Auto-monitoring effect
  useEffect(() => {
    if (
      !autoMonitoringEnabled ||
      !selectedInfringementTokenId ||
      !ipAssets.has(selectedInfringementTokenId)
    )
      return

    // Load immediately
    loadInfringementStatus(selectedInfringementTokenId)

    // Set up interval
    const interval = setInterval(() => {
      if (ipAssets.has(selectedInfringementTokenId)) {
        loadInfringementStatus(selectedInfringementTokenId)
      }
    }, monitoringInterval)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMonitoringEnabled, selectedInfringementTokenId, monitoringInterval])

  // Check backend status
  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/`)
      const wasConnected = backendStatus
      const isConnected = response.ok

      setBackendStatus(isConnected)

      if (!wasConnected && isConnected) {
        notifySuccess(
          'Backend Connected',
          'Successfully connected to the Bluvfi backend service',
        )
      } else if (wasConnected && !isConnected) {
        notifyError(
          'Backend Disconnected',
          'Lost connection to the Bluvfi backend service',
        )
      }
    } catch (error) {
      const wasConnected = backendStatus
      setBackendStatus(false)

      if (wasConnected) {
        notifyError(
          'Backend Error',
          'Failed to connect to the Bluvfi backend service',
        )
      }
    }
  }

  // Check backend status on component mount
  useEffect(() => {
    checkBackendStatus()
  }, [])

  // Handle file selection for IP asset
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processFile(files[0])
    }
  }

  // Process file (shared logic for both upload methods)
  const processFile = async (file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      notifyError('Invalid File', validation.error || 'Invalid file selected')
      return
    }

    try {
      const preview = await generateFilePreview(file)
      setFilePreview(preview)
      setIpFile(file)
      notifyInfo('File Selected', `${file.name} selected for upload`)
    } catch (err) {
      console.error('File preview error:', err)
      setIpFile(file)
      notifyWarning(
        'Preview Error',
        'File selected but preview could not be generated',
      )
    }
  }

  // Upload file to IPFS
  const uploadToIPFS = async () => {
    if (!ipFile) {
      notifyError('No File Selected', 'Please select a file to upload')
      return null
    }

    try {
      setLoading(true)
      notifyInfo('Uploading to IPFS', `Uploading ${ipFile.name} to IPFS...`)

      const uploadResult = await pinFileToIPFS(ipFile)

      if (uploadResult.success && uploadResult.cid) {
        // Clear any previous file preview
        setFilePreview(null)

        // Set the IPFS hash
        const ipfsUrl = `ipfs://${uploadResult.cid}`
        setIpHash(ipfsUrl)

        // Get gateway URL for display
        const gatewayUrl = getIPFSGatewayURL(ipfsUrl)

        // Show success message
        notifySuccess(
          'IPFS Upload Successful',
          `File uploaded successfully!\nCID: ${uploadResult.cid}`,
          {
            action: {
              label: 'View File',
              onClick: () => window.open(gatewayUrl, '_blank'),
            },
          },
        )

        return uploadResult.cid
      } else {
        // Handle specific upload errors
        const errorMessage = uploadResult.message || 'Failed to upload file'
        notifyError('Upload Failed', errorMessage)

        // Reset file selection if upload fails
        setIpFile(null)
        setFilePreview(null)

        return null
      }
    } catch (err: any) {
      console.error('Unexpected upload error:', err)
      notifyError(
        'Upload Error',
        err.message || 'Unexpected error during file upload',
      )

      // Reset file selection
      setIpFile(null)
      setFilePreview(null)

      return null
    } finally {
      setLoading(false)
    }
  }

  // Load contract data
  const loadContractData = async () => {
    if (!account?.address) return

    try {
      setLoading(true)
      const contractAddress = CONTRACT_ADDRESSES['ModredIPModule#ModredIP']
      console.log('📋 Using ModredIP contract:', contractAddress)

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: contractAddress,
      })

      // Get next token ID with error handling
      let nextTokenIdNum = 1
      try {
        const nextId = await readContract({
          contract,
          method: 'nextTokenId',
          params: [],
        })
        nextTokenIdNum = Number(nextId)
        console.log('✅ Loaded nextTokenId:', nextTokenIdNum)
      } catch (error: any) {
        console.warn('⚠️ Error loading nextTokenId:', error?.message || error)
        // If it's a zero data error, the contract might not be fully deployed
        if (
          error?.message?.includes('zero data') ||
          error?.message?.includes('Cannot decode')
        ) {
          console.warn(
            "⚠️ Contract function 'nextTokenId' returned no data. Contract may not be deployed or function not implemented.",
          )
        }
        // Use default value of 1 (no tokens registered yet)
        nextTokenIdNum = 1
      }

      // Get next license ID with error handling
      let nextLicenseIdNum = 1
      try {
        const nextLicenseId = await readContract({
          contract,
          method: 'nextLicenseId',
          params: [],
        })
        nextLicenseIdNum = Number(nextLicenseId)
        console.log('✅ Loaded nextLicenseId:', nextLicenseIdNum)
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'nextLicenseId' not available (contract may not be fully deployed). Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading nextLicenseId:', errorMessage)
        }
        // Use default value of 1 (no licenses registered yet)
        nextLicenseIdNum = 1
      }

      // Load IP assets
      const newIpAssets = new Map<number, IPAsset>()
      for (let i = 1; i < nextTokenIdNum; i++) {
        try {
          const ipAsset = await readContract({
            contract,
            method: 'getIPAsset',
            params: [BigInt(i)],
          })
          newIpAssets.set(i, {
            owner: ipAsset[0],
            ipHash: ipAsset[1],
            metadata: ipAsset[2],
            isEncrypted: ipAsset[3],
            isDisputed: ipAsset[4],
            registrationDate: ipAsset[5],
            totalRevenue: ipAsset[6],
            royaltyTokens: ipAsset[7],
          })
        } catch (error) {
          // Token doesn't exist, skip
        }
      }
      setIpAssets(newIpAssets)

      // Parse metadata for all IP assets
      const newParsedMetadata = new Map<number, any>()
      for (const [id, asset] of newIpAssets.entries()) {
        try {
          const metadata = await parseMetadata(asset.metadata)
          newParsedMetadata.set(id, metadata)
        } catch (error) {
          console.error(`Error parsing metadata for token ${id}:`, error)
          newParsedMetadata.set(id, {
            name: 'Unknown',
            description: 'No description available',
          })
        }
      }
      setParsedMetadata(newParsedMetadata)

      // Load licenses
      const newLicenses = new Map<number, License>()
      for (let i = 1; i < nextLicenseIdNum; i++) {
        try {
          const license = await readContract({
            contract,
            method: 'getLicense',
            params: [BigInt(i)],
          })
          newLicenses.set(i, {
            licensee: license[0],
            tokenId: license[1],
            royaltyPercentage: license[2],
            duration: license[3],
            startDate: license[4],
            isActive: license[5],
            commercialUse: license[6],
            terms: license[7],
          })
        } catch (error) {
          // License doesn't exist, skip
        }
      }
      setLicenses(newLicenses)
    } catch (error: any) {
      // Only log and notify for unexpected errors, not zero data errors
      const errorMessage =
        error?.message || error?.shortMessage || String(error || '')
      const isZeroDataError =
        errorMessage.includes('zero data') ||
        errorMessage.includes('Cannot decode') ||
        errorMessage.includes('AbiDecodingZeroDataError')

      if (!isZeroDataError) {
        console.error('Error loading contract data:', error)
        notifyError('Loading Failed', 'Failed to load contract data')
      } else {
        console.log(
          'ℹ️ Some contract functions returned zero data (expected for new contracts). Continuing with defaults.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContractData()
  }, [account?.address])

  // Auto-load infringement status for all IP assets when the list is loaded
  useEffect(() => {
    const tokenIds = Array.from(ipAssets.keys())
    if (tokenIds.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const id of tokenIds) {
        if (cancelled) return
        await loadInfringementStatus(id, { silent: true })
        await new Promise((r) => setTimeout(r, 350))
      }
    })()
    return () => {
      cancelled = true
    }
    // Intentionally depend only on ipAssets so we run once when assets load, not when infringementData updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipAssets])

  // Create standardized NFT metadata
  const createNFTMetadata = async (
    ipHash: string,
    name: string,
    description: string,
    isEncrypted: boolean,
  ) => {
    // Generate metadata object
    const metadata = {
      name: name || `IP Asset #${Date.now()}`, // Use provided name or generate unique name
      description: description || 'No description provided',
      image: ipHash, // Use IPFS hash as image reference
      properties: {
        ipHash,
        name: name || 'Unnamed',
        description: description || 'No description provided',
        isEncrypted,
        uploadDate: new Date().toISOString(),
      },
    }

    // Upload metadata to IPFS
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json',
    })
    const metadataFile = new File([metadataBlob], 'metadata.json')

    const metadataUploadResult = await pinFileToIPFS(metadataFile)

    if (!metadataUploadResult.success || !metadataUploadResult.cid) {
      throw new Error('Failed to upload metadata to IPFS')
    }

    // Return IPFS URL for metadata
    return `ipfs://${metadataUploadResult.cid}`
  }

  // Register IP using backend API
  const registerIP = async () => {
    if (!account?.address || !ipHash || !ipName.trim()) {
      notifyError(
        'Missing Required Fields',
        'Please fill in all required fields (IP Hash and Name are required)',
      )
      return
    }

    try {
      setLoading(true)

      // Create and upload metadata to IPFS
      const metadataUri = await createNFTMetadata(
        ipHash,
        ipName,
        ipDescription,
        isEncrypted,
      )

      // Prepare comprehensive IP metadata for backend and infringement detection
      const ipMetadata = {
        name: ipName,
        description: ipDescription,
        image: metadataUri,
        creator: account.address,
        created_at: new Date().toISOString(),
        // Additional metadata for better infringement detection
        content_type: ipFile?.type || 'unknown',
        file_size: ipFile?.size || 0,
        mime_type: ipFile?.type || 'unknown',
        tags: [], // Could be enhanced with user input
        category: 'general', // Could be enhanced with user input
        license_type: 'all_rights_reserved',
        commercial_use: false,
        derivatives_allowed: false,
        creator_email: 'creator@bluvfi.xyz', // Could be enhanced with user input
        // File-specific metadata
        file_name: ipFile?.name || 'unknown',
        file_extension: ipFile?.name?.split('.').pop() || 'unknown',
        upload_timestamp: new Date().toISOString(),
        // Blockchain metadata
        network: 'bnb-testnet',
        chain_id: '97',
        contract_address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
        // Infringement detection metadata
        monitoring_enabled: true,
        infringement_alerts: true,
        content_hash: ipHash,
        original_filename: ipFile?.name || 'unknown',
      }

      // Prepare NFT metadata for backend
      // const nftMetadata = {
      //   name: ipName,
      //   description: ipDescription,
      //   image: metadataUri,
      //   attributes: [
      //     {
      //       trait_type: "IP Hash",
      //       value: ipHash
      //     },
      //     {
      //       trait_type: "Creator",
      //       value: account.address
      //     },
      //     {
      //       trait_type: "Encrypted",
      //       value: isEncrypted
      //     }
      //   ]
      // };

      // Call backend API
      // Note: If contract doesn't have registerIP function, set skipContractCall: true to test IPFS upload
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipHash: ipHash,
          metadata: JSON.stringify(ipMetadata),
          isEncrypted: isEncrypted,
          lobosContractAddress: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
          skipContractCall: false, // V2 contract has registerIP function, so this should be false
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to register IP'
        let errorData: any = {}
        try {
          errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
          console.error('Registration error details:', errorData)

          // If the error suggests using testing mode, provide helpful message
          if (errorData.suggestion || errorMessage.includes('does not exist')) {
            errorMessage = `${errorMessage}\n\n${errorData.suggestion || 'The contract function does not exist. You can test IPFS upload by setting skipContractCall: true in the request.'}`
          }
        } catch (parseError) {
          // If response is not JSON, try to get text
          const text = await response.text()
          errorMessage = text || errorMessage
          console.error('Registration error (non-JSON):', text)
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('IP Registration successful:', result)

      // Show success notification
      if (result.testing) {
        notifySuccess(
          'IP Asset Metadata Created (Testing Mode)',
          `IPFS upload successful!\nIP Hash: ${result.bnbChain.ipHash}\n\nNote: Contract registration was skipped (testing mode).`,
        )
      } else if (result.warning) {
        // Handle case where transaction was submitted but hash couldn't be retrieved
        notifySuccess(
          'IP Asset Registration Submitted',
          `Your IP asset registration was submitted successfully!\n\n${result.warning}\n\nPlease check your IP assets list to confirm the registration.`,
        )
      } else {
        notifySuccess(
          'IP Asset Registered',
          `Successfully registered IP asset!\nTransaction: ${result.bnbChain.txHash}\nIP Asset ID: ${result.bnbChain.ipAssetId}`,
          {
            action: {
              label: 'View Transaction',
              onClick: () =>
                window.open(
                  `https://testnet.bscscan.com/tx/${result.bnbChain.txHash}`,
                  '_blank',
                ),
            },
          },
        )
      }

      // Reset form
      setIpFile(null)
      setIpHash('')
      setIpName('')
      setIpDescription('')
      setIsEncrypted(false)
      setFilePreview(null)

      // Reload data
      await loadContractData()
    } catch (error) {
      console.error('Error registering IP:', error)
      notifyError(
        'Registration Failed',
        error instanceof Error ? error.message : 'Failed to register IP asset',
      )
    } finally {
      setLoading(false)
    }
  }

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days`
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months`
    return `${Math.floor(seconds / 31536000)} years`
  }

  // Apply license template to form
  const applyLicenseTemplate = (templateId: string) => {
    const template = LICENSE_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return

    setSelectedLicenseTemplate(templateId)
    setRoyaltyPercentage(template.royaltyPercentage)
    setLicenseDuration(template.duration)
    setCommercialUse(template.commercialUse)
    setCommercialAttribution(template.commercialAttribution)
    setDerivativesAllowed(template.derivativesAllowed)
    setDerivativesAttribution(template.derivativesAttribution)
    setDerivativesApproval(template.derivativesApproval)
    setDerivativesReciprocal(template.derivativesReciprocal)
    setCommercialRevShare(template.commercialRevShare)
    setCommercialRevCeiling(template.commercialRevCeiling)
    setDerivativeRevCeiling(template.derivativeRevCeiling)
    setCommercializerChecker(template.commercializerChecker)
    setCommercializerCheckerData(template.commercializerCheckerData)
    setLicenseCurrency(template.currency)

    if (templateId !== 'custom') {
      notifyInfo(
        'Template Applied',
        `${template.icon} ${template.name} template has been applied. You can still customize the settings.`,
      )
    }
  }

  // Mint License using backend API
  const mintLicense = async () => {
    if (!account?.address || !selectedTokenId) {
      notifyError(
        'Missing Required Fields',
        'Please fill in all required fields',
      )
      return
    }

    try {
      setLoading(true)

      // Prepare license terms for backend
      const licenseTerms = {
        tokenId: selectedTokenId,
        royaltyPercentage: royaltyPercentage,
        duration: licenseDuration,
        commercialUse: commercialUse,
        terms: JSON.stringify({
          transferable: true,
          commercialAttribution: commercialAttribution,
          commercializerChecker: commercializerChecker,
          commercializerCheckerData: commercializerCheckerData,
          commercialRevShare: commercialRevShare,
          commercialRevCeiling: commercialRevCeiling,
          derivativesAllowed: derivativesAllowed,
          derivativesAttribution: derivativesAttribution,
          derivativesApproval: derivativesApproval,
          derivativesReciprocal: derivativesReciprocal,
          derivativeRevCeiling: derivativeRevCeiling,
          currency: licenseCurrency,
        }),
      }

      // Call backend API
      const response = await fetch(`${BACKEND_URL}/api/license/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId: selectedTokenId,
          royaltyPercentage: royaltyPercentage,
          duration: licenseDuration,
          commercialUse: commercialUse,
          terms: licenseTerms.terms,
          lobosContractAddress: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to mint license')
      }

      const result = await response.json()
      console.log('License minting successful:', result)

      // Show success notification
      if (result.warning) {
        // Handle case where transaction was submitted but hash couldn't be retrieved
        notifySuccess(
          'License Minting Submitted',
          `Your license minting was submitted successfully!\n\n${result.warning}\n\nPlease check your IP asset details to confirm the license was minted.`,
        )
      } else if (result.data?.txHash) {
        notifySuccess(
          'License Minted',
          `Successfully minted license!\nTransaction: ${result.data.txHash}`,
          {
            action: {
              label: 'View Transaction',
              onClick: () =>
                window.open(
                  `https://testnet.bscscan.com/tx/${result.data.txHash}`,
                  '_blank',
                ),
            },
          },
        )
      } else {
        notifySuccess(
          'License Minted',
          `Successfully minted license!${result.message ? '\n' + result.message : ''}`,
        )
      }

      // Reset form
      setSelectedTokenId(1)
      setSelectedLicenseTemplate('custom')
      setRoyaltyPercentage(10)
      setLicenseDuration(86400)
      setCommercialUse(true)
      setCommercialAttribution(true)
      setCommercializerChecker('0x0000000000000000000000000000000000000000')
      setCommercializerCheckerData('0000000000000000000000000000000000000000')
      setCommercialRevShare(100000000)
      setCommercialRevCeiling(0)
      setDerivativesAllowed(true)
      setDerivativesAttribution(true)
      setDerivativesApproval(false)
      setDerivativesReciprocal(true)
      setDerivativeRevCeiling(0)
      setLicenseCurrency('0x15140000000000000000000000000000000000000')

      // Reload data
      await loadContractData()
    } catch (error) {
      console.error('Error minting license:', error)
      notifyError(
        'License Minting Failed',
        error instanceof Error ? error.message : 'Failed to mint license',
      )
    } finally {
      setLoading(false)
    }
  }

  // Calculate and update royalty breakdown when payment amount or token changes
  useEffect(() => {
    if (paymentAmount && parseFloat(paymentAmount) > 0 && paymentTokenId) {
      const breakdown = calculateRoyaltyBreakdown(
        parseFloat(paymentAmount),
        paymentTokenId,
      )
      setRoyaltyBreakdown(breakdown)
    } else {
      setRoyaltyBreakdown(null)
    }
  }, [paymentAmount, paymentTokenId, licenses, ipAssets])

  // Load accumulated royalties when claim token changes
  useEffect(() => {
    if (claimTokenId && account?.address) {
      loadAccumulatedRoyalties(claimTokenId)
    }
  }, [claimTokenId, account?.address])

  // Pay Revenue
  const payRevenue = async () => {
    if (!account?.address || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      notifyError('Invalid Payment', 'Please enter a valid payment amount')
      return
    }

    try {
      setLoading(true)

      // Show breakdown in notification
      if (royaltyBreakdown) {
        const breakdownText = [
          `Total: ${royaltyBreakdown.totalAmount} tBNB`,
          `Platform Fee: ${royaltyBreakdown.platformFee.toFixed(6)} tBNB (2.5%)`,
          ...royaltyBreakdown.licenseRoyalties.map(
            (lr) =>
              `License ${lr.licenseId}: ${lr.amount.toFixed(6)} tBNB (${lr.royaltyPercentage}%)`,
          ),
          `IP Owner: ${royaltyBreakdown.ipOwnerShare.toFixed(6)} tBNB`,
        ].join('\n')
        notifyInfo('Payment Breakdown', breakdownText)
      }

      notifyInfo(
        'Processing Payment',
        `Paying ${paymentAmount} tBNB in revenue...`,
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'payRevenue',
        params: [BigInt(paymentTokenId)],
        value: parseEther(paymentAmount),
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      // Show success notification
      notifySuccess(
        'Payment Successful',
        `Successfully paid ${paymentAmount} tBNB in revenue!`,
      )

      // Reset form
      setPaymentAmount('')
      setPaymentTokenId(1)

      // Reload data
      await loadContractData()
    } catch (error: any) {
      // Check for specific error messages in multiple possible locations
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        error?.cause?.shortMessage ||
        error?.toString() ||
        ''

      // Check if it's a network/RPC error
      const isNetworkError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        (error?.name === 'TypeError' && errorMessage.includes('fetch'))

      if (isNetworkError) {
        console.error('Network error paying revenue:', error)
        notifyError(
          'Network Error',
          'Failed to connect to the blockchain network. Please check your internet connection and try again. If the problem persists, the RPC endpoint may be temporarily unavailable.',
        )
      } else {
        console.error('Error paying revenue:', error)
        notifyError(
          'Payment Failed',
          errorMessage || 'Failed to pay revenue. Please try again.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // Claim Royalties
  const claimRoyalties = async () => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Claiming Royalties', 'Processing royalty claim...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'claimRoyalties',
        params: [BigInt(claimTokenId)],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      // Show success notification with amount
      const claimedAmount = accumulatedRoyalties.get(claimTokenId) || 0n
      notifySuccess(
        'Royalties Claimed',
        `Successfully claimed ${formatEther(claimedAmount)} tBNB!`,
      )

      // Update accumulated royalties
      setAccumulatedRoyalties((prev) => {
        const newMap = new Map(prev)
        newMap.set(claimTokenId, 0n)
        return newMap
      })

      // Reload data
      await loadContractData()

      // Reload accumulated royalties
      if (claimTokenId) {
        await loadAccumulatedRoyalties(claimTokenId)
      }
    } catch (error: any) {
      // Check for specific error messages in multiple possible locations
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        error?.cause?.shortMessage ||
        error?.toString() ||
        ''

      // Check if the error is about no royalties available
      const isNoRoyaltiesError =
        errorMessage.includes('No royalties to claim') ||
        errorMessage.includes('No royalties available') ||
        errorMessage.includes('No balance to claim') ||
        (errorMessage.includes('revert') &&
          errorMessage.includes('No royalties'))

      if (isNoRoyaltiesError) {
        notifyWarning(
          'No Royalties Available',
          'There are no royalties available to claim for this IP asset.',
        )
      } else {
        console.error('Error claiming royalties:', error)
        notifyError(
          'Claim Failed',
          errorMessage || 'Failed to claim royalties. Please try again.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // Arbitration Functions
  const raiseDispute = async () => {
    if (!account?.address || !disputeReason.trim()) {
      notifyError('Invalid Input', 'Please enter a dispute reason')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Raising Dispute', 'Submitting dispute...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'raiseDispute',
        params: [BigInt(disputeTokenId), disputeReason],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      // Get the next dispute ID (it will be the new dispute's ID)
      const nextDisputeId = await readContract({
        contract,
        method: 'nextDisputeId',
        params: [],
      })
      const newDisputeId = Number(nextDisputeId) - 1 // The dispute ID that was just created

      // Reload data
      await loadArbitrationData()
      await loadContractData()

      notifySuccess(
        'Dispute Raised',
        `Dispute #${newDisputeId} has been successfully raised! You can see it in the disputes list below.`,
      )
      setDisputeReason('')
    } catch (error: any) {
      console.error('Error raising dispute:', error)
      notifyError('Dispute Failed', error?.message || 'Failed to raise dispute')
    } finally {
      setLoading(false)
    }
  }

  const registerArbitrator = async () => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Registering Arbitrator',
        `Registering with ${minArbitratorStake} tBNB stake...`,
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'registerArbitrator',
        params: [],
        value: parseEther(minArbitratorStake),
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Arbitrator Registered',
        'Successfully registered as an arbitrator!',
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error registering arbitrator:', error)
      notifyError(
        'Registration Failed',
        error?.message || 'Failed to register as arbitrator',
      )
    } finally {
      setLoading(false)
    }
  }

  const unstakeArbitrator = async () => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)

      // Check arbitrator status before unstaking
      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Get arbitrator details
      const arbitratorDetails = await readContract({
        contract,
        method: 'getArbitrator',
        params: [account.address],
      })

      const stake = arbitratorDetails[1]
      const isActive = arbitratorDetails[5]

      if (!isActive || stake === 0n) {
        notifyError(
          'Not Registered',
          'You are not registered as an active arbitrator or have no stake to withdraw.',
        )
        return
      }

      // Check active disputes
      let activeDisputes = 0
      try {
        const activeDisputesCount = await readContract({
          contract,
          method: 'getArbitratorActiveDisputes',
          params: [account.address],
        })
        activeDisputes = Number(activeDisputesCount)
      } catch (e: any) {
        // If function doesn't exist, calculate manually
        const arb = arbitratorsMap.get(account.address)
        activeDisputes = arb?.activeDisputes || 0
      }

      if (activeDisputes > 0) {
        notifyError(
          'Active Disputes',
          `Cannot unstake while assigned to ${activeDisputes} active dispute(s). Please wait for disputes to be resolved.`,
        )
        return
      }

      notifyInfo(
        'Unstaking Arbitrator',
        `Withdrawing ${formatEther(stake)} tBNB stake...`,
      )

      const preparedCall = await prepareContractCall({
        contract,
        method: 'unstake',
        params: [],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Stake Withdrawn',
        `Successfully withdrew ${formatEther(stake)} tBNB! You are no longer an active arbitrator.`,
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error unstaking arbitrator:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to unstake'

      if (
        errorMessage.includes(
          'Cannot unstake while assigned to active disputes',
        )
      ) {
        notifyError(
          'Active Disputes',
          'Cannot unstake while assigned to active disputes. Please wait for disputes to be resolved.',
        )
      } else if (errorMessage.includes('Not registered as arbitrator')) {
        notifyError(
          'Not Registered',
          'You are not registered as an arbitrator.',
        )
      } else if (errorMessage.includes('No stake to withdraw')) {
        notifyError('No Stake', 'You have no stake to withdraw.')
      } else {
        notifyError('Unstake Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const assignArbitrators = async (
    disputeId: number,
    selectedArbitrators: string[],
  ) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    if (selectedArbitrators.length === 0) {
      notifyError('Invalid Selection', 'Please select at least one arbitrator')
      return
    }

    if (selectedArbitrators.length > 3) {
      notifyError('Invalid Selection', 'Maximum 3 arbitrators can be assigned')
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Assigning Arbitrators',
        `Assigning ${selectedArbitrators.length} arbitrator(s) to dispute...`,
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'assignArbitrators',
        params: [BigInt(disputeId), selectedArbitrators],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Arbitrators Assigned',
        `${selectedArbitrators.length} arbitrator(s) have been assigned to dispute #${disputeId}!`,
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error assigning arbitrators:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to assign arbitrators'

      if (errorMessage.includes('Arbitrators already assigned')) {
        notifyError(
          'Already Assigned',
          'This dispute already has arbitrators assigned.',
        )
      } else if (errorMessage.includes('Arbitrator not active')) {
        notifyError(
          'Invalid Arbitrator',
          'One or more selected arbitrators are not active.',
        )
      } else {
        notifyError('Assignment Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const checkAndResolveArbitration = async (disputeId: number) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    if (!isOwner) {
      notifyError(
        'Unauthorized',
        'Only the contract owner can manually trigger resolution.',
      )
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Checking Resolution',
        'Checking if dispute can be resolved after 24h wait period...',
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'checkAndResolveArbitration',
        params: [BigInt(disputeId)],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Dispute Resolved',
        'Dispute has been resolved after 24 hour waiting period!',
      )
      await loadArbitrationData()
      await loadContractData()
    } catch (error: any) {
      console.error('Error checking and resolving arbitration:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to resolve dispute'

      if (errorMessage.includes('Minimum uphold votes not reached')) {
        notifyError(
          'Not Enough Votes',
          'At least 3 uphold votes are required to resolve.',
        )
      } else if (errorMessage.includes('24 hour waiting period not passed')) {
        notifyError(
          'Waiting Period',
          '24 hours have not passed since 3 uphold votes were reached.',
        )
      } else if (
        errorMessage.includes('Three uphold votes timestamp not set')
      ) {
        notifyError(
          'No Timestamp',
          'Three uphold votes have not been reached yet.',
        )
      } else {
        notifyError('Resolution Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const transferIP = async (tokenId: number, recipient: string) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    if (!recipient || !recipient.trim()) {
      notifyError('Invalid Recipient', 'Please enter a recipient address')
      return
    }

    // Basic address validation
    if (!recipient.startsWith('0x') || recipient.length !== 42) {
      notifyError(
        'Invalid Address',
        'Please enter a valid Ethereum address (0x...)',
      )
      return
    }

    // Check if user owns the token
    const asset = ipAssets.get(tokenId)
    if (!asset) {
      notifyError('Token Not Found', 'IP asset not found')
      return
    }

    if (asset.owner.toLowerCase() !== account.address.toLowerCase()) {
      notifyError('Not Owner', 'You are not the owner of this IP asset')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Transferring IP', 'Initiating IP asset transfer...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Check for active disputes first
      try {
        const hasActive = await readContract({
          contract,
          method: 'hasActiveDisputes',
          params: [BigInt(tokenId)],
        })
        if (hasActive) {
          // Get all disputes for this token to show details
          try {
            const disputeIds = await readContract({
              contract,
              method: 'getTokenDisputes',
              params: [BigInt(tokenId)],
            })

            const unresolvedDisputes: number[] = []
            for (const disputeId of disputeIds) {
              try {
                const dispute = await readContract({
                  contract,
                  method: 'getDispute',
                  params: [BigInt(disputeId)],
                })
                if (!dispute[5]) {
                  // isResolved is at index 5
                  unresolvedDisputes.push(Number(disputeId))
                }
              } catch (e) {
                console.error(`Error fetching dispute ${disputeId}:`, e)
              }
            }

            if (unresolvedDisputes.length > 0) {
              notifyError(
                'Active Disputes',
                `Cannot transfer IP asset. There are ${unresolvedDisputes.length} unresolved dispute(s): ${unresolvedDisputes.join(', ')}. Please resolve all disputes first.`,
              )
            } else {
              notifyError(
                'Active Disputes',
                'Cannot transfer IP asset with active disputes. Please resolve all disputes first.',
              )
            }
          } catch (e) {
            console.error('Error fetching dispute details:', e)
            notifyError(
              'Active Disputes',
              'Cannot transfer IP asset with active disputes. Please resolve all disputes first.',
            )
          }
          setLoading(false)
          return
        }
      } catch (e) {
        console.error('Error checking active disputes:', e)
        // If the check itself fails, we should still try to proceed
        // but the contract will revert if there are active disputes
      }

      const preparedCall = await prepareContractCall({
        contract,
        method: 'transferIP',
        params: [BigInt(tokenId), recipient as `0x${string}`],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Transfer Successful',
        `IP asset #${tokenId} has been transferred to ${recipient.substring(0, 10)}...${recipient.substring(recipient.length - 8)}`,
      )
      await loadContractData()
    } catch (error: any) {
      console.error('Error transferring IP:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to transfer IP asset'

      if (
        errorMessage.includes('Cannot transfer IP with active disputes') ||
        errorMessage.includes('active disputes')
      ) {
        notifyError(
          'Active Disputes',
          'This IP asset has active disputes. Please resolve them before transferring.',
        )
      } else if (errorMessage.includes('Not the owner')) {
        notifyError('Not Owner', 'You are not the owner of this IP asset.')
      } else if (errorMessage.includes('Token does not exist')) {
        notifyError('Token Not Found', 'IP asset does not exist.')
      } else {
        notifyError('Transfer Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const resolveDisputeWithoutArbitrators = async (disputeId: number) => {
    if (!account?.address) {
      notifyError('Wallet Not Connected', 'Please connect your wallet')
      return
    }

    try {
      setLoading(true)
      notifyInfo(
        'Resolving Dispute',
        'Resolving dispute without arbitrators...',
      )

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'resolveDisputeWithoutArbitrators',
        params: [BigInt(disputeId)],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Dispute Resolved',
        'Dispute has been auto-rejected due to no arbitrators available.',
      )
      await loadArbitrationData()
    } catch (error: any) {
      console.error('Error resolving dispute:', error)
      const errorMessage =
        error?.message ||
        error?.shortMessage ||
        error?.cause?.message ||
        'Failed to resolve dispute'

      // Check for specific error messages
      if (
        errorMessage.includes('Only the dispute author can resolve') ||
        errorMessage.includes('dispute author')
      ) {
        notifyError(
          'Authorization Failed',
          'Only the person who raised the dispute can resolve it when no arbitrators are available.',
        )
      } else if (errorMessage.includes('Deadline not passed')) {
        notifyError(
          'Deadline Not Passed',
          'The 7-day deadline has not yet passed. Please wait until after the deadline.',
        )
      } else if (errorMessage.includes('Arbitrators already assigned')) {
        notifyError(
          'Arbitrators Assigned',
          'This dispute already has arbitrators assigned. Use the normal arbitration process.',
        )
      } else {
        notifyError('Resolution Failed', errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const submitArbitrationDecision = async (disputeId: number) => {
    if (!account?.address || !arbitrationResolution.trim()) {
      notifyError('Invalid Input', 'Please enter a resolution statement')
      return
    }

    try {
      setLoading(true)
      notifyInfo('Submitting Decision', 'Submitting arbitration decision...')

      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      const preparedCall = await prepareContractCall({
        contract,
        method: 'submitArbitrationDecision',
        params: [BigInt(disputeId), arbitrationDecision, arbitrationResolution],
      })

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      })

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        transactionHash: transaction.transactionHash,
      })

      notifySuccess(
        'Decision Submitted',
        'Your arbitration decision has been submitted!',
      )
      setArbitrationResolution('')
      await loadArbitrationData()
      await loadContractData()
    } catch (error: any) {
      console.error('Error submitting decision:', error)
      notifyError(
        'Submission Failed',
        error?.message || 'Failed to submit arbitration decision',
      )
    } finally {
      setLoading(false)
    }
  }

  const loadArbitrationData = async () => {
    if (!account?.address) return

    try {
      const contract = getContract({
        abi: MODRED_IP_ABI,
        client: thirdwebClient,
        chain: defineChain(bnbChain.id),
        address: CONTRACT_ADDRESSES['ModredIPModule#ModredIP'],
      })

      // Load minimum stake with error handling
      try {
        const minStake = await readContract({
          contract,
          method: 'MIN_ARBITRATOR_STAKE',
          params: [],
        })
        setMinArbitratorStake(formatEther(minStake))
        console.log('✅ Loaded MIN_ARBITRATOR_STAKE:', formatEther(minStake))
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'MIN_ARBITRATOR_STAKE' not available. Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading MIN_ARBITRATOR_STAKE:', errorMessage)
        }
        // Set a default minimum stake (e.g., 0.1 ETH)
        setMinArbitratorStake('0.1')
      }

      // Load active arbitrator count with error handling
      try {
        const activeCount = await readContract({
          contract,
          method: 'getActiveArbitratorsCount',
          params: [],
        })
        setActiveArbitratorsCount(Number(activeCount))
        console.log('✅ Loaded active arbitrators count:', Number(activeCount))
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'getActiveArbitratorsCount' not available. Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn(
            '⚠️ Error loading getActiveArbitratorsCount:',
            errorMessage,
          )
        }
        setActiveArbitratorsCount(0)
      }

      // Load all arbitrators with error handling
      let arbitratorAddresses: readonly `0x${string}`[] = []
      try {
        const result = await readContract({
          contract,
          method: 'getAllArbitrators',
          params: [],
        })
        // Type assertion: readContract returns address[] which we cast to 0x${string}[]
        // This is safe because all Ethereum addresses start with 0x
        arbitratorAddresses = result as readonly `0x${string}`[]
        // Convert to mutable string array for state (string[] is compatible)
        setAllArbitrators(Array.from(arbitratorAddresses))
        console.log('✅ Loaded arbitrators:', arbitratorAddresses.length)
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'getAllArbitrators' not available. Using empty array.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading getAllArbitrators:', errorMessage)
        }
        setAllArbitrators([])
      }

      // Load arbitrator details
      const arbitratorDetails = new Map<string, any>()
      for (const addr of arbitratorAddresses) {
        try {
          const details = await readContract({
            contract,
            method: 'getArbitrator',
            params: [addr],
          })

          // Try to get active disputes count from contract function
          let activeDisputes = 0
          try {
            const activeDisputesCount = await readContract({
              contract,
              method: 'getArbitratorActiveDisputes',
              params: [addr],
            })
            activeDisputes = Number(activeDisputesCount)
          } catch (e: any) {
            // Function doesn't exist or reverts - we'll calculate it manually below
            const errorMsg = e?.message || e?.shortMessage || String(e || '')
            const errorCode = e?.code
            const isExpectedError =
              errorMsg.includes('zero data') ||
              errorMsg.includes('Cannot decode') ||
              errorMsg.includes('AbiDecodingZeroDataError') ||
              errorMsg.includes('execution reverted') ||
              errorCode === 3

            if (!isExpectedError) {
              console.warn(
                `⚠️ Unexpected error loading active disputes for ${addr}:`,
                errorMsg,
              )
            }
            // Will calculate manually below
            activeDisputes = -1 // Use -1 as marker to calculate manually
          }

          arbitratorDetails.set(addr, {
            arbitrator: details[0],
            stake: details[1],
            reputation: details[2],
            totalCases: details[3],
            successfulCases: details[4],
            isActive: details[5],
            registrationDate: details[6],
            activeDisputes: activeDisputes, // Will be updated below if -1
          })
        } catch (e: any) {
          // Silently handle zero data errors
          const errorMsg = e?.message || e?.shortMessage || String(e || '')
          const isZeroDataError =
            errorMsg.includes('zero data') ||
            errorMsg.includes('Cannot decode') ||
            errorMsg.includes('AbiDecodingZeroDataError')

          if (!isZeroDataError) {
            console.error(`Error loading arbitrator ${addr}:`, e)
          }
        }
      }
      setArbitratorsMap(arbitratorDetails)

      // Load all disputes with error handling
      let nextDisputeIdNum = 1
      try {
        const nextDisputeId = await readContract({
          contract,
          method: 'nextDisputeId',
          params: [],
        })
        nextDisputeIdNum = Number(nextDisputeId)
        console.log('✅ Loaded nextDisputeId:', nextDisputeIdNum)
      } catch (error: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage =
          error?.message || error?.shortMessage || String(error || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'nextDisputeId' not available. Using default value.",
          )
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading nextDisputeId:', errorMessage)
        }
        // Use default value of 1 (no disputes registered yet)
        nextDisputeIdNum = 1
      }

      const disputesData = new Map<number, any>()
      for (let i = 1; i < nextDisputeIdNum; i++) {
        try {
          const dispute = await readContract({
            contract,
            method: 'getDispute',
            params: [BigInt(i)],
          })
          disputesData.set(i, {
            disputeId: Number(dispute[0]),
            tokenId: Number(dispute[1]),
            disputer: dispute[2],
            reason: dispute[3],
            timestamp: dispute[4],
            isResolved: dispute[5],
            arbitrationId: Number(dispute[6]),
          })
        } catch (e) {
          // Dispute doesn't exist, skip
          console.error(`Error loading dispute ${i}:`, e)
        }
      }
      setDisputesMap(disputesData)

      // Load arbitration details for all disputes (both resolved and unresolved)
      // We need this to calculate active disputes per arbitrator
      const arbitrationsData = new Map<number, any>()
      for (const [, dispute] of disputesData.entries()) {
        // Load arbitration if it exists (disputes with assigned arbitrators have arbitrationId > 0)
        if (dispute.arbitrationId > 0) {
          try {
            const arbitration = await readContract({
              contract,
              method: 'getArbitration',
              params: [BigInt(dispute.arbitrationId)],
            })
            arbitrationsData.set(dispute.arbitrationId, {
              arbitrationId: Number(arbitration[0]),
              disputeId: Number(arbitration[1]),
              arbitrators: arbitration[2],
              votesFor: Number(arbitration[3]),
              votesAgainst: Number(arbitration[4]),
              deadline: arbitration[5],
              isResolved: arbitration[6],
              resolution: arbitration[7],
              threeUpholdVotesTimestamp: arbitration[8],
            })
          } catch (e) {
            // Silently handle errors - arbitration might not exist yet
            console.log(
              `ℹ️ Arbitration ${dispute.arbitrationId} not available yet`,
            )
          }
        }
      }
      setArbitrationsMap(arbitrationsData)

      // Calculate active disputes per arbitrator manually (workaround when getArbitratorActiveDisputes doesn't work)
      // This counts unresolved disputes where the arbitrator is assigned
      for (const [addr, arbitratorInfo] of arbitratorDetails.entries()) {
        if (arbitratorInfo.activeDisputes === -1) {
          // Calculate manually by counting unresolved disputes where this arbitrator is assigned
          let count = 0
          for (const [, dispute] of disputesData.entries()) {
            if (!dispute.isResolved && dispute.arbitrationId > 0) {
              const arbitration = arbitrationsData.get(dispute.arbitrationId)
              if (arbitration && arbitration.arbitrators) {
                // Check if this arbitrator is in the arbitrators list
                const isAssigned = arbitration.arbitrators.some(
                  (arbAddr: string) =>
                    arbAddr.toLowerCase() === addr.toLowerCase(),
                )
                if (isAssigned && !arbitration.isResolved) {
                  count++
                }
              }
            }
          }
          arbitratorInfo.activeDisputes = count
          if (count > 0) {
            console.log(
              `✅ Calculated ${count} active dispute(s) for arbitrator ${addr.substring(0, 10)}...`,
            )
          }
        }
      }

      // Load contract owner with error handling
      try {
        const ownerAddress = await readContract({
          contract,
          method: 'owner',
          params: [],
        })
        setIsOwner(
          account?.address?.toLowerCase() === ownerAddress.toLowerCase(),
        )
        console.log('✅ Loaded contract owner:', ownerAddress)
      } catch (e: any) {
        // Check if it's a zero data error (expected when function doesn't exist or contract not fully deployed)
        const errorMessage = e?.message || e?.shortMessage || String(e || '')
        const isZeroDataError =
          errorMessage.includes('zero data') ||
          errorMessage.includes('Cannot decode') ||
          errorMessage.includes('AbiDecodingZeroDataError')

        if (isZeroDataError) {
          // Silently handle zero data errors - this is expected for new contracts
          console.log(
            "ℹ️ Contract function 'owner' not available. Assuming user is not the owner.",
          )
          setIsOwner(false) // Default to false if we can't determine
        } else {
          // Log other errors as warnings
          console.warn('⚠️ Error loading contract owner:', errorMessage)
          setIsOwner(false) // Default to false on error
        }
      }
    } catch (error: any) {
      // Only log unexpected errors, not zero data errors
      const errorMessage =
        error?.message || error?.shortMessage || String(error || '')
      const isZeroDataError =
        errorMessage.includes('zero data') ||
        errorMessage.includes('Cannot decode') ||
        errorMessage.includes('AbiDecodingZeroDataError')

      if (!isZeroDataError) {
        console.error('Error loading arbitration data:', error)
      } else {
        console.log(
          'ℹ️ Some arbitration contract functions returned zero data (expected for new contracts). Continuing with defaults.',
        )
      }
    }
  }

  // Load arbitration data on mount
  useEffect(() => {
    if (account?.address) {
      loadArbitrationData()
    }
  }, [account?.address])

  // Show landing page until wallet is connected
  if (!account?.address) {
    return (
      <div className="app bottie-app-shell">
        <NotificationToasts />

        <header className="bottie-nav">
          <div className="bottie-brand">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="bottie-logo" />
            <span>Bluvfi</span>
          </div>
          <nav className="bottie-links" aria-label="Primary">
            <a href="#sessions">How it works</a>
            <a href="#execution">Steps</a>
            <a href="#security">Safety</a>
            <a href="/bluvfi-testers">Tester program</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="bottie-nav-cta" href="#waitlist">
            Get early access
          </a>
        </header>

        <main className="landing-redesign">
          <section className="bottie-hero">
            <div className="bottie-hero-copy">
              <p className="bottie-kicker">Financial decisions and payments, faster</p>
              <h1 className="bottie-title">
                Make financial decisions easily and pay for what you need faster.
              </h1>
              <p className="bottie-subtitle">
                Bluvfi lets you make payments with tap or chat while keeping every transaction routed through secure protection layers.
              </p>
              <div className="bottie-actions">
                <a
                  className="bottie-primary-btn"
                  href="#waitlist"
                >
                  Get early access
                </a>
                <a className="bottie-secondary-btn" href="#sessions">
                  See how it works
                </a>
              </div>
              <div className="bottie-trust-row" aria-label="Product highlights">
                <span>✅ You stay in control</span>
                <span>⚡ AI does the work</span>
                <span>🔒 Nothing sneaks past</span>
              </div>
            </div>

            <div
              className="bottie-console-stage"
              aria-label="Bottie workflow preview"
            >
              <div className="bottie-console">
                <div className="phone-topbar">
                  <span>Bluvfi payment session</span>
                  <span>LIVE</span>
                </div>
                <div className="balance-card">
                  <span>Spending limit you set</span>
                  <strong>$25</strong>
                  <small>
                    Your payment stays within the amount you approve.
                  </small>
                </div>
                <div className="quick-actions">
                  <span>Allow</span>
                  <span>Run</span>
                  <span>Stop</span>
                </div>
                <div className="activity-card deposit">
                  <div>
                    <span>Checked payment option</span>
                    <p>Decision support completed</p>
                  </div>
                  <strong>✅ Done</strong>
                </div>
                <div className="activity-card">
                  <div>
                    <span>Completed payment</span>
                    <p>Only the route you approved</p>
                  </div>
                  <strong>✅ Allowed</strong>
                </div>
              </div>
              <div className="floating-receipt">
                <span>Your wallet stays protected</span>
                <strong>Session ends in 18 min</strong>
              </div>
            </div>
          </section>

          <section id="sessions" className="bottie-section bottie-split">
            <div>
              <p className="bottie-kicker">
                Your payment flow, your control
              </p>
              <h2>
                Choose what you need, confirm the route, and let Bluvfi handle the payment flow.
              </h2>
              <p>
                Bluvfi is built for clear payment decisions. You pick the action, approve the amount, and keep control while the app routes the payment securely.
              </p>
            </div>
            <div className="chain-panel">
              {[
                ['Connect your wallet', 'You own it'],
                ['Choose what to pay', 'Your rules'],
                ['Confirm in seconds', 'Auto-pilot'],
                ['Every step is protected', 'Nothing sneaks by'],
              ].map(([label, status]) => (
                <div className="chain-row" key={label}>
                  <span>{label}</span>
                  <strong>{status}</strong>
                </div>
              ))}
            </div>
          </section>

          <section id="execution" className="bottie-section">
            <div className="section-intro">
              <p className="bottie-kicker">How it works in 3 steps</p>
              <h2>Simple as 1, 2, 3.</h2>
            </div>
            <div className="payment-grid">
              <article className="payment-card">
                <span className="payment-icon">01</span>
                <h3>You say what's allowed</h3>
                <p>
                  Pick which apps your AI can use, how much it can spend, and set a time limit. Like giving someone a permission slip.
                </p>
                <div className="mini-ledger">
                  <span>Set rules once</span>
                  <strong>Locked in</strong>
                </div>
              </article>

              <article className="payment-card scan-card">
                <span className="payment-icon">02</span>
                <h3>Bluvfi routes the payment</h3>
                <p>
                  Pay for what you need quickly after reviewing the amount, route, and action.
                </p>
                <div className="qr-box" aria-label="QR payment scan preview">
                  {Array.from({ length: 25 }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        index % 3 === 0 || index % 7 === 0 ? 'active' : ''
                      }
                    ></span>
                  ))}
                </div>
                <small>Payment confirmed ✅</small>
              </article>

              <article className="payment-card conversion-card">
                <span className="payment-icon">03</span>
                <h3>Payments complete, you stay protected</h3>
                <p>
                  Bluvfi completes the payment flow while keeping the sensitive parts of your wallet experience protected.
                </p>
                <div className="rate-ticket">
                  <span>Task complete</span>
                  <strong>All safe 🔒</strong>
                </div>
              </article>
            </div>
          </section>

          <section id="security" className="bottie-section benefit-band">
            {[
              'Your wallet stays protected',
              'You approve what happens',
              'Payments only go where you approved',
              'Cancel anytime with one click',
            ].map((benefit) => (
              <div className="benefit-item" key={benefit}>
                <span></span>
                <p>{benefit}</p>
              </div>
            ))}
          </section>

          {/* FAQ Section */}
          <section id="faq" className="bottie-section">
            <div style={{ maxWidth: "720px", margin: "0 auto", width: "100%" }}>
              <p className="bottie-kicker">Got questions?</p>
              <h2 style={{ marginBottom: "2rem" }}>Simple answers to simple questions</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    q: "What is Bluvfi, in plain English?",
                    a: "Bluvfi is an app for making financial decisions and payments faster with tap or chat, while keeping the payment route secure."
                  },
                  {
                    q: "Is my money safe?",
                    a: "Yes. You set a spending limit before anything starts. The AI can only spend up to that amount, in the places you approve, before the time you set runs out. Your main wallet is never touched."
                  },
                  {
                    q: "How is this different from just using an AI chatbot?",
                    a: "Bluvfi is focused on action. It helps you move from deciding what to pay for to completing the payment quickly, with approvals and safeguards in the flow."
                  },
                  {
                    q: "Can I stop the AI anytime?",
                    a: "Yes! You can cancel at any moment. Sessions also stop automatically when time runs out or the spending limit is hit. You're always in control."
                  },
                  {
                    q: "Is Bluvfi ready to use right now?",
                    a: "Bluvfi is in closed testing. Join the waitlist or tester program to get access updates as features ship."
                  },
                ].map((item, index) => (
                  <details
                    key={index}
                    style={{
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <summary style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      listStyle: "none",
                      WebkitAppearance: "none",
                    }}>
                      {item.q}
                      <span style={{ fontSize: "1.2rem" }}>+</span>
                    </summary>
                    <p style={{
                      marginTop: "0.75rem",
                      fontSize: "15px",
                      lineHeight: "1.6",
                      color: "rgba(0,0,0,0.7)",
                    }}>
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section id="waitlist" className="bottie-section waitlist-section">
            <p className="bottie-kicker">
              Be first in line 🚀
            </p>
            <h2>
              Want faster payments with tap or chat?
            </h2>
            <p>
              Join the waitlist and we'll let you know when Bluvfi access opens. No spam. Just the update you need.
            </p>
            <div className="bottie-actions centered-actions">
              <a className="bottie-secondary-btn" href="/bluvfi-testers">
                Open tester program
              </a>
            </div>
            <TallyEmbed />
          </section>

          <footer className="bottie-footer">
            <div className="bottie-brand">
              <img
                src="/Bluvfiv2.jpg"
                alt="Bluvfi logo"
                className="bottie-logo"
              />
              <span>Bluvfi</span>
            </div>
            <div className="footer-links">
              <a
                href="https://github.com/Afoxcute/bluvfi"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a
                href="https://payai.network"
                target="_blank"
                rel="noopener noreferrer"
              >
                PayAI
              </a>
              <a
                href="https://reown.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Reown
              </a>
            </div>
            <p>Built so payments feel faster, clearer, and safer.</p>
          </footer>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Toast Notifications */}
      <NotificationToasts />

      {/* Modern Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-logo">
            <img src="/Bluvfiv2.jpg" alt="Bluvfi logo" className="logo-image" />
            <h1>Bluvfi</h1>
          </div>
          <div className="header-actions">
            <div
              className={`status-indicator ${backendStatus ? 'connected' : 'disconnected'}`}
            >
              <span className="status-dot"></span>
              <span>
                Backend {backendStatus ? 'Connected' : 'Disconnected'}
              </span>
              <button onClick={checkBackendStatus} className="refresh-btn">
                🔄
              </button>
            </div>
            <NotificationButton />
            <ConnectButton
              client={thirdwebClient}
              wallets={wallets}
              chain={defineChain(bnbChain.id)}
            />
          </div>
        </div>
      </header>

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Processing your request...</p>
        </div>
      )}

      <div className="main-content">
        {/* Dashboard Navigation */}
        <div className="dashboard-nav">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`nav-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            📝 Register IP
          </button>
          <button
            className={`nav-tab ${activeTab === 'license' ? 'active' : ''}`}
            onClick={() => setActiveTab('license')}
          >
            🎫 License Management
          </button>
          <button
            className={`nav-tab ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveTab('revenue')}
          >
            💰 Revenue & Analytics
          </button>
          <button
            className={`nav-tab ${activeTab === 'arbitration' ? 'active' : ''}`}
            onClick={() => setActiveTab('arbitration')}
          >
            ⚖️ Arbitration
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <IPPortfolio
              assets={ipAssets}
              licenses={licenses}
              metadata={parsedMetadata}
              userAddress={account?.address}
              onTransferIP={transferIP}
            />
          )}

          {/* Register IP Tab */}
          {activeTab === 'register' && (
            <section className="section section-wide">
              <div className="section-header">
                <span className="section-icon">📝</span>
                <h2 className="section-title">Register IP Asset</h2>
              </div>

              <div className="form-grid">
                {/* File Upload */}
                <div
                  className="file-upload-area"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="ip-file-upload"
                    className="file-upload-input"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4"
                  />
                  <div className="file-upload-content">
                    <div className="file-upload-icon">📎</div>
                    <div className="file-upload-text">
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div className="file-upload-hint">
                      PDF, DOC, TXT, JPG, PNG, GIF, MP3, WAV, MP4 (max 50MB)
                    </div>
                  </div>
                </div>

                {filePreview && (
                  <div className="file-preview animate-slide-up">
                    {filePreview.startsWith('data:image') ? (
                      <img
                        src={filePreview}
                        alt="File preview"
                        className="file-preview-image"
                      />
                    ) : (
                      <div className="file-preview-image">📄</div>
                    )}
                    <div className="file-preview-info">
                      <div className="file-preview-name">{ipFile?.name}</div>
                      <div className="file-preview-size">
                        {ipFile
                          ? `${(ipFile.size / 1024 / 1024).toFixed(2)} MB`
                          : ''}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-secondary btn-full"
                  onClick={uploadToIPFS}
                  disabled={!ipFile || loading}
                >
                  {loading ? '⏳ Uploading...' : '🚀 Upload to IPFS'}
                </button>
                {/* IP Details Form */}
                <div className="form-group">
                  <label className="form-label">🔗 IP Hash (IPFS)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ipHash}
                    onChange={(e) => setIpHash(e.target.value)}
                    placeholder="IPFS hash will appear after upload"
                    readOnly
                  />
                </div>

                {ipHash && (
                  <div className="media-preview animate-scale-in">
                    <div className="media-container">
                      {ipFile && ipFile.type.startsWith('image/') ? (
                        <img
                          src={getIPFSGatewayURL(ipHash)}
                          alt="Uploaded media"
                          className="media-image"
                          onError={(e) => {
                            const imgElement = e.target as HTMLImageElement
                            imgElement.style.display = 'none'
                            const fallback =
                              imgElement.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="media-fallback"
                        style={{
                          display: ipFile?.type.startsWith('image/')
                            ? 'none'
                            : 'flex',
                        }}
                      >
                        <div className="media-fallback-icon">📄</div>
                        <p>Media Preview</p>
                        <a
                          href={getIPFSGatewayURL(ipHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="media-link"
                        >
                          🔗 View Media
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">📝 Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={ipName}
                      onChange={(e) => setIpName(e.target.value)}
                      placeholder="Enter a name for your IP asset"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">🔒 Security</label>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={isEncrypted}
                        onChange={(e) => setIsEncrypted(e.target.checked)}
                      />
                      <label className="checkbox-label">
                        Encrypted Content
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">📄 Description</label>
                  <textarea
                    className="form-input form-textarea"
                    value={ipDescription}
                    onChange={(e) => setIpDescription(e.target.value)}
                    placeholder="Describe your IP asset"
                    rows={3}
                  />
                </div>

                <button
                  className="btn btn-primary btn-full"
                  onClick={registerIP}
                  disabled={
                    loading || !account?.address || !ipHash || !ipName.trim()
                  }
                >
                  {loading ? '⏳ Registering...' : '🚀 Register IP Asset'}
                </button>
              </div>
            </section>
          )}

          {/* License Management Tab */}
          {activeTab === 'license' && (
            <section className="section">
              <div className="section-header">
                <span className="section-icon">🎫</span>
                <h2 className="section-title">Mint License</h2>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">🎯 Select IP Asset</label>
                  <select
                    className="form-select"
                    value={selectedTokenId}
                    onChange={(e) => setSelectedTokenId(Number(e.target.value))}
                  >
                    {Array.from(ipAssets.keys()).map((id) => {
                      const asset = ipAssets.get(id)
                      const metadata = parsedMetadata.get(id) || {
                        name: 'Unknown',
                      }
                      return (
                        <option key={id} value={id}>
                          #{id} -{' '}
                          {metadata.name ||
                            asset?.ipHash.substring(0, 10) ||
                            'Unknown'}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* License Template Selector */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <label
                      className="form-label"
                      style={{ margin: 0, flex: 1 }}
                    >
                      📋 License Template
                    </label>
                    {selectedLicenseTemplate !== 'custom' && (
                      <button
                        type="button"
                        onClick={() =>
                          applyLicenseTemplate(selectedLicenseTemplate)
                        }
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          backgroundColor: 'var(--color-secondary, #6c757d)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            'var(--color-secondary-hover, #5a6268)')
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            'var(--color-secondary, #6c757d)')
                        }
                      >
                        🔄 Reset to Template
                      </button>
                    )}
                  </div>
                  <select
                    className="form-select"
                    value={selectedLicenseTemplate}
                    onChange={(e) => applyLicenseTemplate(e.target.value)}
                  >
                    {LICENSE_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.icon} {template.name}
                      </option>
                    ))}
                  </select>
                  {selectedLicenseTemplate !== 'custom' &&
                    (() => {
                      const template = LICENSE_TEMPLATES.find(
                        (t) => t.id === selectedLicenseTemplate,
                      )
                      if (!template) return null

                      // Check if form values match template (to show customization indicator)
                      const isCustomized =
                        royaltyPercentage !== template.royaltyPercentage ||
                        licenseDuration !== template.duration ||
                        commercialUse !== template.commercialUse ||
                        commercialAttribution !==
                          template.commercialAttribution ||
                        derivativesAllowed !== template.derivativesAllowed ||
                        derivativesAttribution !==
                          template.derivativesAttribution ||
                        derivativesApproval !== template.derivativesApproval ||
                        derivativesReciprocal !== template.derivativesReciprocal

                      return (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            backgroundColor: isCustomized
                              ? 'var(--color-warning-bg, #fff3cd)'
                              : 'var(--color-info-bg, #d1ecf1)',
                            border: `1px solid ${
                              isCustomized
                                ? 'var(--color-warning-border, #ffc107)'
                                : 'var(--color-info-border, #0c5460)'
                            }`,
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            color: isCustomized
                              ? 'var(--color-warning-text, #856404)'
                              : 'var(--color-info-text, #0c5460)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <strong>
                              {template.icon} {template.name}
                            </strong>
                            {isCustomized && (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor:
                                    'var(--color-warning, #ffc107)',
                                  color: '#000',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                }}
                              >
                                ✏️ Customized
                              </span>
                            )}
                          </div>
                          <div>{template.description}</div>
                          <div
                            style={{
                              marginTop: '0.5rem',
                              fontSize: '0.8rem',
                              opacity: 0.9,
                            }}
                          >
                            💰 Royalty: {template.royaltyPercentage}% | ⏰
                            Duration: {formatDuration(template.duration)} |
                            {template.commercialUse
                              ? ' 💼 Commercial'
                              : ' 🚫 Non-Commercial'}{' '}
                            |
                            {template.derivativesAllowed
                              ? ' ✏️ Derivatives Allowed'
                              : ' 🔒 No Derivatives'}
                          </div>
                        </div>
                      )
                    })()}
                  <small className="form-hint">
                    Select a predefined template or choose "Custom" to configure
                    manually. Templates can be customized after selection.
                  </small>
                </div>

                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">💰 Royalty (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={royaltyPercentage}
                      onChange={(e) =>
                        setRoyaltyPercentage(Number(e.target.value))
                      }
                      min="1"
                      max="100"
                      placeholder="10"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">⏰ Duration (seconds)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={licenseDuration}
                      onChange={(e) =>
                        setLicenseDuration(Number(e.target.value))
                      }
                      min="3600"
                      placeholder="86400"
                    />
                  </div>
                </div>

                {/* License Terms */}
                <div className="form-group">
                  <label className="form-label">⚙️ License Terms</label>
                  <div className="form-grid">
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={commercialUse}
                        onChange={(e) => setCommercialUse(e.target.checked)}
                      />
                      <label className="checkbox-label">
                        Commercial Use Allowed
                      </label>
                    </div>
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={commercialAttribution}
                        onChange={(e) =>
                          setCommercialAttribution(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Commercial Attribution
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesAllowed}
                        onChange={(e) =>
                          setDerivativesAllowed(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Allowed
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesAttribution}
                        onChange={(e) =>
                          setDerivativesAttribution(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Attribution
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesApproval}
                        onChange={(e) =>
                          setDerivativesApproval(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Approval Required
                      </label>
                    </div>

                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={derivativesReciprocal}
                        onChange={(e) =>
                          setDerivativesReciprocal(e.target.checked)
                        }
                      />
                      <label className="checkbox-label">
                        Derivatives Reciprocal
                      </label>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <details className="form-group">
                  <summary
                    className="form-label"
                    style={{ cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔧 Advanced Settings
                  </summary>
                  <div className="form-grid" style={{ marginTop: '1rem' }}>
                    <div className="form-group-row">
                      <div className="form-group">
                        <label className="form-label">
                          💵 Commercial Rev Share (%)
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={commercialRevShare / 1000000}
                          onChange={(e) =>
                            setCommercialRevShare(
                              Number(e.target.value) * 1000000,
                            )
                          }
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="100"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">
                          🏛️ Commercial Rev Ceiling
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={commercialRevCeiling}
                          onChange={(e) =>
                            setCommercialRevCeiling(Number(e.target.value))
                          }
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        🔍 Commercializer Checker
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={commercializerChecker}
                        onChange={(e) =>
                          setCommercializerChecker(e.target.value)
                        }
                        placeholder="0x0000000000000000000000000000000000000000"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        📊 Derivative Rev Ceiling
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={derivativeRevCeiling}
                        onChange={(e) =>
                          setDerivativeRevCeiling(Number(e.target.value))
                        }
                        min="0"
                        placeholder="0"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">💱 License Currency</label>
                      <input
                        type="text"
                        className="form-input"
                        value={licenseCurrency}
                        onChange={(e) => setLicenseCurrency(e.target.value)}
                        placeholder="0x15140000000000000000000000000000000000000"
                      />
                    </div>
                  </div>
                </details>

                <button
                  className="btn btn-primary btn-full"
                  onClick={mintLicense}
                  disabled={loading || !account?.address}
                >
                  {loading ? '⏳ Minting...' : '🎫 Mint License'}
                </button>
              </div>
            </section>
          )}

          {/* Revenue & Analytics Tab */}
          {activeTab === 'revenue' && (
            <>
              {/* Pay Revenue */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">💳</span>
                  <h2 className="section-title">Pay Revenue</h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Select IP Asset</label>
                    <select
                      className="form-select"
                      value={paymentTokenId}
                      onChange={(e) =>
                        setPaymentTokenId(Number(e.target.value))
                      }
                    >
                      {Array.from(ipAssets.keys()).map((id) => {
                        const asset = ipAssets.get(id)
                        const metadata = parsedMetadata.get(id) || {
                          name: 'Unknown',
                        }
                        return (
                          <option key={id} value={id}>
                            #{id} -{' '}
                            {metadata.name ||
                              asset?.ipHash.substring(0, 10) ||
                              'Unknown'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">💰 Amount (tBNB)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      min="0.001"
                      step="0.001"
                      placeholder="0.001"
                    />
                  </div>

                  {/* Royalty Calculation Preview */}
                  {royaltyBreakdown && (
                    <div
                      className="form-group"
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-info-bg, #d1ecf1)',
                          border: '1px solid var(--color-info-border, #0c5460)',
                          borderRadius: '8px',
                          marginTop: '0.5rem',
                        }}
                      >
                        <h3
                          style={{
                            margin: '0 0 1rem 0',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: 'var(--color-info-text, #0c5460)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          🧮 Automated Royalty Calculation Preview
                        </h3>

                        <div
                          style={{
                            display: 'grid',
                            gap: '0.75rem',
                            fontSize: '0.875rem',
                          }}
                        >
                          {/* Total Payment */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              Total Payment:
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.totalAmount} tBNB
                            </span>
                          </div>

                          {/* Platform Fee */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              🏛️ Platform Fee (2.5%):
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.platformFee.toFixed(6)} tBNB
                            </span>
                          </div>

                          {/* Remaining After Fee */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              borderTop: '1px solid rgba(0,0,0,0.1)',
                              borderBottom: '1px solid rgba(0,0,0,0.1)',
                              marginTop: '0.25rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              💰 Available for Distribution:
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.remainingAfterFee.toFixed(6)}{' '}
                              tBNB
                            </span>
                          </div>

                          {/* License Royalties */}
                          {royaltyBreakdown.licenseRoyalties.length > 0 && (
                            <>
                              <div
                                style={{
                                  marginTop: '0.5rem',
                                  paddingTop: '0.5rem',
                                  borderTop: '1px solid rgba(0,0,0,0.2)',
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: '0.8rem',
                                    opacity: 0.9,
                                    color: '#1e293b',
                                  }}
                                >
                                  License Holder Royalties:
                                </strong>
                              </div>
                              {royaltyBreakdown.licenseRoyalties.map(
                                (lr, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      padding: '0.5rem',
                                      backgroundColor:
                                        'rgba(255, 255, 255, 0.2)',
                                      borderRadius: '4px',
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    <span style={{ color: '#1e293b' }}>
                                      🎫 License #{lr.licenseId} (
                                      {lr.royaltyPercentage}%):
                                      <br />
                                      <span
                                        style={{
                                          fontSize: '0.75rem',
                                          opacity: 0.8,
                                          color: '#1e293b',
                                        }}
                                      >
                                        {lr.licensee.substring(0, 6)}...
                                        {lr.licensee.substring(38)}
                                      </span>
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 500,
                                        color: '#1e293b',
                                      }}
                                    >
                                      {lr.amount.toFixed(6)} tBNB
                                    </span>
                                  </div>
                                ),
                              )}
                            </>
                          )}

                          {/* IP Owner Share */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.75rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.4)',
                              borderRadius: '4px',
                              marginTop: '0.5rem',
                              fontWeight: 600,
                              borderTop: '2px solid rgba(0,0,0,0.1)',
                            }}
                          >
                            <span style={{ color: '#1e293b' }}>
                              👤 IP Owner Share:
                            </span>
                            <span style={{ color: '#1e293b' }}>
                              {royaltyBreakdown.ipOwnerShare.toFixed(6)} tBNB
                            </span>
                          </div>

                          {/* Summary */}
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              fontSize: '0.75rem',
                              opacity: 0.8,
                              fontStyle: 'italic',
                              textAlign: 'center',
                              color: '#1e293b',
                            }}
                          >
                            💡 Royalties are automatically calculated and
                            distributed on-chain
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={payRevenue}
                    disabled={
                      loading ||
                      !account?.address ||
                      !paymentAmount ||
                      parseFloat(paymentAmount) <= 0
                    }
                  >
                    {loading ? '⏳ Processing...' : '💳 Pay Revenue'}
                  </button>
                </div>
              </section>

              {/* Claim Royalties */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">🏆</span>
                  <h2 className="section-title">Claim Royalties</h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Select IP Asset</label>
                    <select
                      className="form-select"
                      value={claimTokenId}
                      onChange={(e) => setClaimTokenId(Number(e.target.value))}
                    >
                      {Array.from(ipAssets.keys()).map((id) => {
                        const asset = ipAssets.get(id)
                        const metadata = parsedMetadata.get(id) || {
                          name: 'Unknown',
                        }
                        return (
                          <option key={id} value={id}>
                            #{id} -{' '}
                            {metadata.name ||
                              asset?.ipHash.substring(0, 10) ||
                              'Unknown'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Accumulated Royalties Display */}
                  {account?.address &&
                    accumulatedRoyalties.has(claimTokenId) && (
                      <div
                        className="form-group"
                        style={{ gridColumn: '1 / -1' }}
                      >
                        <div
                          style={{
                            padding: '1rem',
                            backgroundColor:
                              accumulatedRoyalties.get(claimTokenId)! > 0n
                                ? 'var(--color-success-bg, #d4edda)'
                                : 'var(--color-info-bg, #d1ecf1)',
                            border: `1px solid ${
                              accumulatedRoyalties.get(claimTokenId)! > 0n
                                ? 'var(--color-success-border, #28a745)'
                                : 'var(--color-info-border, #0c5460)'
                            }`,
                            borderRadius: '8px',
                            marginTop: '0.5rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: '1rem',
                                fontWeight: 600,
                                color:
                                  accumulatedRoyalties.get(claimTokenId)! > 0n
                                    ? '#155724'
                                    : '#0c5460',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              💰 Accumulated Royalties
                            </h3>
                            <span
                              style={{
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                color:
                                  accumulatedRoyalties.get(claimTokenId)! > 0n
                                    ? '#155724'
                                    : '#0c5460',
                              }}
                            >
                              {formatEther(
                                accumulatedRoyalties.get(claimTokenId) || 0n,
                              )}{' '}
                              tBNB
                            </span>
                          </div>

                          {accumulatedRoyalties.get(claimTokenId)! > 0n ? (
                            <div
                              style={{
                                fontSize: '0.875rem',
                                color: '#155724',
                                opacity: 0.9,
                              }}
                            >
                              ✅ You have claimable royalties for this IP asset.
                              Click "Claim Royalties" to withdraw.
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: '0.875rem',
                                color: '#0c5460',
                                opacity: 0.9,
                              }}
                            >
                              ℹ️ No accumulated royalties available for this IP
                              asset. Royalties accumulate when revenue is paid
                              to this IP.
                            </div>
                          )}

                          {/* Show license details if user has a license */}
                          {(() => {
                            const userLicenses = Array.from(
                              licenses.entries(),
                            ).filter(
                              ([_, license]) =>
                                Number(license.tokenId) === claimTokenId &&
                                license.licensee.toLowerCase() ===
                                  account?.address.toLowerCase(),
                            )

                            if (userLicenses.length > 0) {
                              return (
                                <div
                                  style={{
                                    marginTop: '0.75rem',
                                    paddingTop: '0.75rem',
                                    borderTop: '1px solid rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <strong
                                    style={{
                                      fontSize: '0.8rem',
                                      color:
                                        accumulatedRoyalties.get(
                                          claimTokenId,
                                        )! > 0n
                                          ? '#155724'
                                          : '#0c5460',
                                    }}
                                  >
                                    Your Licenses:
                                  </strong>
                                  {userLicenses.map(([licenseId, license]) => (
                                    <div
                                      key={licenseId}
                                      style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem',
                                        backgroundColor:
                                          'rgba(255, 255, 255, 0.3)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      <div style={{ color: '#1e293b' }}>
                                        🎫 License #{licenseId}
                                      </div>
                                      <div
                                        style={{
                                          opacity: 0.8,
                                          marginTop: '0.25rem',
                                          color: '#1e293b',
                                        }}
                                      >
                                        Royalty Rate:{' '}
                                        {Number(license.royaltyPercentage) /
                                          100}
                                        % |
                                        {license.isActive
                                          ? ' ✅ Active'
                                          : ' ❌ Inactive'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                    )}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={claimRoyalties}
                    disabled={
                      loading ||
                      !account?.address ||
                      !accumulatedRoyalties.get(claimTokenId) ||
                      accumulatedRoyalties.get(claimTokenId)! === 0n
                    }
                  >
                    {loading ? '⏳ Claiming...' : '🏆 Claim Royalties'}
                  </button>
                </div>
              </section>
            </>
          )}

          {/* Arbitration Tab */}
          {activeTab === 'arbitration' && (
            <>
              {/* Register as Arbitrator */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⚖️</span>
                  <h2 className="section-title">Register as Arbitrator</h2>
                </div>

                <div className="form-grid">
                  {(() => {
                    const userArbitrator = account?.address
                      ? arbitratorsMap.get(account.address)
                      : null
                    const isUserArbitrator =
                      userArbitrator &&
                      userArbitrator.arbitrator !==
                        '0x0000000000000000000000000000000000000000'
                    const userStake = userArbitrator ? userArbitrator.stake : 0n
                    const userActiveDisputes =
                      userArbitrator?.activeDisputes || 0
                    const userIsActive = userArbitrator?.isActive || false

                    if (isUserArbitrator && userIsActive && userStake > 0n) {
                      return (
                        <>
                          <div
                            className="form-group"
                            style={{ gridColumn: '1 / -1' }}
                          >
                            <div
                              style={{
                                padding: '1rem',
                                backgroundColor:
                                  'var(--color-info-bg, #d1ecf1)',
                                border:
                                  '1px solid var(--color-info-border, #0c5460)',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                color: 'var(--color-info-text, #0c5460)',
                              }}
                            >
                              <strong>ℹ️ Your Arbitrator Status:</strong>
                              <div style={{ marginTop: '0.5rem' }}>
                                <div>
                                  💰 Stake: {formatEther(userStake)} tBNB
                                </div>
                                <div>
                                  ⚖️ Active Disputes: {userActiveDisputes}
                                </div>
                                <div>✅ Status: Active</div>
                                {userActiveDisputes > 0 && (
                                  <div
                                    style={{
                                      marginTop: '0.5rem',
                                      color: 'var(--color-warning, #ffc107)',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    ⚠️ You cannot unstake while assigned to
                                    active disputes.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            className="btn btn-danger btn-full"
                            onClick={unstakeArbitrator}
                            disabled={
                              loading ||
                              !account?.address ||
                              userActiveDisputes > 0
                            }
                          >
                            {loading
                              ? '⏳ Unstaking...'
                              : `💸 Unstake (${formatEther(userStake)} tBNB)`}
                          </button>
                        </>
                      )
                    } else {
                      return (
                        <>
                          <div className="form-group">
                            <label className="form-label">
                              💰 Minimum Stake (tBNB)
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              value={minArbitratorStake}
                              onChange={(e) =>
                                setMinArbitratorStake(e.target.value)
                              }
                              min="0.000000001"
                              step="0.000000001"
                              placeholder="0.000000001"
                              readOnly
                            />
                            <small className="form-hint">
                              Minimum stake required to become an arbitrator
                            </small>
                          </div>

                          <button
                            className="btn btn-primary btn-full"
                            onClick={registerArbitrator}
                            disabled={loading || !account?.address}
                          >
                            {loading
                              ? '⏳ Registering...'
                              : '⚖️ Register as Arbitrator'}
                          </button>
                        </>
                      )
                    }
                  })()}
                </div>
              </section>

              {/* Raise Dispute */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">🚨</span>
                  <h2 className="section-title">Raise Dispute</h2>
                </div>

                <div className="form-grid">
                  {activeArbitratorsCount === 0 && (
                    <div
                      className="form-group"
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-warning-bg, #fff3cd)',
                          border:
                            '1px solid var(--color-warning-border, #ffc107)',
                          borderRadius: '8px',
                          marginBottom: '1rem',
                        }}
                      >
                        <strong>⚠️ Warning:</strong> No active arbitrators are
                        currently registered. If you raise a dispute, it will be
                        automatically rejected after 7 days if no arbitrators
                        are assigned. Consider registering as an arbitrator
                        first to ensure disputes can be properly reviewed.
                      </div>
                    </div>
                  )}
                  {activeArbitratorsCount > 0 && activeArbitratorsCount < 3 && (
                    <div
                      className="form-group"
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-info-bg, #d1ecf1)',
                          border: '1px solid var(--color-info-border, #0c5460)',
                          borderRadius: '8px',
                          marginBottom: '1rem',
                          color: 'var(--color-info-text, #0c5460)',
                        }}
                      >
                        <strong>ℹ️ Info:</strong> Only {activeArbitratorsCount}{' '}
                        active arbitrator
                        {activeArbitratorsCount !== 1 ? 's' : ''} available
                        (recommended: 3). Disputes can still be processed with
                        fewer arbitrators.
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">🎯 Select IP Asset</label>
                    <select
                      className="form-select"
                      value={disputeTokenId}
                      onChange={(e) =>
                        setDisputeTokenId(Number(e.target.value))
                      }
                    >
                      {Array.from(ipAssets.keys()).map((id) => {
                        const asset = ipAssets.get(id)
                        const metadata = parsedMetadata.get(id) || {
                          name: 'Unknown',
                        }
                        return (
                          <option key={id} value={id}>
                            #{id} -{' '}
                            {metadata.name ||
                              asset?.ipHash.substring(0, 10) ||
                              'Unknown'}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">📝 Dispute Reason</label>
                    <textarea
                      className="form-input"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      rows={4}
                      placeholder="Explain why you are disputing this IP asset..."
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={raiseDispute}
                    disabled={
                      loading || !account?.address || !disputeReason.trim()
                    }
                  >
                    {loading ? '⏳ Submitting...' : '🚨 Raise Dispute'}
                  </button>
                </div>
              </section>

              {/* Assign Arbitrators */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">👥</span>
                  <h2 className="section-title">
                    Assign Arbitrators to Dispute
                  </h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={assignDisputeId || ''}
                      onChange={(e) => {
                        setAssignDisputeId(Number(e.target.value) || 0)
                        setSelectedArbitrators([]) // Reset selection when dispute changes
                      }}
                    />
                    <small className="form-hint">
                      Select 1-3 active arbitrators to assign to this dispute.
                      You can select from the list of registered arbitrators
                      below.
                    </small>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">
                      ⚖️ Select Arbitrators ({selectedArbitrators.length}/3
                      selected)
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '0.75rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      {allArbitrators
                        .filter((addr) => {
                          const arb = arbitratorsMap.get(addr)
                          return arb && arb.isActive
                        })
                        .map((addr) => {
                          const arb = arbitratorsMap.get(addr)
                          if (!arb) return null
                          const isSelected = selectedArbitrators.includes(addr)

                          return (
                            <div
                              key={addr}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedArbitrators(
                                    selectedArbitrators.filter(
                                      (a) => a !== addr,
                                    ),
                                  )
                                } else {
                                  if (selectedArbitrators.length < 3) {
                                    // Warn if arbitrator has high workload
                                    if ((arb.activeDisputes || 0) >= 5) {
                                      notifyWarning(
                                        'High Workload',
                                        `This arbitrator already has ${arb.activeDisputes} active disputes. Consider selecting someone with less workload.`,
                                      )
                                    }
                                    setSelectedArbitrators([
                                      ...selectedArbitrators,
                                      addr,
                                    ])
                                  } else {
                                    notifyWarning(
                                      'Maximum Reached',
                                      'You can only select up to 3 arbitrators',
                                    )
                                  }
                                }
                              }}
                              style={{
                                padding: '1rem',
                                border: `2px solid ${
                                  isSelected
                                    ? 'var(--color-primary, #007bff)'
                                    : (arb.activeDisputes || 0) >= 5
                                      ? 'var(--color-danger, #dc3545)'
                                      : (arb.activeDisputes || 0) >= 3
                                        ? 'var(--color-warning, #ffc107)'
                                        : 'var(--color-border, #ddd)'
                                }`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                backgroundColor: isSelected
                                  ? 'var(--color-primary-bg, rgba(0, 123, 255, 0.1))'
                                  : (arb.activeDisputes || 0) >= 5
                                    ? 'rgba(220, 53, 69, 0.1)'
                                    : (arb.activeDisputes || 0) >= 3
                                      ? 'rgba(255, 193, 7, 0.1)'
                                      : 'transparent',
                                transition: 'all 0.2s',
                                opacity:
                                  (arb.activeDisputes || 0) >= 10 ? 0.6 : 1,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer' }}
                                />
                                <strong style={{ fontSize: '0.9rem' }}>
                                  {addr.substring(0, 10)}...
                                  {addr.substring(addr.length - 8)}
                                </strong>
                              </div>
                              <div
                                style={{
                                  fontSize: '0.85rem',
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                <div>
                                  ⭐ Reputation: {Number(arb.reputation)}
                                </div>
                                <div>
                                  📊 Total Cases: {Number(arb.totalCases)}
                                </div>
                                <div
                                  style={{
                                    color:
                                      (arb.activeDisputes || 0) >= 5
                                        ? 'var(--color-danger, #dc3545)'
                                        : (arb.activeDisputes || 0) >= 3
                                          ? 'var(--color-warning, #ffc107)'
                                          : 'var(--color-text-secondary)',
                                    fontWeight:
                                      (arb.activeDisputes || 0) >= 3
                                        ? 'bold'
                                        : 'normal',
                                  }}
                                >
                                  ⚖️ Active Disputes: {arb.activeDisputes || 0}
                                  {(arb.activeDisputes || 0) >= 5 &&
                                    ' ⚠️ (High Workload)'}
                                  {(arb.activeDisputes || 0) >= 3 &&
                                    (arb.activeDisputes || 0) < 5 &&
                                    ' ⚡ (Moderate)'}
                                </div>
                                <div>
                                  💰 Stake: {formatEther(arb.stake)} tBNB
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    {allArbitrators.filter((addr) => {
                      const arb = arbitratorsMap.get(addr)
                      return arb && arb.isActive
                    }).length === 0 && (
                      <div
                        style={{
                          padding: '1rem',
                          textAlign: 'center',
                          color: 'var(--color-text-tertiary)',
                          marginTop: '0.5rem',
                        }}
                      >
                        No active arbitrators available. Register as an
                        arbitrator first.
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => {
                      if (
                        assignDisputeId > 0 &&
                        selectedArbitrators.length > 0
                      ) {
                        assignArbitrators(assignDisputeId, selectedArbitrators)
                      } else {
                        notifyError(
                          'Invalid Input',
                          'Please select a dispute ID and at least one arbitrator',
                        )
                      }
                    }}
                    disabled={
                      loading ||
                      !account?.address ||
                      assignDisputeId <= 0 ||
                      selectedArbitrators.length === 0
                    }
                  >
                    {loading
                      ? '⏳ Assigning...'
                      : `👥 Assign ${selectedArbitrators.length} Arbitrator${selectedArbitrators.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </section>

              {/* Submit Arbitration Decision */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⚖️</span>
                  <h2 className="section-title">Submit Arbitration Decision</h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={arbitrationDisputeId || ''}
                      onChange={(e) =>
                        setArbitrationDisputeId(Number(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">📊 Decision</label>
                    <select
                      className="form-select"
                      value={arbitrationDecision ? 'true' : 'false'}
                      onChange={(e) =>
                        setArbitrationDecision(e.target.value === 'true')
                      }
                    >
                      <option value="true">✅ Uphold Dispute</option>
                      <option value="false">❌ Reject Dispute</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      📝 Resolution Statement
                    </label>
                    <textarea
                      className="form-input"
                      value={arbitrationResolution}
                      onChange={(e) => setArbitrationResolution(e.target.value)}
                      rows={4}
                      placeholder="Explain your decision..."
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => {
                      if (arbitrationDisputeId > 0) {
                        submitArbitrationDecision(arbitrationDisputeId)
                      } else {
                        notifyError(
                          'Invalid Input',
                          'Please enter a dispute ID',
                        )
                      }
                    }}
                    disabled={
                      loading ||
                      !account?.address ||
                      !arbitrationResolution.trim() ||
                      arbitrationDisputeId <= 0
                    }
                  >
                    {loading ? '⏳ Submitting...' : '⚖️ Submit Decision'}
                  </button>
                </div>
              </section>

              {/* Check and Resolve After 24h */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⏱️</span>
                  <h2 className="section-title">
                    Resolve After 24h Wait Period
                  </h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={resolveDisputeId || ''}
                      onChange={(e) =>
                        setResolveDisputeId(Number(e.target.value) || 0)
                      }
                    />
                    <small className="form-hint">
                      Disputes automatically resolve when 3+ uphold votes exist
                      and 24 hours have passed since the 3rd uphold vote. This
                      button manually triggers resolution if needed (e.g., if
                      auto-resolution didn't trigger yet).
                    </small>
                  </div>

                  {!isOwner && (
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor:
                          'var(--color-warning-bg, rgba(255, 193, 7, 0.1))',
                        borderRadius: '8px',
                        color: 'var(--color-warning, #ffc107)',
                        marginBottom: '1rem',
                      }}
                    >
                      ⚠️ Only the contract owner can manually trigger
                      resolution.
                    </div>
                  )}
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => checkAndResolveArbitration(resolveDisputeId)}
                    disabled={
                      loading ||
                      !account?.address ||
                      resolveDisputeId <= 0 ||
                      !isOwner
                    }
                  >
                    {loading
                      ? '⏳ Checking...'
                      : '✅ Check & Resolve After 24h'}
                  </button>
                </div>
              </section>

              {/* Resolve Dispute Without Arbitrators */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">⏰</span>
                  <h2 className="section-title">
                    Resolve Dispute (No Arbitrators)
                  </h2>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">🎯 Dispute ID</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter dispute ID"
                      min="1"
                      value={resolveDisputeId || ''}
                      onChange={(e) =>
                        setResolveDisputeId(Number(e.target.value) || 0)
                      }
                    />
                    <small className="form-hint">
                      Only the dispute author can resolve disputes with no
                      arbitrators after the deadline has passed. The dispute
                      will be automatically rejected.
                    </small>
                  </div>

                  <button
                    className="btn btn-secondary btn-full"
                    onClick={() =>
                      resolveDisputeWithoutArbitrators(resolveDisputeId)
                    }
                    disabled={
                      loading || !account?.address || resolveDisputeId <= 0
                    }
                  >
                    {loading ? '⏳ Resolving...' : '⏰ Auto-Resolve Dispute'}
                  </button>
                </div>
              </section>

              {/* Disputes List */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">📋</span>
                  <h2 className="section-title">
                    All Disputes ({disputesMap.size} Total)
                  </h2>
                </div>

                <div className="grid grid-2">
                  {disputesMap.size > 0 ? (
                    Array.from(disputesMap.entries()).map(([id, dispute]) => {
                      const metadata = parsedMetadata.get(dispute.tokenId) || {
                        name: 'Unknown',
                      }
                      const disputeDate = new Date(
                        Number(dispute.timestamp) * 1000,
                      ).toLocaleDateString()

                      return (
                        <div key={id} className="card">
                          <div className="card-header">
                            <h3 className="card-title">
                              Dispute #{dispute.disputeId}
                            </h3>
                            <span
                              className={`badge ${dispute.isResolved ? 'badge-success' : 'badge-warning'}`}
                            >
                              {dispute.isResolved
                                ? '✅ Resolved'
                                : '⏳ Pending'}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="card-field">
                              <span className="card-field-label">
                                Dispute ID
                              </span>
                              <span className="card-field-value">
                                #{dispute.disputeId}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">IP Asset</span>
                              <span className="card-field-value">
                                #{dispute.tokenId} -{' '}
                                {metadata.name || 'Unknown'}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Disputer</span>
                              <span className="card-field-value address">
                                {dispute.disputer.substring(0, 10)}...
                                {dispute.disputer.substring(
                                  dispute.disputer.length - 8,
                                )}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Reason</span>
                              <span
                                className="card-field-value"
                                style={{ wordBreak: 'break-word' }}
                              >
                                {dispute.reason.length > 100
                                  ? `${dispute.reason.substring(0, 100)}...`
                                  : dispute.reason}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Date</span>
                              <span className="card-field-value">
                                {disputeDate}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Arbitration ID
                              </span>
                              <span className="card-field-value">
                                #{dispute.arbitrationId}
                              </span>
                            </div>
                            {dispute.isResolved &&
                              arbitrationsMap.has(dispute.arbitrationId) &&
                              (() => {
                                const arbitration = arbitrationsMap.get(
                                  dispute.arbitrationId,
                                )
                                const isUpheld =
                                  arbitration.votesFor >
                                  arbitration.votesAgainst
                                return (
                                  <div
                                    style={{
                                      marginTop: '1rem',
                                      padding: '1rem',
                                      backgroundColor:
                                        'var(--color-bg-secondary, #f5f5f5)',
                                      borderRadius: '8px',
                                    }}
                                  >
                                    <div
                                      className="card-field"
                                      style={{ marginBottom: '0.5rem' }}
                                    >
                                      <span className="card-field-label">
                                        Resolution Outcome
                                      </span>
                                      <span
                                        className={`card-field-value ${isUpheld ? 'text-success' : 'text-danger'}`}
                                        style={{ fontWeight: 'bold' }}
                                      >
                                        {isUpheld
                                          ? '✅ Dispute Upheld'
                                          : '❌ Dispute Rejected'}
                                      </span>
                                    </div>
                                    <div className="card-field">
                                      <span className="card-field-label">
                                        Votes
                                      </span>
                                      <span className="card-field-value">
                                        {arbitration.votesFor} For /{' '}
                                        {arbitration.votesAgainst} Against
                                      </span>
                                    </div>
                                    {arbitration.resolution &&
                                      arbitration.resolution.trim() && (
                                        <div
                                          className="card-field"
                                          style={{ marginTop: '0.5rem' }}
                                        >
                                          <span className="card-field-label">
                                            Resolution Statement
                                          </span>
                                          <span
                                            className="card-field-value"
                                            style={{
                                              wordBreak: 'break-word',
                                              fontSize: '0.9rem',
                                              color:
                                                'var(--color-text-secondary)',
                                            }}
                                          >
                                            {arbitration.resolution}
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                )
                              })()}
                            {!dispute.isResolved && (
                              <div
                                style={{
                                  marginTop: '1rem',
                                  display: 'flex',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setArbitrationDisputeId(dispute.disputeId)
                                    setResolveDisputeId(dispute.disputeId)
                                  }}
                                >
                                  Use This ID
                                </button>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setAssignDisputeId(dispute.disputeId)
                                    setSelectedArbitrators([])
                                    // Scroll to assign arbitrators section
                                    setTimeout(() => {
                                      const sections =
                                        document.querySelectorAll('.section')
                                      sections.forEach((section) => {
                                        const title =
                                          section.querySelector(
                                            '.section-title',
                                          )
                                        if (
                                          title &&
                                          title.textContent?.includes(
                                            'Assign Arbitrators',
                                          )
                                        ) {
                                          section.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start',
                                          })
                                        }
                                      })
                                    }, 100)
                                  }}
                                >
                                  👥 Assign Arbitrators
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div
                      className="card"
                      style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '3rem',
                      }}
                    >
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        📋
                      </div>
                      <h3
                        style={{
                          marginBottom: '0.5rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        No Disputes Yet
                      </h3>
                      <p style={{ color: 'var(--color-text-tertiary)' }}>
                        No disputes have been raised yet.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Arbitrators List */}
              <section className="section">
                <div className="section-header">
                  <span className="section-icon">👥</span>
                  <h2 className="section-title">
                    Registered Arbitrators ({activeArbitratorsCount} Active)
                  </h2>
                </div>

                <div className="grid grid-2">
                  {allArbitrators.length > 0 ? (
                    allArbitrators.map((addr) => {
                      const arb = arbitratorsMap.get(addr)
                      if (!arb) return null
                      return (
                        <div key={addr} className="card">
                          <div className="card-header">
                            <h3 className="card-title">Arbitrator</h3>
                            <span
                              className={`badge ${arb.isActive ? 'badge-success' : 'badge-error'}`}
                            >
                              {arb.isActive ? '✅ Active' : '❌ Inactive'}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="card-field">
                              <span className="card-field-label">Address</span>
                              <span className="card-field-value address">
                                {addr.substring(0, 10)}...
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">Stake</span>
                              <span className="card-field-value">
                                💰 {formatEther(arb.stake)} tBNB
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Reputation
                              </span>
                              <span className="card-field-value">
                                ⭐ {Number(arb.reputation)}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Total Cases
                              </span>
                              <span className="card-field-value">
                                📊 {Number(arb.totalCases)}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Active Disputes
                              </span>
                              <span
                                className="card-field-value"
                                style={{
                                  color:
                                    (arb.activeDisputes || 0) >= 5
                                      ? 'var(--color-danger, #dc3545)'
                                      : (arb.activeDisputes || 0) >= 3
                                        ? 'var(--color-warning, #ffc107)'
                                        : 'inherit',
                                  fontWeight:
                                    (arb.activeDisputes || 0) >= 3
                                      ? 'bold'
                                      : 'normal',
                                }}
                              >
                                ⚖️ {arb.activeDisputes || 0}
                                {(arb.activeDisputes || 0) >= 5 && ' ⚠️'}
                                {(arb.activeDisputes || 0) >= 3 &&
                                  (arb.activeDisputes || 0) < 5 &&
                                  ' ⚡'}
                              </span>
                            </div>
                            <div className="card-field">
                              <span className="card-field-label">
                                Success Rate
                              </span>
                              <span className="card-field-value">
                                {arb.totalCases > 0
                                  ? `${Math.round((Number(arb.successfulCases) / Number(arb.totalCases)) * 100)}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div
                      className="card"
                      style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '3rem',
                      }}
                    >
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        👥
                      </div>
                      <h3
                        style={{
                          marginBottom: '0.5rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        No Arbitrators Yet
                      </h3>
                      <p style={{ color: 'var(--color-text-tertiary)' }}>
                        Be the first to register as an arbitrator!
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* IP Assets Display */}
        <section className="section section-full">
          <div className="section-header">
            <span className="section-icon">🎨</span>
            <h2 className="section-title">Registered IP Assets</h2>
          </div>

          <div className="grid grid-3">
            {Array.from(ipAssets.entries()).map(([id, asset]) => {
              const metadata = parsedMetadata.get(id) || {
                name: 'Unknown',
                description: 'No description available',
              }
              const mediaUrl = getIPFSGatewayURL(asset.ipHash)

              return (
                <div key={id} className="card hover-lift animate-fade-in">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">
                        {metadata.name || `IP Asset #${id}`}
                      </h3>
                      <p className="card-subtitle">Token #{id}</p>
                    </div>
                    <div className="flex gap-2">
                      {asset.isEncrypted && (
                        <span className="badge badge-warning">
                          🔒 Encrypted
                        </span>
                      )}
                      {asset.isDisputed && (
                        <span className="badge badge-error">⚠️ Disputed</span>
                      )}
                      {infringementLoadingIds.has(id) && (
                        <span
                          className="badge"
                          style={{ opacity: 0.9 }}
                          title="Checking infringement..."
                        >
                          ⏳ Checking
                        </span>
                      )}
                      {!infringementLoadingIds.has(id) &&
                        infringementData.has(id) &&
                        (() => {
                          const infringement = infringementData.get(id)!
                          if (infringement.totalInfringements > 0) {
                            const severity = calculateSeverity(infringement)
                            const severityConfig = {
                              medium: {
                                icon: '⚡',
                                className: 'badge-warning',
                              },
                              high: { icon: '⚠️', className: 'badge-error' },
                              critical: {
                                icon: '🚨',
                                className: 'badge-error',
                              },
                              low: { icon: '✅', className: 'badge-success' },
                            }
                            const config =
                              severityConfig[severity] || severityConfig.low
                            return (
                              <span
                                className={`badge ${config.className}`}
                                style={{ cursor: 'default' }}
                                title={`${infringement.totalInfringements} infringement(s) detected`}
                              >
                                {config.icon} {infringement.totalInfringements}{' '}
                                Infringement
                                {infringement.totalInfringements !== 1
                                  ? 's'
                                  : ''}
                              </span>
                            )
                          }
                          return null
                        })()}
                    </div>
                  </div>

                  {/* Enhanced Media Preview - Always Show */}
                  <div className="media-preview">
                    <div className="media-container">
                      <EnhancedAssetPreview
                        assetId={id}
                        asset={asset}
                        metadata={metadata}
                        mediaUrl={
                          mediaUrl || getIPFSGatewayURL(asset.ipHash || '')
                        }
                      />
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-field">
                      <span className="card-field-label">Owner</span>
                      <span className="card-field-value address">
                        {asset.owner.substring(0, 10)}...
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">Description</span>
                      <span className="card-field-value">
                        {metadata.description || 'No description'}
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">IP Hash</span>
                      <span className="card-field-value address">
                        {asset.ipHash.substring(0, 20)}...
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">Total Revenue</span>
                      <span
                        className="card-field-value"
                        style={{
                          fontSize: '0.85rem',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%',
                          display: 'inline-block',
                        }}
                      >
                        💰{' '}
                        {parseFloat(formatEther(asset.totalRevenue)).toFixed(6)}{' '}
                        tBNB
                      </span>
                    </div>

                    <div className="card-field">
                      <span className="card-field-label">Royalty Tokens</span>
                      <span className="card-field-value">
                        🎯 {Number(asset.royaltyTokens) / 100}%
                      </span>
                    </div>

                    {/* Infringement Status */}
                    <div className="card-field">
                      <span className="card-field-label">
                        Infringement Status
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {infringementLoadingIds.has(id) ? (
                          <span
                            className="card-field-value"
                            style={{ fontSize: '0.85rem', opacity: 0.8 }}
                          >
                            ⏳ Checking...
                          </span>
                        ) : infringementData.has(id) ? (
                          (() => {
                            const infringement = infringementData.get(id)!
                            const severity = calculateSeverity(infringement)
                            const hasInfringements =
                              infringement.totalInfringements > 0

                            const severityConfig = {
                              low: {
                                icon: '✅',
                                color: '#28a745',
                                bg: '#d4edda',
                              },
                              medium: {
                                icon: '⚡',
                                color: '#ffc107',
                                bg: '#fff3cd',
                              },
                              high: {
                                icon: '⚠️',
                                color: '#fd7e14',
                                bg: '#ffeaa7',
                              },
                              critical: {
                                icon: '🚨',
                                color: '#dc3545',
                                bg: '#f8d7da',
                              },
                            }

                            const config = severityConfig[severity]

                            return (
                              <>
                                <span
                                  className="card-field-value"
                                  style={{
                                    fontSize: '0.85rem',
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: config.bg,
                                    color: config.color,
                                    borderRadius: '4px',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  {config.icon}{' '}
                                  {hasInfringements
                                    ? `${infringement.totalInfringements} Found`
                                    : 'Clean'}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedInfringementTokenId(id)
                                    loadInfringementStatus(id)
                                  }}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor:
                                      'var(--color-primary, #007bff)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                  }}
                                  title="Check infringement status"
                                >
                                  🔍 Check Status
                                </button>
                              </>
                            )
                          })()
                        ) : (
                          <>
                            <span
                              className="card-field-value"
                              style={{ fontSize: '0.85rem', opacity: 0.7 }}
                            >
                              ⏳ Not Checked
                            </span>
                            <button
                              onClick={() => {
                                setSelectedInfringementTokenId(id)
                                loadInfringementStatus(id)
                              }}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                backgroundColor:
                                  'var(--color-secondary, #6c757d)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              🔍 Check Now
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {ipAssets.size === 0 && (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '3rem',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No IP Assets Yet
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>
                  Register your first IP asset to get started!
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Licenses Display */}
        <section className="section section-full">
          <div className="section-header">
            <span className="section-icon">🎫</span>
            <h2 className="section-title">Active Licenses</h2>
          </div>

          <div className="grid grid-2">
            {Array.from(licenses.entries()).map(([id, license]) => (
              <div key={id} className="card hover-lift animate-fade-in">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">License #{id}</h3>
                    <p className="card-subtitle">
                      IP Asset #{Number(license.tokenId)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {license.isActive ? (
                      <span className="badge badge-success">✅ Active</span>
                    ) : (
                      <span className="badge badge-error">❌ Inactive</span>
                    )}
                    {license.commercialUse && (
                      <span className="badge badge-info">💼 Commercial</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-field">
                    <span className="card-field-label">Licensee</span>
                    <span className="card-field-value address">
                      {license.licensee.substring(0, 10)}...
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Royalty Rate</span>
                    <span className="card-field-value">
                      💰 {Number(license.royaltyPercentage) / 100}%
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Duration</span>
                    <span className="card-field-value">
                      ⏰ {Number(license.duration)} seconds
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Start Date</span>
                    <span className="card-field-value">
                      📅{' '}
                      {new Date(
                        Number(license.startDate) * 1000,
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="card-field">
                    <span className="card-field-label">Terms Preview</span>
                    <span className="card-field-value">
                      {license.terms.substring(0, 30)}...
                    </span>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                  >
                    📄 View Terms
                  </button>
                  {license.isActive && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    >
                      🔄 Renew
                    </button>
                  )}
                </div>
              </div>
            ))}

            {licenses.size === 0 && (
              <div
                className="card"
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '3rem',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎫</div>
                <h3
                  style={{
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No Licenses Yet
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>
                  Mint your first license to start licensing IP assets!
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
