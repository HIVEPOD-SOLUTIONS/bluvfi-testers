import { Address } from 'viem';
export interface IpMetadata {
    name: string;
    description: string;
    image: string;
    external_url?: string;
    attributes?: Array<{
        trait_type: string;
        value: string | number;
    }>;
    license?: string;
    creator?: string;
    created_at?: string;
}
export declare const checkExistingLicenses: (tokenId: number, modredIpContractAddress: Address) => Promise<boolean>;
export declare const registerIpWithBnbChain: (ipHash: string, metadata: string, isEncrypted: boolean, modredIpContractAddress: Address) => Promise<{
    txHash: `0x${string}`;
    ipAssetId: number | undefined;
    blockNumber: any;
    explorerUrl: string;
}>;
export declare const mintLicenseOnBnbChain: (tokenId: number, royaltyPercentage: number, duration: number, commercialUse: boolean, terms: string, modredIpContractAddress: Address) => Promise<{
    txHash: `0x${string}`;
    blockNumber: any;
    explorerUrl: string;
}>;
//# sourceMappingURL=storyService.d.ts.map