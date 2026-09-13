// Script to check if contracts were actually deployed despite the error
const { createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

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

async function checkDeploymentStatus() {
  try {
    console.log('🔍 Checking deployment status for:', account.address);
    console.log('💡 Explorer: https://testnet.bscscan.com/address/' + account.address);
    console.log('');
    
    // Check nonce status
    const confirmedNonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'latest',
    });
    
    const pendingNonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });
    
    console.log('📊 Nonce Status:');
    console.log(`   Confirmed: ${confirmedNonce}`);
    console.log(`   Pending: ${pendingNonce}`);
    console.log(`   Pending transactions: ${pendingNonce - confirmedNonce}`);
    console.log('');
    
    // Check recent transactions
    console.log('📋 Checking recent transactions...');
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`   Current block: ${blockNumber}`);
    console.log('');
    
    if (pendingNonce > confirmedNonce) {
      console.log('⚠️  You have pending transactions!');
      console.log('   Transaction hashes from journal:');
      console.log('   - ERC6551Account: 0x2f1b071a30357b28f0a53f028a4e2e8551cfabcbdb87c5340ca919924af48830 (nonce 160)');
      console.log('   - ERC6551Registry: (nonce 161)');
      console.log('');
      console.log('💡 Solutions:');
      console.log('   1. Wait 2-5 minutes for transactions to confirm');
      console.log('   2. Check explorer: https://testnet.bscscan.com/address/' + account.address);
      console.log('   3. If transactions are confirmed, you can clear the journal and continue');
      console.log('   4. If transactions are stuck, you may need to wait longer');
    } else {
      console.log('✅ No pending transactions. Safe to deploy!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDeploymentStatus();
