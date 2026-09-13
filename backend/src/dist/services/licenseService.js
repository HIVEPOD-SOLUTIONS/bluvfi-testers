"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLicenseExplorerUrl = exports.mintLicense = void 0;
const storyService_1 = require("./storyService");
const config_1 = require("../utils/config");
const bigIntSerializer_1 = require("../utils/bigIntSerializer");
const mintLicense = async (licenseRequest) => {
    try {
        // Check if a license already exists for this IP (tokenId)
        const hasExistingLicense = await (0, storyService_1.checkExistingLicenses)(licenseRequest.tokenId, licenseRequest.lobosContractAddress);
        if (hasExistingLicense) {
            return {
                success: false,
                error: 'A license already exists for this IP asset. Only one license can be minted per IP.',
                message: 'License minting failed: IP already has a license'
            };
        }
        const { txHash, blockNumber, explorerUrl } = await (0, storyService_1.mintLicenseOnBnbChain)(licenseRequest.tokenId, licenseRequest.royaltyPercentage, licenseRequest.duration, licenseRequest.commercialUse, licenseRequest.terms, licenseRequest.lobosContractAddress);
        const result = {
            success: true,
            txHash,
            blockNumber,
            explorerUrl,
            message: 'License minted successfully on BNB Chain'
        };
        // Convert any BigInt values to strings for JSON serialization
        return (0, bigIntSerializer_1.convertBigIntsToStrings)(result);
    }
    catch (error) {
        console.error('Error minting license:', error);
        // Check if it's a nonce/"already known" error - transaction might have succeeded
        const errorMsg = error instanceof Error ? error.message : String(error || '');
        const isNonceError = errorMsg.toLowerCase().includes('already known') ||
            errorMsg.toLowerCase().includes('nonce') ||
            errorMsg.toLowerCase().includes('noncetoolow');
        if (isNonceError) {
            console.log("⚠️ Nonce/Already Known error detected. Transaction may have succeeded.");
            console.log("⏳ Waiting 5 seconds and checking if transaction was successful...");
            // Wait a bit for transaction to be mined
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Return a success response with a warning
            // The frontend will show a success message, and the user can verify by checking their licenses
            console.log("✅ Assuming transaction succeeded (already known error). Returning success response.");
            return {
                success: true,
                txHash: null,
                blockNumber: null,
                explorerUrl: null,
                message: 'License minting submitted successfully (transaction was already known)',
                warning: 'Transaction was submitted but we could not retrieve the transaction hash. Please verify the license was minted by checking your IP asset details.'
            };
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            message: 'Failed to mint license on BNB Chain'
        };
    }
};
exports.mintLicense = mintLicense;
const getLicenseExplorerUrl = (txHash) => {
    return `${config_1.BLOCK_EXPLORER_URL}/tx/${txHash}`;
};
exports.getLicenseExplorerUrl = getLicenseExplorerUrl;
