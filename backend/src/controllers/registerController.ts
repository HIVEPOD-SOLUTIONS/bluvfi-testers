import { Request, Response } from 'express';
import { registerIpWithBnbChain } from '../services/storyService';
import { registerToYakoa } from '../services/yakoascanner';
import { Address } from 'viem';
import { convertBigIntsToStrings } from '../utils/bigIntSerializer';

const handleRegistration = async (req: Request, res: Response) => {
  console.log("🔥 Entered handleRegistration");
  try {
    const { ipHash, metadata, isEncrypted, lobosContractAddress, modredIpContractAddress, skipContractCall } = req.body;
    // modredIpContractAddress supported for older clients only
    const contractAddress = lobosContractAddress || modredIpContractAddress;
    console.log("📦 Received body:", req.body);

    // Validate required parameters
    if (!ipHash || !metadata || isEncrypted === undefined) {
      return res.status(400).json({
        error: 'Missing required parameters: ipHash, metadata, isEncrypted'
      });
    }

    // Check if we should skip contract call (for testing when contract doesn't exist)
    if (skipContractCall || process.env.SKIP_CONTRACT_CALL === 'true') {
      console.log("⚠️ Skipping contract call (testing mode)");
      const responseData = {
        message: 'IP Asset metadata prepared successfully (contract call skipped - testing mode)',
        bnbChain: {
          txHash: null,
          ipAssetId: null,
          explorerUrl: null,
          blockNumber: null,
          ipHash
        },
        yakoa: {
          alreadyRegistered: false,
          message: 'Yakoa registration skipped (testing mode)'
        },
        testing: true
      };
      return res.status(200).json(convertBigIntsToStrings(responseData));
    }

    // Validate contract address if contract call is required
    if (!contractAddress) {
      return res.status(400).json({
        error: 'Missing required parameter: lobosContractAddress (or modredIpContractAddress). Set skipContractCall=true to test without contract.'
      });
    }

    // 1. Register on BNB Chain using ModredIP (Bluvfi) contract
    let txHash: string | null = null;
    let ipAssetId: number | undefined = undefined;
    let blockNumber: bigint | null = null;
    let explorerUrl: string | null = null;

    try {
      const result = await registerIpWithBnbChain(ipHash, metadata, isEncrypted, contractAddress as Address);
      if (!result) throw new Error('Registration returned no result');
      txHash = result.txHash;
      ipAssetId = result.ipAssetId;
      blockNumber = result.blockNumber;
      explorerUrl = result.explorerUrl;
      console.log("✅ BNB Chain registration successful:", {
        txHash,
        ipAssetId,
        blockNumber,
        explorerUrl
      });
    } catch (contractError: any) {
      // If contract call fails, check if it's because function doesn't exist
      const errorMsg = contractError?.message || String(contractError || '');
      if (errorMsg.includes('returned no data') || errorMsg.includes('does not have the function')) {
        console.error("❌ Contract function not available. Returning error with suggestion to use testing mode.");
        return res.status(500).json({
          error: 'Contract function "registerIP" does not exist on the contract',
          details: `The contract at ${contractAddress} does not have the registerIP function. ` +
            `To test without contract registration, add "skipContractCall": true to your request body.`,
          suggestion: 'Add "skipContractCall": true to test IPFS upload and metadata creation without contract call',
          contractAddress: contractAddress
        });
      }
      
      // Check if it's an "already known" or nonce error - transaction might have succeeded
      const isNonceError = errorMsg.toLowerCase().includes('already known') || 
                          errorMsg.toLowerCase().includes('nonce') ||
                          errorMsg.toLowerCase().includes('noncetoolow');
      
      if (isNonceError) {
        console.log("⚠️ Nonce/Already Known error detected. Transaction may have succeeded.");
        console.log("⏳ Waiting 5 seconds and checking if transaction was successful...");
        
        // Wait a bit for transaction to be mined
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to find the transaction by checking recent blocks
        // For now, we'll return a success response with a note that we couldn't get the hash
        // The frontend will show a success message, and the user can verify by checking their IP assets
        console.log("✅ Assuming transaction succeeded (already known error). Returning success response.");
        return res.status(200).json(convertBigIntsToStrings({
          message: 'IP Asset registration submitted successfully (transaction was already known)',
          bnbChain: {
            txHash: null,
            ipAssetId: null,
            blockNumber: null,
            explorerUrl: null,
            ipHash,
            note: 'Transaction was submitted but hash could not be retrieved. Please check your IP assets list to confirm registration.'
          },
          yakoa: {
            alreadyRegistered: false,
            message: 'Yakoa registration skipped (transaction hash unavailable)'
          },
          warning: 'Transaction was submitted but we could not retrieve the transaction hash. Please verify registration in your IP assets list.'
        }));
      }
      
      // Re-throw other errors
      throw contractError;
    }

    // 2. Submit to Yakoa (if ipAssetId is available)
    if (ipAssetId) {
      // Ensure contract address is properly formatted
      const formattedContractAddress = contractAddress.toLowerCase();
      
      // Format ID as contract address with token ID: 0x[contract_address]:[token_id]
      // Use base ID format for Yakoa API compatibility
      const Id = `${formattedContractAddress.toLowerCase()}:${ipAssetId}`;
      console.log("📞 Calling registerToYakoa...");
      console.log("🔍 Yakoa ID format:", Id);
      console.log("🔍 Contract address:", formattedContractAddress);
      console.log("🔍 IP Asset ID:", ipAssetId);

      // Parse metadata to get creator and title info
      let parsedMetadata;
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        parsedMetadata = { name: 'Unknown', description: '', creator: 'unknown' };
      }

      // Ensure creator_id is a valid Ethereum address
      let creatorId = parsedMetadata.creator;
      console.log("🔍 Parsed metadata creator:", creatorId);
      
      if (!creatorId || !creatorId.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.log("⚠️ Invalid creator address, using default");
        // Use a default address if creator is not a valid Ethereum address
        creatorId = '0x0000000000000000000000000000000000000000';
      }
      
      // Ensure creator address is lowercase for consistency
      creatorId = creatorId.toLowerCase();
      console.log("✅ Final creator_id for Yakoa:", creatorId);

      // Extract hash from ipfs:// format for Yakoa API
      const extractHash = (ipfsHash: string): string => {
        if (ipfsHash.startsWith('ipfs://')) {
          return ipfsHash.replace('ipfs://', '');
        }
        return ipfsHash;
      };

      // Prepare comprehensive metadata for Yakoa
      const yakoaMetadata = {
        title: parsedMetadata.name || 'Unknown',
        description: parsedMetadata.description || '',
        creator: creatorId,
        created_at: parsedMetadata.created_at || new Date().toISOString(),
        ip_hash: extractHash(ipHash), // Use extracted hash
        is_encrypted: isEncrypted,
        contract_address: formattedContractAddress,
        token_id: ipAssetId.toString(),
        // Add additional metadata for better infringement detection
        content_type: parsedMetadata.content_type || 'unknown',
        file_size: parsedMetadata.file_size || 0,
        mime_type: parsedMetadata.mime_type || 'unknown',
        tags: parsedMetadata.tags || [],
        category: parsedMetadata.category || 'general',
        license_type: parsedMetadata.license_type || 'all_rights_reserved',
        commercial_use: parsedMetadata.commercial_use || false,
        derivatives_allowed: parsedMetadata.derivatives_allowed || false,
      };

      // Prepare media array with more detailed information
      const yakoaMedia = [
        {
          media_id: parsedMetadata.name || 'Unknown',
          url: `https://ipfs.io/ipfs/${extractHash(ipHash)}`, // Use extracted hash for URL
          type: parsedMetadata.mime_type || 'unknown',
          size: parsedMetadata.file_size || 0,
          // Removed hash field as it's not required by Yakoa API
          metadata: {
            name: parsedMetadata.name || 'Unknown',
            description: parsedMetadata.description || '',
            creator: creatorId,
            created_at: parsedMetadata.created_at || new Date().toISOString(),
          }
        },
      ];

      // Prepare authorizations for infringement monitoring
      const authorizations = [
        {
          brand_id: null,
          brand_name: null,
          data: {
            type: 'email' as const,
            email_address: parsedMetadata.creator_email || 'creator@bluvfi.xyz'
          }
        }
      ];

const yakoaResponse = await registerToYakoa({
  Id: Id,
  transactionHash: txHash as `0x${string}`,
  blockNumber: blockNumber || 0n,
        creatorId: creatorId,
        metadata: yakoaMetadata,
        media: yakoaMedia,
        brandId: null,
        brandName: null,
        emailAddress: parsedMetadata.creator_email || 'creator@bluvfi.xyz',
        licenseParents: [],
        authorizations: authorizations,
});

      // Determine success message based on Yakoa response
      const successMessage = yakoaResponse.alreadyRegistered 
        ? 'IP Asset registered on BNB Chain, already exists in Yakoa'
        : 'IP Asset successfully registered on BNB Chain and Yakoa';

      const responseData = {
        message: successMessage,
        bnbChain: {
        txHash,
          ipAssetId,
        explorerUrl,
          blockNumber,
          ipHash
      },
      yakoa: yakoaResponse,
      };

      return res.status(200).json(convertBigIntsToStrings(responseData));
    } else {
      const responseData = {
        message: 'Registration successful (IP Asset ID not extracted)',
        bnbChain: {
          txHash,
          ipAssetId: null,
          explorerUrl,
          blockNumber,
          ipHash
        },
      };

      return res.status(200).json(convertBigIntsToStrings(responseData));
    }
  } catch (err) {
    console.error('❌ Registration error:', err);
    
    // Ensure error message is properly serialized
    let errorMessage = 'Registration failed';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = String(err.message);
    }
    
    return res.status(500).json({
      error: errorMessage,
      details: err instanceof Error ? err.message : String(err),
    });
  }
};

export default handleRegistration;
