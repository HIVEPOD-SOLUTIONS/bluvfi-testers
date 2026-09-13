"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadJSONToIPFS = uploadJSONToIPFS;
exports.uploadFileToIPFS = uploadFileToIPFS;
exports.uploadFileToIPFSFromPath = uploadFileToIPFSFromPath;
const pinata_web3_1 = require("pinata-web3");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
if (!process.env.PINATA_JWT) {
    console.warn('⚠️ Warning: PINATA_JWT not set in environment variables');
}
const pinata = new pinata_web3_1.PinataSDK({
    pinataJwt: process.env.PINATA_JWT || '',
});
async function uploadJSONToIPFS(jsonMetadata) {
    if (!jsonMetadata || typeof jsonMetadata !== 'object') {
        throw new Error('❌ uploadJSONToIPFS: Invalid or empty metadata provided');
    }
    const { IpfsHash } = await pinata.upload.json(jsonMetadata);
    return IpfsHash;
}
// Upload file to IPFS (accepts File object directly)
async function uploadFileToIPFS(file) {
    if (!file) {
        throw new Error('❌ uploadFileToIPFS: No file provided');
    }
    console.log('📤 Uploading file to Pinata:', {
        name: file.name,
        size: file.size,
        type: file.type
    });
    const { IpfsHash } = await pinata.upload.file(file);
    console.log('✅ File uploaded to IPFS:', IpfsHash);
    return IpfsHash;
}
// Legacy function for file path uploads (kept for backward compatibility)
async function uploadFileToIPFSFromPath(filePath, fileName, fileType) {
    const fullPath = path_1.default.join(process.cwd(), filePath);
    const blob = new Blob([fs_1.default.readFileSync(fullPath)]);
    const file = new File([blob], fileName, { type: fileType });
    return uploadFileToIPFS(file);
}
