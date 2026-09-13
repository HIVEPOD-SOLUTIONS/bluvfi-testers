// src/routes/yakoaRoutes.ts
import express from 'express';
import axios from 'axios';

const router = express.Router();

const YAKOA_API_KEY = process.env.YAKOA_API_KEY!;

const BASE_URL = 'https://docs-demo.ip-api-sandbox.yakoa.io/docs-demo/token';

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

// GET /api/yakoa/status/:id
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const baseId = getBaseIdForYakoa(id);
    
    const yakoaApiUrl = `https://docs-demo.ip-api-sandbox.yakoa.io/docs-demo/token/${encodeURIComponent(baseId)}`;

    console.log("Fetching Yakoa status from:", yakoaApiUrl);
    console.log("🔍 Using base ID for API call:", baseId);

    const response = await axios.get(yakoaApiUrl, {
      headers: {
        'X-API-KEY': process.env.YAKOA_API_KEY || 'your-api-key',
      },
    });
    console.log("Yakoa response:", response.data);

    res.json(response.data);
  } catch (error: any) {
    console.error('❌ Error fetching Yakoa status:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch infringement status' });
  }
});


export default router;
