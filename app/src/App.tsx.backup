import { useEffect, useState } from "react";
import "./App.css";
import { useNotificationHelpers } from "./contexts/NotificationContext";
import { NotificationButton } from "./components/NotificationButton";
import { NotificationToasts } from "./components/NotificationCenter";
import { IPPortfolio } from "./components/IPPortfolio";
import "./components/IPPortfolio.css";

import {
  defineChain,
  getContract,
  prepareContractCall,
  readContract,
  sendTransaction,
  ThirdwebClient,
  waitForReceipt,
} from "thirdweb";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { parseEther, formatEther } from "viem";
import { etherlinkTestnet } from "viem/chains";
import CONTRACT_ADDRESS_JSON from "./deployed_addresses.json";

// Backend API configuration
const BACKEND_URL = "https://usemodred-production-e07d.up.railway.app";

// File validation and preview utilities
const MAX_FILE_SIZE_MB = 50; // Maximum file size in megabytes
const ALLOWED_FILE_TYPES = [
  'application/pdf',     // PDF
  'application/msword',  // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain',          // TXT
  'image/jpeg',          // JPG/JPEG
  'image/png',           // PNG
  'image/gif',           // GIF
  'audio/mpeg',          // MP3
  'audio/wav',           // WAV
  'video/mp4'            // MP4
];

