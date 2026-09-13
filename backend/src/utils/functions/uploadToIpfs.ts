import { PinataSDK } from 'pinata-web3'
import fs from 'fs'
import path from 'path'

if (!process.env.PINATA_JWT) {
    console.warn('⚠️ Warning: PINATA_JWT not set in environment variables');
}

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT || '',
})

export async function uploadJSONToIPFS(jsonMetadata: any): Promise<string> {
    if (!jsonMetadata || typeof jsonMetadata !== 'object') {
        throw new Error('❌ uploadJSONToIPFS: Invalid or empty metadata provided');
    }

    const { IpfsHash } = await pinata.upload.json(jsonMetadata)
    return IpfsHash
}

// Upload file to IPFS (accepts File object directly)
export async function uploadFileToIPFS(file: File): Promise<string> {
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
export async function uploadFileToIPFSFromPath(filePath: string, fileName: string, fileType: string): Promise<string> {
    const fullPath = path.join(process.cwd(), filePath)
    const blob = new Blob([fs.readFileSync(fullPath)])
    const file = new File([blob], fileName, { type: fileType })
    return uploadFileToIPFS(file);
}
