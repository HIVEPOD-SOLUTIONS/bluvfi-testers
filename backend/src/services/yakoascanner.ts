
// yakoaScanner.ts
import axios from "axios";
import dotenv from "dotenv";
import { sanitizeBigInts } from "../utils1/sanitizeBigInts";
dotenv.config();

const YAKOA_API_KEY = process.env.YAKOA_API_KEY!;
const SUBDOMAIN = process.env.YAKOA_SUBDOMAIN!;
const NETWORK = process.env.YAKOA_NETWORK!;
const REGISTER_TOKEN_URL = `https://${SUBDOMAIN}.ip-api-sandbox.yakoa.io/${NETWORK}/token`;

/**
 * Extract base ID without timestamp for Yakoa API calls
 * @param id - The full ID (may include timestamp)
 * @returns Base ID in format contract:tokenId
 */
function getBaseIdForYakoa(id: string): string {
  const parts = id.split(':');
  if (parts.length >= 2) {
    // Return contract:tokenId format (first two parts)
    return `${parts[0]}:${parts[1]}`;
  }
  return id; // Return as-is if no colon found
}

// Check if IP asset already exists in Yakoa
export async function checkYakoaTokenExists(id: string): Promise<boolean> {
  try {
    const baseId = getBaseIdForYakoa(id);
    console.log("🔍 Checking Yakoa with base ID:", baseId);
    
    const response = await axios.get(`${REGISTER_TOKEN_URL}/${baseId}`, {
      headers: {
        "X-API-KEY": YAKOA_API_KEY,
      },
    });
    console.log("✅ IP asset already exists in Yakoa:", response.data);
    return true;
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log("✅ IP asset does not exist in Yakoa, can proceed with registration");
      return false;
    }
    console.error("❌ Error checking Yakoa token existence:", err.response?.data || err.message);
    throw err;
  }
}

export async function registerToYakoa({
  Id,
  transactionHash,
  blockNumber,
  creatorId,
  metadata,
  media,
  brandId = null,
  brandName = null,
  emailAddress = null,
  licenseParents = [],
  authorizations = []
}: {
  Id: string;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  creatorId: string;
  metadata: { [key: string]: string };
  media: { media_id: string; url: string }[];
  brandId?: string | null;
  brandName?: string | null;
  emailAddress?: string | null;
  licenseParents?: Array<{ parent_id: string; license_id: string }>;
  authorizations?: Array<{
    brand_id?: string | null;
    brand_name?: string | null;
    data: {
      type: 'email';
      email_address: string;
    } | null;
  }>;
}) {
  const timestamp = new Date().toISOString();
  
  try {
    // Check if IP asset already exists
    const alreadyExists = await checkYakoaTokenExists(Id);
    if (alreadyExists) {
      console.log("⚠️ IP asset already registered in Yakoa, returning existing data");
      const existingData = await getYakoaToken(Id);
      return {
        ...existingData,
        alreadyRegistered: true,
        message: "IP asset already registered in Yakoa"
      };
    }

    const baseId = getBaseIdForYakoa(Id);
    console.log("🔍 Using base ID for Yakoa registration:", baseId);
    
    const payload = {
      id: baseId, // Use base ID without timestamp for Yakoa API
      registration_tx: {
        hash: transactionHash.toLowerCase(),
        block_number: blockNumber,
        timestamp,
      },
      creator_id: creatorId.toLowerCase(), // Ensure creator_id is lowercase
      metadata,
      media,
      license_parents: licenseParents,
      token_authorizations: authorizations,
      creator_authorizations: authorizations,
    };
    console.log("🧪 Raw Payload Before Sanitization:", payload);

    let sanitizedPayload;
try {
  sanitizedPayload = sanitizeBigInts(payload);
} catch (err) {
  console.error("🔥 Error in sanitizeBigInts:", err);
  throw err;
}
    console.log("💡 Yakoa Payload:", JSON.stringify(sanitizedPayload, null, 2));

    const response = await axios.post(
      REGISTER_TOKEN_URL,
      sanitizedPayload,
      {
        headers: {
          "X-API-KEY": YAKOA_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Yakoa Registration Response:", response.data);
    return {
      ...response.data,
      alreadyRegistered: false,
      message: "IP asset successfully registered in Yakoa"
    };
  } catch (err: any) {
    // Handle 409 Conflict specifically
    if (err.response?.status === 409) {
      console.log("⚠️ IP asset already registered (409 Conflict), fetching existing data");
      try {
        const existingData = await getYakoaToken(Id);
        return {
          ...existingData,
          alreadyRegistered: true,
          message: "IP asset already registered in Yakoa (handled conflict)"
        };
      } catch (fetchErr) {
        console.error("❌ Error fetching existing data after conflict:", fetchErr);
        throw err; // Re-throw original error if we can't fetch existing data
      }
    }
    
    console.error("❌ Error registering to Yakoa:", err.response?.data || err.message);
    throw err;
  }
}
export async function getYakoaToken(id: string) {
  try {
    const baseId = getBaseIdForYakoa(id);
    console.log("🔍 Fetching Yakoa token with base ID:", baseId);
    const response = await axios.get(`${REGISTER_TOKEN_URL}/${baseId}`, {
      headers: {
        "X-API-KEY": YAKOA_API_KEY,
      },
    });

    console.log("✅ Yakoa Token Data:", response.data);
    return response.data;
  } catch (err: any) {
    console.error("❌ Error fetching Yakoa token:", err.response?.data || err.message);
    throw err;
  }
}

export async function getYakoaInfringementStatus(id: string) {
  try {
    const baseId = getBaseIdForYakoa(id);
    console.log("🔍 Fetching Yakoa infringement status with base ID:", baseId);
    const response = await axios.get(`${REGISTER_TOKEN_URL}/${baseId}`, {
      headers: {
        "X-API-KEY": YAKOA_API_KEY,
      },
    });

    const tokenData = response.data;
    const infringementStatus = {
      id: tokenData.id,
      status: tokenData.infringements?.status || 'unknown',
      result: tokenData.infringements?.result || 'unknown',
      inNetworkInfringements: tokenData.infringements?.in_network_infringements || [],
      externalInfringements: tokenData.infringements?.external_infringements || [],
      credits: tokenData.infringements?.credits || {},
      lastChecked: tokenData.infringements?.last_checked || null,
      totalInfringements: (tokenData.infringements?.in_network_infringements?.length || 0) + 
                         (tokenData.infringements?.external_infringements?.length || 0)
    };

    console.log("✅ Yakoa Infringement Status:", infringementStatus);
    return infringementStatus;
  } catch (err: any) {
    console.error("❌ Error fetching Yakoa infringement status:", err.response?.data || err.message);
    throw err;
  }
}
