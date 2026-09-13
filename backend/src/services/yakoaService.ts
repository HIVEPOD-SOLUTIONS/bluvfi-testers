import axios from 'axios';

const YAKOA_BASE_URL = 'https://docs-demo.ip-api-sandbox.yakoa.io/docs-demo/token'; // Replace with correct network if needed

type RegistrationTx = {
  hash: string;
  block_number: number | bigint;
};

type MediaItem = {
  media_id: string;
  url: string;
};

type YakoaPayload = {
  id: string; // IPA_ID:token_id
  
  registration_tx: RegistrationTx;
  creator_id: string;
  metadata: Record<string, string>; // key-value pairs
  media: MediaItem[];
};

export const submitToYakoa = async (data: YakoaPayload) => {
  try {
    const response = await axios.post(YAKOA_BASE_URL, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Yakoa response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error submitting to Yakoa:', error.response?.data || error.message);
    throw error;
  }
};

export async function fetchInfringementStatus(id: string) {
  try {
    const response = await fetch(`/api/yakoa/status/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch infringement status');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Yakoa status:', error);
    throw error;
  }
}