// File validation function
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    return {
      valid: false, 
      error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`
    };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false, 
      error: 'Unsupported file type'
    };
  }

  return { valid: true };
};

// File preview generator
const generateFilePreview = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    } 
    // Preview for PDFs (basic)
    else if (file.type === 'application/pdf') {
      resolve('📄 PDF Document');
    }
    // Preview for text files
    else if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsText(file);
    }
    // Preview for other file types
    else {
      resolve(null);
    }
  });
};

// Remove hardcoded Pinata credentials
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5MjJjNmZkOC04ZTZhLTQxMzUtODA4ZS05ZTkwZTMyMjViNTIiLCJlbWFpbCI6Imp3YXZvbGFiaWxvdmUwMDE2QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJkZDI1MzM4YmRmYTdjNzlmYjY4NyIsInNjb3BlZEtleVNlY3JldCI6ImFiYTJjMzcwNWExMzNlZmVjNzM3NzQwZGNjMGJjOTE4MGY2M2IzZjkxY2E5MzVlYWE3NzUxMDhjOGNkYjMyZDciLCJleHAiOjE3ODU3NDg3ODh9.I6RIrBphVycV-75XK_pippeZngj6QntUZZjFMnGtqFA";

/**
 * Uploads a file to IPFS via Pinata
 * @param file The file to upload
 * @returns Object with success status, CID and message
 */
const pinFileToIPFS = async (file: File): Promise<{
  success: boolean;
  cid?: string;
  message?: string;
}> => {
  try {
    // Validate JWT is present
    if (!PINATA_JWT) {
      throw new Error('Pinata JWT is not configured. Please set VITE_PINATA_JWT in your environment.');
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Add metadata
    const metadata = {
      name: file.name,
      description: `Uploaded via ModredIP frontend`,
      attributes: {
        uploadedBy: 'ModredIP',
        timestamp: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size
      }
    };
    formData.append('pinataMetadata', JSON.stringify(metadata));

    // Make request to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Pinata upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Pinata upload successful:', result);

    return {
      success: true,
      cid: result.IpfsHash,
      message: 'File uploaded successfully to IPFS'
    };
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Converts an IPFS URL to a gateway URL for better compatibility
 * @param url IPFS URL (ipfs://, /ipfs/, or already a gateway URL)
 * @returns Gateway URL
 */
const getIPFSGatewayURL = (url: string): string => {
  if (!url) return '';

  // Use preferred gateway
  const gateway = 'https://gateway.pinata.cloud';

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    return `${gateway}/ipfs/${cid}`;
  }

  // Handle /ipfs/ path
  if (url.includes('/ipfs/')) {
    const parts = url.split('/ipfs/');
    if (parts.length > 1) {
      return `${gateway}/ipfs/${parts[1]}`;
    }
  }

  // If it's already a gateway URL or something else, return as is
  return url;
};

// Parse metadata to extract name and description
const parseMetadata = async (metadataUri: string) => {
  try {
    // If metadata is a direct JSON string, parse it
    if (metadataUri.startsWith('{')) {
      return JSON.parse(metadataUri);
    }
    
    // If it's an IPFS URI, fetch it
    if (metadataUri.startsWith('ipfs://')) {
      const gatewayUrl = getIPFSGatewayURL(metadataUri);
      const response = await fetch(gatewayUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }
      
      const metadata = await response.json();
      return metadata;
    }
    
    // If it's already a gateway URL, fetch it
    if (metadataUri.includes('gateway.pinata.cloud')) {
      const response = await fetch(metadataUri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }
      
      const metadata = await response.json();
      return metadata;
    }
    
    // Default fallback
    return {
      name: "Unknown",
      description: "No description available"
    };
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return {
      name: "Unknown",
      description: "No description available"
    };
  }
};

const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "email", "passkey", "phone"],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("io.rabby"),
  createWallet("com.trustwallet.app"),
  createWallet("global.safe"),
];

// ModredIP Contract ABI (simplified for the functions we need)
const MODRED_IP_ABI = [
  {
    inputs: [
      { name: "tokenId", type: "uint256" }
    ],
    name: "getIPAsset",
    outputs: [
      { name: "owner", type: "address" },
      { name: "ipHash", type: "string" },
      { name: "metadata", type: "string" },
      { name: "isEncrypted", type: "bool" },
      { name: "isDisputed", type: "bool" },
      { name: "registrationDate", type: "uint256" },
      { name: "totalRevenue", type: "uint256" },
      { name: "royaltyTokens", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "licenseId", type: "uint256" }
    ],
    name: "getLicense",
    outputs: [
      { name: "licensee", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "royaltyPercentage", type: "uint256" },
      { name: "duration", type: "uint256" },
      { name: "startDate", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "commercialUse", type: "bool" },
      { name: "terms", type: "string" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextTokenId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextLicenseId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "ipHash", type: "string" },
      { name: "metadata", type: "string" },
      { name: "isEncrypted", type: "bool" }
    ],
    name: "registerIP",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "royaltyPercentage", type: "uint256" },
      { name: "duration", type: "uint256" },
      { name: "commercialUse", type: "bool" },
      { name: "terms", type: "string" }
    ],
    name: "mintLicense",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" }
    ],
    name: "payRevenue",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "tokenId", type: "uint256" }
    ],
    name: "claimRoyalties",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

interface IPAsset {
  owner: string;
  ipHash: string;
  metadata: string;
  isEncrypted: boolean;
  isDisputed: boolean;
  registrationDate: bigint;
  totalRevenue: bigint;
  royaltyTokens: bigint;
}

interface License {
  licensee: string;
  tokenId: bigint;
  royaltyPercentage: bigint;
  duration: bigint;
  startDate: bigint;
  isActive: boolean;
  commercialUse: boolean;
  terms: string;
}

interface AppProps {
  thirdwebClient: ThirdwebClient;
}

// Enhanced Asset Preview Component
const EnhancedAssetPreview: React.FC<{
  assetId: number;
  asset: IPAsset;
  metadata: any;
  mediaUrl: string;
}> = ({ assetId, asset, metadata, mediaUrl }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImageFromMetadata = async () => {
      try {
        setLoading(true);
        
        // Priority 1: Check if metadata has image field
        if (metadata?.image) {
          let imageSource = metadata.image;
          
          // Convert IPFS URLs to gateway URLs
          if (imageSource.startsWith('ipfs://')) {
            imageSource = `https://gateway.pinata.cloud/ipfs/${imageSource.replace('ipfs://', '')}`;
          }
          
          setImageUrl(imageSource);
        } 
        // Priority 2: Try the asset's ipHash directly
        else if (asset.ipHash) {
          let gatewayUrl = asset.ipHash;
          if (gatewayUrl.startsWith('ipfs://')) {
            gatewayUrl = `https://gateway.pinata.cloud/ipfs/${gatewayUrl.replace('ipfs://', '')}`;
          }
          setImageUrl(gatewayUrl);
        }
        // Priority 3: Use mediaUrl as fallback
        else {
          setImageUrl(mediaUrl);
        }
      } catch (error) {
        console.error('Error fetching image from metadata:', error);
        setImageUrl(mediaUrl);
      } finally {
        setLoading(false);
      }
    };

    fetchImageFromMetadata();
  }, [metadata, asset.ipHash, mediaUrl]);

  if (loading) {
    return (
      <div className="preview-skeleton">
        <div className="skeleton skeleton-image"></div>
      </div>
    );
  }

  return (
    <>
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={metadata?.name || `IP Asset ${assetId}`}
          className="media-image"
          onError={(e) => {
            const imgElement = e.target as HTMLImageElement;
            imgElement.style.display = 'none';
            const fallback = imgElement.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      ) : null}
      <div className="media-fallback" style={{ display: imageUrl ? 'none' : 'flex' }}>
        <div className="media-fallback-icon">📄</div>
        <p>Media Preview</p>
        <a href={imageUrl || mediaUrl} target="_blank" rel="noopener noreferrer" className="media-link">
          🔗 View Media
        </a>
      </div>
    </>
  );
};

