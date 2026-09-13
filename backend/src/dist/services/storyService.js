"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintLicenseOnBnbChain = exports.registerIpWithBnbChain = exports.checkExistingLicenses = void 0;
const config_1 = require("../utils/config");
// ModredIP contract ABI (simplified for IP registration)
const MODRED_IP_ABI = [
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "ipHash",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "metadata",
                "type": "string"
            },
            {
                "internalType": "bool",
                "name": "isEncrypted",
                "type": "bool"
            }
        ],
        "name": "registerIP",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "royaltyPercentage",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "duration",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "commercialUse",
                "type": "bool"
            },
            {
                "internalType": "string",
                "name": "terms",
                "type": "string"
            }
        ],
        "name": "mintLicense",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "tokenLicenses",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];
// Helper function to check if a tokenId already has licenses
const checkExistingLicenses = async (tokenId, modredIpContractAddress) => {
    try {
        // For public mappings to arrays, Solidity generates a getter that takes (key, index)
        // Try to read index 0 - if it succeeds, there's at least one license
        try {
            const licenseId = await config_1.publicClient.readContract({
                address: modredIpContractAddress,
                abi: MODRED_IP_ABI,
                functionName: 'tokenLicenses',
                args: [BigInt(tokenId), BigInt(0)],
            });
            // If we successfully read index 0, there's at least one license
            console.log(`✅ Found existing license for tokenId ${tokenId}: licenseId ${licenseId}`);
            return true;
        }
        catch (indexError) {
            // If reading index 0 fails, it means the array is empty or doesn't exist
            const errorMsg = indexError?.message || String(indexError || '');
            if (errorMsg.includes('execution reverted') || errorMsg.includes('out of bounds')) {
                // Array is empty - no licenses exist
                console.log(`ℹ️ No existing licenses found for tokenId ${tokenId}`);
                return false;
            }
            // Some other error - rethrow
            throw indexError;
        }
    }
    catch (error) {
        // If the function doesn't exist or there's an error, log it but don't fail
        // This allows the system to work even if the contract doesn't have this function
        console.warn('⚠️ Could not check existing licenses:', error);
        return false; // Default to allowing minting if we can't check
    }
};
exports.checkExistingLicenses = checkExistingLicenses;
const registerIpWithBnbChain = async (ipHash, metadata, isEncrypted, modredIpContractAddress) => {
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log('ipHash:', ipHash);
            console.log('metadata:', metadata);
            console.log('isEncrypted:', isEncrypted);
            // Register IP on ModredIP contract. Try simulation first; some RPCs return
            // "returned no data" for eth_call even when the transaction would succeed, so we fall back
            // to sending the transaction directly.
            let hash;
            try {
                const { request } = await config_1.publicClient.simulateContract({
                    address: modredIpContractAddress,
                    abi: MODRED_IP_ABI,
                    functionName: 'registerIP',
                    args: [ipHash, metadata, isEncrypted],
                    account: config_1.account.address,
                });
                hash = await config_1.walletClient.writeContract({
                    ...request,
                    account: config_1.account,
                });
                console.log(`📊 Transaction submitted with hash: ${hash} (attempt ${attempt + 1}/${maxRetries})`);
            }
            catch (simulateOrWriteError) {
                const errMsg = (simulateOrWriteError?.message || simulateOrWriteError?.shortMessage || '').toLowerCase();
                const isNoData = errMsg.includes('returned no data') || (errMsg.includes('0x') && errMsg.includes('no data'));
                if (isNoData) {
                    console.log('⚠️ Simulation returned no data. Submitting transaction directly...');
                    try {
                        hash = await config_1.walletClient.writeContract({
                            address: modredIpContractAddress,
                            abi: MODRED_IP_ABI,
                            functionName: 'registerIP',
                            args: [ipHash, metadata, isEncrypted],
                            account: config_1.account,
                            chain: config_1.networkInfo.chain,
                        });
                        console.log(`📊 Transaction submitted (no sim): ${hash} (attempt ${attempt + 1}/${maxRetries})`);
                    }
                    catch (directError) {
                        throw directError;
                    }
                }
                else {
                    throw simulateOrWriteError;
                }
            }
            if (!hash) {
                throw new Error('Transaction failed: No transaction hash received');
            }
            // If we have a hash, wait for receipt
            if (hash) {
                try {
                    const receipt = await config_1.publicClient.waitForTransactionReceipt({ hash });
                    // Extract IP Asset ID from transaction logs
                    let ipAssetId;
                    if (receipt.logs && receipt.logs.length > 0) {
                        // Look for the Transfer event which contains the token ID
                        for (const log of receipt.logs) {
                            if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                                // Transfer event signature
                                if (log.topics[3]) {
                                    ipAssetId = parseInt(log.topics[3], 16);
                                    break;
                                }
                            }
                        }
                    }
                    console.log(`✅ Transaction succeeded! Hash: ${hash}, IP Asset ID: ${ipAssetId}`);
                    return {
                        txHash: hash,
                        ipAssetId: ipAssetId,
                        blockNumber: receipt.blockNumber,
                        explorerUrl: `${config_1.BLOCK_EXPLORER_URL}/tx/${hash}`,
                    };
                }
                catch (receiptError) {
                    // If waiting for receipt fails, continue to error handling
                    console.error(`❌ Error waiting for receipt:`, receiptError?.message || receiptError);
                    throw receiptError;
                }
            }
        }
        catch (error) {
            lastError = error;
            console.error(`❌ Error registering IP on chain (attempt ${attempt + 1}/${maxRetries}):`, error?.message || error);
            // Check if it's a nonce-related error (check nested cause chain)
            const checkNonceError = (err, depth = 0) => {
                if (!err || depth > 5)
                    return false; // Prevent infinite recursion
                const message = (err?.message || err?.shortMessage || err?.details || '').toLowerCase();
                const name = (err?.name || '').toLowerCase();
                const status = err?.status;
                const body = err?.body || '';
                const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
                // Check for nonce-related errors
                const isNonce = message.includes('nonce') ||
                    message.includes('already known') ||
                    name.includes('nonce') ||
                    name.includes('noncetoolow');
                // Check for HTTP 410 errors related to pending blockTag (RPC limitation)
                const isPendingBlockTagError = status === 410 &&
                    (bodyStr.includes('pending') ||
                        bodyStr.includes('eth_getTransactionCount') ||
                        message.includes('pending'));
                if (isNonce || isPendingBlockTagError)
                    return true;
                // Recursively check cause chain
                return checkNonceError(err?.cause, depth + 1);
            };
            const isNonceError = checkNonceError(error);
            if (isNonceError && attempt < maxRetries - 1) {
                // Wait a bit before retrying to allow nonce to update
                // For HTTP 410 errors, wait a bit longer as it's an RPC issue
                const isRpcError = error?.status === 410;
                const delay = isRpcError ? (attempt + 1) * 2000 : (attempt + 1) * 1000; // 2s, 4s, 6s for RPC errors, 1s, 2s, 3s for others
                console.log(`⏳ Nonce/RPC error detected. Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry with fresh nonce
            }
            // If not a nonce error or last attempt, throw
            throw error;
        }
    }
    // If we exhausted all retries, throw the last error
    throw lastError;
};
exports.registerIpWithBnbChain = registerIpWithBnbChain;
const mintLicenseOnBnbChain = async (tokenId, royaltyPercentage, duration, commercialUse, terms, modredIpContractAddress) => {
    const maxRetries = 3;
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const { request } = await config_1.publicClient.simulateContract({
                address: modredIpContractAddress,
                abi: MODRED_IP_ABI,
                functionName: 'mintLicense',
                args: [
                    BigInt(tokenId),
                    BigInt(royaltyPercentage),
                    BigInt(duration),
                    commercialUse,
                    terms
                ],
                account: config_1.account.address,
            });
            // Let viem handle nonce automatically - explicitly setting nonce can cause conflicts
            // when transactions are submitted rapidly, leading to "already known" errors
            // even though the transaction succeeds
            let hash;
            try {
                hash = await config_1.walletClient.writeContract({
                    ...request,
                    account: config_1.account,
                    // Don't set nonce - let viem/wallet handle it automatically
                });
                console.log(`📊 Transaction submitted with hash: ${hash} (attempt ${attempt + 1}/${maxRetries})`);
            }
            catch (writeError) {
                // Sometimes writeContract throws an error even if transaction was submitted
                // Check if we got a hash despite the error
                const errorHash = writeError?.hash || writeError?.transactionHash || writeError?.data?.hash;
                if (errorHash) {
                    console.log(`⚠️ Got transaction hash despite error: ${errorHash}`);
                    hash = errorHash;
                }
                else {
                    // Check if error contains "already known" - transaction was likely submitted
                    const errorMsg = (writeError?.message || writeError?.shortMessage || writeError?.details || '').toLowerCase();
                    if (errorMsg.includes('already known')) {
                        console.log(`⚠️ Transaction "already known" - transaction was likely submitted successfully`);
                        console.log(`⏳ Waiting 5 seconds to allow transaction to be mined, then checking for receipt...`);
                        // Wait a bit for transaction to be mined
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        // Try to find the transaction by checking the account's transaction count
                        // and looking for the most recent transaction to our contract
                        try {
                            // Get the account's transaction count to find the nonce that was used
                            const txCount = await config_1.publicClient.getTransactionCount({
                                address: config_1.account.address,
                                blockTag: 'latest'
                            });
                            // The transaction that was submitted would have used nonce (txCount - 1) or (txCount - 2)
                            // Check recent blocks for transactions from our account to our contract
                            const currentBlock = await config_1.publicClient.getBlockNumber();
                            const blocksToCheck = 20; // Check last 20 blocks
                            for (let i = 0; i < blocksToCheck; i++) {
                                const blockNumber = currentBlock - BigInt(i);
                                try {
                                    const block = await config_1.publicClient.getBlock({ blockNumber, includeTransactions: true });
                                    if (block && block.transactions) {
                                        for (const tx of block.transactions) {
                                            if (typeof tx === 'object' &&
                                                tx.from?.toLowerCase() === config_1.account.address.toLowerCase() &&
                                                tx.to?.toLowerCase() === modredIpContractAddress.toLowerCase() &&
                                                tx.input && tx.input.startsWith('0xa8597e13')) { // mintLicense function selector
                                                // Found a matching transaction
                                                const txHash = tx.hash;
                                                console.log(`✅ Found matching transaction: ${txHash}`);
                                                hash = txHash;
                                                break;
                                            }
                                        }
                                    }
                                    if (hash)
                                        break;
                                }
                                catch (blockError) {
                                    // Continue to next block
                                    continue;
                                }
                            }
                        }
                        catch (txLookupError) {
                            console.log(`⚠️ Could not find transaction hash:`, txLookupError);
                        }
                        // If we still don't have a hash, throw the error to trigger retry logic
                        // But log that the transaction was likely successful
                        if (!hash) {
                            console.log(`⚠️ Could not find transaction hash, but "already known" suggests it was submitted`);
                            throw writeError;
                        }
                    }
                    else {
                        throw writeError;
                    }
                }
            }
            // If we have a hash, wait for receipt (even if there was an error)
            if (hash) {
                try {
                    const receipt = await config_1.publicClient.waitForTransactionReceipt({ hash });
                    console.log(`✅ Transaction succeeded! Hash: ${hash}`);
                    return {
                        txHash: hash,
                        blockNumber: receipt.blockNumber,
                        explorerUrl: `${config_1.BLOCK_EXPLORER_URL}/tx/${hash}`,
                    };
                }
                catch (receiptError) {
                    // If waiting for receipt fails, continue to error handling
                    console.error(`❌ Error waiting for receipt:`, receiptError?.message || receiptError);
                    throw receiptError;
                }
            }
            // If we don't have a hash, throw the original error
            throw new Error('Transaction failed: No transaction hash received');
        }
        catch (error) {
            lastError = error;
            console.error(`❌ Error minting license on chain (attempt ${attempt + 1}/${maxRetries}):`, error?.message || error);
            // Check if it's a nonce-related error (check nested cause chain)
            const checkNonceError = (err, depth = 0) => {
                if (!err || depth > 5)
                    return false; // Prevent infinite recursion
                const message = (err?.message || err?.shortMessage || err?.details || '').toLowerCase();
                const name = (err?.name || '').toLowerCase();
                const status = err?.status;
                const body = err?.body || '';
                const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
                // Check for nonce-related errors
                const isNonce = message.includes('nonce') ||
                    message.includes('already known') ||
                    name.includes('nonce') ||
                    name.includes('noncetoolow');
                // Check for HTTP 410 errors related to pending blockTag (RPC limitation)
                const isPendingBlockTagError = status === 410 &&
                    (bodyStr.includes('pending') ||
                        bodyStr.includes('eth_getTransactionCount') ||
                        message.includes('pending'));
                if (isNonce || isPendingBlockTagError)
                    return true;
                // Recursively check cause chain
                return checkNonceError(err?.cause, depth + 1);
            };
            const isNonceError = checkNonceError(error);
            if (isNonceError && attempt < maxRetries - 1) {
                // Wait a bit before retrying to allow nonce to update
                // For HTTP 410 errors, wait a bit longer as it's an RPC issue
                const isRpcError = error?.status === 410;
                const delay = isRpcError ? (attempt + 1) * 2000 : (attempt + 1) * 1000; // 2s, 4s, 6s for RPC errors, 1s, 2s, 3s for others
                console.log(`⏳ Nonce/RPC error detected. Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // Retry with fresh nonce
            }
            // If not a nonce error or last attempt, throw
            throw error;
        }
    }
    // If we exhausted all retries, throw the last error
    throw lastError;
};
exports.mintLicenseOnBnbChain = mintLicenseOnBnbChain;
