import { Request, Response } from 'express';
import { mintLicense, LicenseRequest } from '../services/licenseService';
import { convertBigIntsToStrings } from '../utils/bigIntSerializer';

const handleLicenseMinting = async (req: Request, res: Response) => {
    console.log("🔥 Entered handleLicenseMinting");
    try {
        const { tokenId, royaltyPercentage, duration, commercialUse, terms, lobosContractAddress } = req.body;
        console.log("📦 Received license request:", req.body);

        // Validate required parameters
if (!tokenId || !royaltyPercentage || !duration || commercialUse === undefined || !terms || !lobosContractAddress) {
      return res.status(400).json({
        error: 'Missing required parameters: tokenId, royaltyPercentage, duration, commercialUse, terms, lobosContractAddress'
      });
    }

    const licenseRequest: LicenseRequest = {
      tokenId,
      royaltyPercentage,
      duration,
      commercialUse,
      terms,
      lobosContractAddress
        };

        const result = await mintLicense(licenseRequest);

        if (result.success) {
            const responseData: any = {
                message: result.message,
                data: {
                    txHash: result.txHash,
                    blockNumber: result.blockNumber,
                    explorerUrl: result.explorerUrl
                }
            };
            // Include warning if present
            if ((result as any).warning) {
                responseData.warning = (result as any).warning;
            }
            return res.status(200).json(convertBigIntsToStrings(responseData));
        } else {
            return res.status(500).json({
                error: result.message,
                details: result.error
            });
        }
    } catch (err) {
        console.error('❌ License minting error:', err);
        return res.status(500).json({
            error: 'License minting failed',
            details: err instanceof Error ? err.message : err,
        });
    }
};

export default handleLicenseMinting; 