export default function App({ thirdwebClient }: AppProps) {
  const account = useActiveAccount();
  const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useNotificationHelpers();

  const [loading, setLoading] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<boolean>(false);
  
  // IP Assets state
  const [ipAssets, setIpAssets] = useState<Map<number, IPAsset>>(new Map());
  
  // Licenses state
  const [licenses, setLicenses] = useState<Map<number, License>>(new Map());
  
  // Parsed metadata state
  const [parsedMetadata, setParsedMetadata] = useState<Map<number, any>>(new Map());
  
  // Form states
  const [ipFile, setIpFile] = useState<File | null>(null);
  const [ipHash, setIpHash] = useState<string>("");
  const [ipName, setIpName] = useState<string>("");
  const [ipDescription, setIpDescription] = useState<string>("");
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  
  const [selectedTokenId, setSelectedTokenId] = useState<number>(1);
  const [royaltyPercentage, setRoyaltyPercentage] = useState<number>(10);
  const [licenseDuration, setLicenseDuration] = useState<number>(86400);
  // License parameters
  const [commercialUse, setCommercialUse] = useState<boolean>(true);
  const [commercialAttribution, setCommercialAttribution] = useState<boolean>(true);
  const [commercializerChecker, setCommercializerChecker] = useState<string>("0x0000000000000000000000000000000000000000");
  const [commercializerCheckerData, setCommercializerCheckerData] = useState<string>("0000000000000000000000000000000000000000");
  const [commercialRevShare, setCommercialRevShare] = useState<number>(100000000);
  const [commercialRevCeiling, setCommercialRevCeiling] = useState<number>(0);
  const [derivativesAllowed, setDerivativesAllowed] = useState<boolean>(true);
  const [derivativesAttribution, setDerivativesAttribution] = useState<boolean>(true);
  const [derivativesApproval, setDerivativesApproval] = useState<boolean>(false);
  const [derivativesReciprocal, setDerivativesReciprocal] = useState<boolean>(true);
  const [derivativeRevCeiling, setDerivativeRevCeiling] = useState<number>(0);
  const [licenseCurrency, setLicenseCurrency] = useState<string>("0x15140000000000000000000000000000000000000");
  
  const [paymentAmount, setPaymentAmount] = useState<string>("0.001");
  const [paymentTokenId, setPaymentTokenId] = useState<number>(1);
  
  const [claimTokenId, setClaimTokenId] = useState<number>(1);

  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'register' | 'license' | 'revenue'>('dashboard');

  // Check backend status
  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/`);
      const wasConnected = backendStatus;
      const isConnected = response.ok;
      
      setBackendStatus(isConnected);
      
      if (!wasConnected && isConnected) {
        notifySuccess('Backend Connected', 'Successfully connected to the ModredIP backend service');
      } else if (wasConnected && !isConnected) {
        notifyError('Backend Disconnected', 'Lost connection to the ModredIP backend service');
      }
    } catch (error) {
      const wasConnected = backendStatus;
      setBackendStatus(false);
      
      if (wasConnected) {
        notifyError('Backend Error', 'Failed to connect to the ModredIP backend service');
      }
    }
  };

  // Check backend status on component mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  // Handle file selection for IP asset
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  // Process file (shared logic for both upload methods)
  const processFile = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      notifyError('Invalid File', validation.error || 'Invalid file selected');
      return;
    }

    try {
      const preview = await generateFilePreview(file);
      setFilePreview(preview);
      setIpFile(file);
      notifyInfo('File Selected', `${file.name} selected for upload`);
    } catch (err) {
      console.error('File preview error:', err);
      setIpFile(file);
      notifyWarning('Preview Error', 'File selected but preview could not be generated');
    }
  };

  // Upload file to IPFS
  const uploadToIPFS = async () => {
    if (!ipFile) {
      notifyError("No File Selected", "Please select a file to upload");
      return null;
    }

    try {
      setLoading(true);
      notifyInfo('Uploading to IPFS', `Uploading ${ipFile.name} to IPFS...`);
      
      const uploadResult = await pinFileToIPFS(ipFile);
      
      if (uploadResult.success && uploadResult.cid) {
        // Clear any previous file preview
        setFilePreview(null);
        
        // Set the IPFS hash
        const ipfsUrl = `ipfs://${uploadResult.cid}`;
        setIpHash(ipfsUrl);
        
        // Get gateway URL for display
        const gatewayUrl = getIPFSGatewayURL(ipfsUrl);
        
        // Show success message
        notifySuccess('IPFS Upload Successful', 
          `File uploaded successfully!\nCID: ${uploadResult.cid}`, 
          {
            action: {
              label: 'View File',
              onClick: () => window.open(gatewayUrl, '_blank')
            }
          }
        );
        
        return uploadResult.cid;
    } else {
        // Handle specific upload errors
        const errorMessage = uploadResult.message || "Failed to upload file";
        notifyError('Upload Failed', errorMessage);
        
        // Reset file selection if upload fails
        setIpFile(null);
        setFilePreview(null);
        
        return null;
      }
    } catch (err: any) {
      console.error('Unexpected upload error:', err);
      notifyError('Upload Error', err.message || "Unexpected error during file upload");
      
      // Reset file selection
      setIpFile(null);
      setFilePreview(null);
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Load contract data
  const loadContractData = async () => {
    if (!account?.address) return;

    try {
      setLoading(true);
      const contract = getContract({
        abi: MODRED_IP_ABI,
          client: thirdwebClient,
          chain: defineChain(etherlinkTestnet.id),
        address: CONTRACT_ADDRESS_JSON["ModredIPModule#ModredIP"],
      });

      // Get next token ID
      const nextId = await readContract({
        contract,
        method: "nextTokenId",
        params: [],
      });
      const nextTokenIdNum = Number(nextId);

      // Get next license ID
      const nextLicenseId = await readContract({
        contract,
        method: "nextLicenseId",
        params: [],
      });
      const nextLicenseIdNum = Number(nextLicenseId);

      // Load IP assets
      const newIpAssets = new Map<number, IPAsset>();
      for (let i = 1; i < nextTokenIdNum; i++) {
        try {
          const ipAsset = await readContract({
            contract,
            method: "getIPAsset",
            params: [BigInt(i)],
          });
          newIpAssets.set(i, {
            owner: ipAsset[0],
            ipHash: ipAsset[1],
            metadata: ipAsset[2],
            isEncrypted: ipAsset[3],
            isDisputed: ipAsset[4],
            registrationDate: ipAsset[5],
            totalRevenue: ipAsset[6],
            royaltyTokens: ipAsset[7],
          });
        } catch (error) {
          // Token doesn't exist, skip
        }
      }
      setIpAssets(newIpAssets);

      // Parse metadata for all IP assets
      const newParsedMetadata = new Map<number, any>();
      for (const [id, asset] of newIpAssets.entries()) {
        try {
          const metadata = await parseMetadata(asset.metadata);
          newParsedMetadata.set(id, metadata);
        } catch (error) {
          console.error(`Error parsing metadata for token ${id}:`, error);
          newParsedMetadata.set(id, {
            name: "Unknown",
            description: "No description available"
          });
        }
      }
      setParsedMetadata(newParsedMetadata);

      // Load licenses
      const newLicenses = new Map<number, License>();
      for (let i = 1; i < nextLicenseIdNum; i++) {
        try {
          const license = await readContract({
            contract,
            method: "getLicense",
            params: [BigInt(i)],
          });
          newLicenses.set(i, {
            licensee: license[0],
            tokenId: license[1],
            royaltyPercentage: license[2],
            duration: license[3],
            startDate: license[4],
            isActive: license[5],
            commercialUse: license[6],
            terms: license[7],
          });
        } catch (error) {
          // License doesn't exist, skip
        }
      }
      setLicenses(newLicenses);

    } catch (error) {
      console.error("Error loading contract data:", error);
      notifyError("Loading Failed", "Failed to load contract data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContractData();
  }, [account?.address]);

  // Create standardized NFT metadata
  const createNFTMetadata = async (ipHash: string, name: string, description: string, isEncrypted: boolean) => {
    // Generate metadata object
    const metadata = {
      name: name || `IP Asset #${Date.now()}`, // Use provided name or generate unique name
      description: description || "No description provided",
      image: ipHash, // Use IPFS hash as image reference
      properties: {
        ipHash,
        name: name || "Unnamed",
        description: description || "No description provided",
        isEncrypted,
        uploadDate: new Date().toISOString()
      }
    };

    // Upload metadata to IPFS
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'metadata.json');
    
    const metadataUploadResult = await pinFileToIPFS(metadataFile);
    
    if (!metadataUploadResult.success || !metadataUploadResult.cid) {
      throw new Error('Failed to upload metadata to IPFS');
    }

    // Return IPFS URL for metadata
    return `ipfs://${metadataUploadResult.cid}`;
  };

  // Register IP using backend API
  const registerIP = async () => {
    if (!account?.address || !ipHash || !ipName.trim()) {
      notifyError("Missing Required Fields", "Please fill in all required fields (IP Hash and Name are required)");
      return;
    }

    try {
      setLoading(true);


      // Create and upload metadata to IPFS
      const metadataUri = await createNFTMetadata(ipHash, ipName, ipDescription, isEncrypted);

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
        creator_email: 'creator@modredip.com', // Could be enhanced with user input
        // File-specific metadata
        file_name: ipFile?.name || 'unknown',
        file_extension: ipFile?.name?.split('.').pop() || 'unknown',
        upload_timestamp: new Date().toISOString(),
        // Blockchain metadata
        network: 'etherlink',
        chain_id: '128123',
        contract_address: CONTRACT_ADDRESS_JSON["ModredIPModule#ModredIP"],
        // Infringement detection metadata
        monitoring_enabled: true,
        infringement_alerts: true,
        content_hash: ipHash,
        original_filename: ipFile?.name || 'unknown'
      };

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
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipHash: ipHash,
          metadata: JSON.stringify(ipMetadata),
          isEncrypted: isEncrypted,
          modredIpContractAddress: CONTRACT_ADDRESS_JSON["ModredIPModule#ModredIP"]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register IP');
      }

      const result = await response.json();
      console.log('IP Registration successful:', result);

      // Show success notification
      notifySuccess('IP Asset Registered', 
        `Successfully registered IP asset!\nTransaction: ${result.etherlink.txHash}\nIP Asset ID: ${result.etherlink.ipAssetId}`,
        {
          action: {
            label: 'View Transaction',
            onClick: () => window.open(`https://testnet.explorer.etherlink.com/tx/${result.etherlink.txHash}`, '_blank')
          }
        }
      );

      // Reset form
      setIpFile(null);
      setIpHash("");
      setIpName("");
      setIpDescription("");
      setIsEncrypted(false);
      setFilePreview(null);

      // Reload data
      await loadContractData();

      } catch (error) {
      console.error("Error registering IP:", error);
      notifyError('Registration Failed', error instanceof Error ? error.message : "Failed to register IP asset");
    } finally {
      setLoading(false);
    }
  };

  // Mint License using backend API
  const mintLicense = async () => {
    if (!account?.address || !selectedTokenId) {
      notifyError("Missing Required Fields", "Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);


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
          currency: licenseCurrency
        })
      };

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
          modredIpContractAddress: CONTRACT_ADDRESS_JSON["ModredIPModule#ModredIP"]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mint license');
      }

      const result = await response.json();
      console.log('License minting successful:', result);

      // Show success notification
      notifySuccess('License Minted', 
        `Successfully minted license!\nTransaction: ${result.data.txHash}`,
        {
          action: {
            label: 'View Transaction',
            onClick: () => window.open(`https://testnet.explorer.etherlink.com/tx/${result.data.txHash}`, '_blank')
          }
        }
      );

      // Reset form
      setSelectedTokenId(1);
      setRoyaltyPercentage(10);
      setLicenseDuration(86400);
      setCommercialUse(true);
      setCommercialAttribution(true);
      setCommercializerChecker("0x0000000000000000000000000000000000000000");
      setCommercializerCheckerData("0000000000000000000000000000000000000000");
      setCommercialRevShare(100000000);
      setCommercialRevCeiling(0);
      setDerivativesAllowed(true);
      setDerivativesAttribution(true);
      setDerivativesApproval(false);
      setDerivativesReciprocal(true);
      setDerivativeRevCeiling(0);
      setLicenseCurrency("0x15140000000000000000000000000000000000000");

      // Reload data
      await loadContractData();

    } catch (error) {
      console.error("Error minting license:", error);
      notifyError('License Minting Failed', error instanceof Error ? error.message : "Failed to mint license");
    } finally {
      setLoading(false);
    }
  };

  // Pay Revenue
  const payRevenue = async () => {
    if (!account?.address || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      notifyError("Invalid Payment", "Please enter a valid payment amount");
      return;
    }

    try {
      setLoading(true);
      notifyInfo('Processing Payment', `Paying ${paymentAmount} XTZ in revenue...`);

        const contract = getContract({
        abi: MODRED_IP_ABI,
          client: thirdwebClient,
          chain: defineChain(etherlinkTestnet.id),
        address: CONTRACT_ADDRESS_JSON["ModredIPModule#ModredIP"],
        });

      const preparedCall = await prepareContractCall({
          contract,
        method: "payRevenue",
        params: [BigInt(paymentTokenId)],
        value: parseEther(paymentAmount),
        });

        const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
        });

      await waitForReceipt({
          client: thirdwebClient,
          chain: defineChain(etherlinkTestnet.id),
          transactionHash: transaction.transactionHash,
        });

      // Show success notification
      notifySuccess('Payment Successful', `Successfully paid ${paymentAmount} XTZ in revenue!`);

      // Reset form
      setPaymentAmount("");
      setPaymentTokenId(1);

      // Reload data
      await loadContractData();

      } catch (error) {
      console.error("Error paying revenue:", error);
      notifyError('Payment Failed', "Failed to pay revenue");
    } finally {
      setLoading(false);
    }
  };

  // Claim Royalties
  const claimRoyalties = async () => {
    if (!account?.address) {
      notifyError("Wallet Not Connected", "Please connect your wallet");
      return;
    }

    try {
      setLoading(true);
      notifyInfo('Claiming Royalties', 'Processing royalty claim...');

        const contract = getContract({
        abi: MODRED_IP_ABI,
          client: thirdwebClient,
          chain: defineChain(etherlinkTestnet.id),
        address: CONTRACT_ADDRESS_JSON["ModredIPModule#ModredIP"],
        });

      const preparedCall = await prepareContractCall({
          contract,
        method: "claimRoyalties",
        params: [BigInt(claimTokenId)],
        });

      const transaction = await sendTransaction({
        transaction: preparedCall,
        account: account,
      });

      await waitForReceipt({
        client: thirdwebClient,
        chain: defineChain(etherlinkTestnet.id),
        transactionHash: transaction.transactionHash,
      });

            // Show success notification
      notifySuccess('Royalties Claimed', 'Successfully claimed your royalties!');

      // Reload data
      await loadContractData();

    } catch (error) {
      console.error("Error claiming royalties:", error);
      notifyError('Claim Failed', "Failed to claim royalties");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Toast Notifications */}
      <NotificationToasts />
      
      {/* Modern Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-logo">
            <img src="/modred.webp" alt="ModredIP" className="logo-image" />
            <h1>ModredIP</h1>
          </div>
          <div className="header-actions">
            <div className={`status-indicator ${backendStatus ? 'connected' : 'disconnected'}`}>
              <span>{backendStatus ? '🟢' : '🔴'}</span>
              <span>Backend {backendStatus ? 'Connected' : 'Disconnected'}</span>
              <button onClick={checkBackendStatus} className="refresh-btn">🔄</button>
            </div>
            <NotificationButton />
            <ConnectButton
              client={thirdwebClient}
              wallets={wallets}
              chain={defineChain(etherlinkTestnet.id)}
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
                    {ipFile ? `${(ipFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
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
                        const imgElement = e.target as HTMLImageElement;
                        imgElement.style.display = 'none';
                        const fallback = imgElement.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="media-fallback" style={{ display: ipFile?.type.startsWith('image/') ? 'none' : 'flex' }}>
                    <div className="media-fallback-icon">📄</div>
                    <p>Media Preview</p>
                    <a href={getIPFSGatewayURL(ipHash)} target="_blank" rel="noopener noreferrer" className="media-link">
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
                  <label className="checkbox-label">Encrypted Content</label>
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
              disabled={loading || !account?.address || !ipHash || !ipName.trim()}
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
                  const asset = ipAssets.get(id);
                  const metadata = parsedMetadata.get(id) || { name: "Unknown" };
                  return (
                    <option key={id} value={id}>
                      #{id} - {metadata.name || asset?.ipHash.substring(0, 10) || 'Unknown'}
                    </option>
                  );
                })}
            </select>
            </div>
            <div className="form-group-row">
              <div className="form-group">
                <label className="form-label">💰 Royalty (%)</label>
            <input
              type="number"
                  className="form-input"
                  value={royaltyPercentage}
                  onChange={(e) => setRoyaltyPercentage(Number(e.target.value))}
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
                  onChange={(e) => setLicenseDuration(Number(e.target.value))}
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
                  <label className="checkbox-label">Commercial Use Allowed</label>
                </div>
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={commercialAttribution}
                    onChange={(e) => setCommercialAttribution(e.target.checked)}
                  />
                  <label className="checkbox-label">Commercial Attribution</label>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={derivativesAllowed}
                    onChange={(e) => setDerivativesAllowed(e.target.checked)}
                  />
                  <label className="checkbox-label">Derivatives Allowed</label>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={derivativesAttribution}
                    onChange={(e) => setDerivativesAttribution(e.target.checked)}
                  />
                  <label className="checkbox-label">Derivatives Attribution</label>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={derivativesApproval}
                    onChange={(e) => setDerivativesApproval(e.target.checked)}
                  />
                  <label className="checkbox-label">Derivatives Approval Required</label>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={derivativesReciprocal}
                    onChange={(e) => setDerivativesReciprocal(e.target.checked)}
                  />
                  <label className="checkbox-label">Derivatives Reciprocal</label>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <details className="form-group">
              <summary className="form-label" style={{ cursor: 'pointer', fontWeight: 600 }}>
                🔧 Advanced Settings
              </summary>
              <div className="form-grid" style={{ marginTop: '1rem' }}>
                <div className="form-group-row">
                  <div className="form-group">
                    <label className="form-label">💵 Commercial Rev Share (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={commercialRevShare / 1000000}
                      onChange={(e) => setCommercialRevShare(Number(e.target.value) * 1000000)}
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="100"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">🏛️ Commercial Rev Ceiling</label>
                    <input
                      type="number"
                      className="form-input"
                      value={commercialRevCeiling}
                      onChange={(e) => setCommercialRevCeiling(Number(e.target.value))}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">🔍 Commercializer Checker</label>
                  <input
                    type="text"
                    className="form-input"
                    value={commercializerChecker}
                    onChange={(e) => setCommercializerChecker(e.target.value)}
                    placeholder="0x0000000000000000000000000000000000000000"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">📊 Derivative Rev Ceiling</label>
                  <input
                    type="number"
                    className="form-input"
                    value={derivativeRevCeiling}
                    onChange={(e) => setDerivativeRevCeiling(Number(e.target.value))}
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
                onChange={(e) => setPaymentTokenId(Number(e.target.value))}
              >
                {Array.from(ipAssets.keys()).map((id) => {
                  const asset = ipAssets.get(id);
                  const metadata = parsedMetadata.get(id) || { name: "Unknown" };
  return (
                    <option key={id} value={id}>
                      #{id} - {metadata.name || asset?.ipHash.substring(0, 10) || 'Unknown'}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">💰 Amount (XTZ)</label>
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
            
            <button 
              className="btn btn-primary btn-full"
              onClick={payRevenue} 
              disabled={loading || !account?.address}
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
                  const asset = ipAssets.get(id);
                  const metadata = parsedMetadata.get(id) || { name: "Unknown" };
                  return (
                    <option key={id} value={id}>
                      #{id} - {metadata.name || asset?.ipHash.substring(0, 10) || 'Unknown'}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <button 
              className="btn btn-primary btn-full"
              onClick={claimRoyalties} 
              disabled={loading || !account?.address}
            >
              {loading ? '⏳ Claiming...' : '🏆 Claim Royalties'}
            </button>
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
              const metadata = parsedMetadata.get(id) || { name: "Unknown", description: "No description available" };
              const mediaUrl = getIPFSGatewayURL(asset.ipHash);
              
              return (
                <div key={id} className="card hover-lift animate-fade-in">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">{metadata.name || `IP Asset #${id}`}</h3>
                      <p className="card-subtitle">Token #{id}</p>
                    </div>
                    <div className="flex gap-2">
                      {asset.isEncrypted && <span className="badge badge-warning">🔒 Encrypted</span>}
                      {asset.isDisputed && <span className="badge badge-error">⚠️ Disputed</span>}
                    </div>
                  </div>
                  
                  {/* Enhanced Media Preview */}
                  {asset.ipHash && (
                    <div className="media-preview">
                      <div className="media-container">
                        <EnhancedAssetPreview 
                          assetId={id}
                          asset={asset}
                          metadata={metadata}
                          mediaUrl={mediaUrl}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="card-body">
                    <div className="card-field">
                      <span className="card-field-label">Owner</span>
                      <span className="card-field-value address">{asset.owner.substring(0, 10)}...</span>
                      </div>
                    
                    <div className="card-field">
                      <span className="card-field-label">Description</span>
                      <span className="card-field-value">{metadata.description || "No description"}</span>
                    </div>
                    
                    <div className="card-field">
                      <span className="card-field-label">IP Hash</span>
                      <span className="card-field-value address">{asset.ipHash.substring(0, 20)}...</span>
                    </div>
                    
                    <div className="card-field">
                      <span className="card-field-label">Total Revenue</span>
                      <span className="card-field-value">💰 {formatEther(asset.totalRevenue)} XTZ</span>
                    </div>
                    
                    <div className="card-field">
                      <span className="card-field-label">Royalty Tokens</span>
                      <span className="card-field-value">🎯 {Number(asset.royaltyTokens) / 100}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {ipAssets.size === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>No IP Assets Yet</h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>Register your first IP asset to get started!</p>
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
                    <p className="card-subtitle">IP Asset #{Number(license.tokenId)}</p>
                  </div>
                  <div className="flex gap-2">
                    {license.isActive ? (
                      <span className="badge badge-success">✅ Active</span>
                    ) : (
                      <span className="badge badge-error">❌ Inactive</span>
                    )}
                    {license.commercialUse && <span className="badge badge-info">💼 Commercial</span>}
                  </div>
        </div>

                <div className="card-body">
                  <div className="card-field">
                    <span className="card-field-label">Licensee</span>
                    <span className="card-field-value address">{license.licensee.substring(0, 10)}...</span>
        </div>
                  
                  <div className="card-field">
                    <span className="card-field-label">Royalty Rate</span>
                    <span className="card-field-value">💰 {Number(license.royaltyPercentage) / 100}%</span>
      </div>

                  <div className="card-field">
                    <span className="card-field-label">Duration</span>
                    <span className="card-field-value">⏰ {Number(license.duration)} seconds</span>
                  </div>
                  
                  <div className="card-field">
                    <span className="card-field-label">Start Date</span>
                    <span className="card-field-value">
                      📅 {new Date(Number(license.startDate) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="card-field">
                    <span className="card-field-label">Terms Preview</span>
                    <span className="card-field-value">{license.terms.substring(0, 30)}...</span>
                  </div>
                </div>
                
                <div className="card-actions">
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                    📄 View Terms
                  </button>
                  {license.isActive && (
                    <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                      🔄 Renew
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {licenses.size === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎫</div>
                <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>No Licenses Yet</h3>
                <p style={{ color: 'var(--color-text-tertiary)' }}>Mint your first license to start licensing IP assets!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
