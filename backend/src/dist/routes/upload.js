"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uploadToIpfs_1 = require("../utils/functions/uploadToIpfs");
const bigIntSerializer_1 = require("../utils/bigIntSerializer");
const router = (0, express_1.Router)();
// Configure multer for file uploads (memory storage)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
});
// IPFS file upload endpoint
router.post('/ipfs', upload.single('file'), async (req, res) => {
    console.log('🔥 Entered IPFS upload endpoint');
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file provided',
                message: 'Please provide a file to upload'
            });
        }
        console.log('📦 Received file:', {
            name: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        // Convert buffer to File object for Pinata SDK
        // Note: File constructor might not be available in Node.js, so we'll use a workaround
        const fileBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
        // Create a File-like object for Pinata SDK
        // Pinata SDK accepts File or Blob, so we can use the blob directly or create a File
        let file;
        if (typeof File !== 'undefined') {
            file = new File([fileBlob], req.file.originalname, { type: req.file.mimetype });
        }
        else {
            // Fallback for Node.js environments where File might not be available
            file = fileBlob;
        }
        // Upload to IPFS using Pinata
        const ipfsHash = await (0, uploadToIpfs_1.uploadFileToIPFS)(file);
        console.log('✅ File uploaded to IPFS:', ipfsHash);
        return res.status(200).json((0, bigIntSerializer_1.convertBigIntsToStrings)({
            success: true,
            cid: ipfsHash,
            ipfsUrl: `ipfs://${ipfsHash}`,
            gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            message: 'File uploaded successfully to IPFS'
        }));
    }
    catch (err) {
        console.error('❌ IPFS upload error:', err);
        let errorMessage = 'Failed to upload file to IPFS';
        if (err instanceof Error) {
            errorMessage = err.message;
        }
        else if (typeof err === 'string') {
            errorMessage = err;
        }
        return res.status(500).json({
            error: errorMessage,
            details: err instanceof Error ? err.message : String(err),
        });
    }
});
exports.default = router;
