// Quick script to check deployer nonce and pending transactions
const { createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

// Get deployer address from private key
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!deployerPrivateKey) {
  console.error('❌ DEPLOYER_PRIVATE_KEY not set');
  process.exit(1);
}

const account = privateKeyToAccount(`0x${deployerPrivateKey.replace(/^0x/, '')}`);

const publicClient = createPublicClient({
  chain: {
    id: 97,
    name: 'BNB Smart Chain Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://data-seed-prebsc-1-s1.binance.org:8545/'] },
    },
  },
  transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
});

async function checkNonce() {
  try {
    console.log('🔍 Checking deployer account:', account.address);
    console.log('');
    
    // Get confirmed nonce
    const confirmedNonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'latest',
    });
    
    // Get pending nonce (includes pending transactions)
    const pendingNonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });
    
    console.log('📊 Nonce Status:');
    console.log(`   Confirmed (latest): ${confirmedNonce}`);
    console.log(`   Pending (includes pending tx): ${pendingNonce}`);
    console.log(`   Pending transactions: ${pendingNonce - confirmedNonce}`);
    console.log('');
    
    if (pendingNonce > confirmedNonce) {
      console.log('⚠️  You have pending transactions!');
      console.log('   Please wait for them to be confirmed before deploying again.');
      console.log('');
      console.log('💡 Check your transactions at:');
      console.log(`   https://testnet.bscscan.com/address/${account.address}`);
    } else {
      console.log('✅ No pending transactions. Safe to deploy!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkNonce();
