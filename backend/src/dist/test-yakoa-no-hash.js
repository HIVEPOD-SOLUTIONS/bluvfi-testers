"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yakoascanner_1 = require("./services/yakoascanner");
async function testYakoaWithoutHash() {
    console.log("🧪 Testing Yakoa registration without hash field...");
    try {
        // Test with a sample IP asset
        const contractAddress = "0x8f0a1ac6ca4f8cb0417112069c0f4dc93b9f0217";
        const tokenId = 9999; // Use a unique token ID
        const testId = `${contractAddress.toLowerCase()}:${tokenId}`;
        console.log("📋 Test ID:", testId);
        // Check if it exists first
        const exists = await (0, yakoascanner_1.checkYakoaTokenExists)(testId);
        console.log("🔍 Asset exists:", exists);
        if (!exists) {
            // Try to register without hash field
            console.log("📝 Attempting to register new asset without hash...");
            const result = await (0, yakoascanner_1.registerToYakoa)({
                Id: testId,
                transactionHash: "0xa6aa90bc9033aebf5d3efa8be88b85377ebf8d55aa053439f0217e1ccdedd3b2",
                blockNumber: 5177789n,
                creatorId: "0xd4a6166d966f4821ce8658807466dd0b0bb92ae9",
                metadata: {
                    title: "Test IP Asset (No Hash)",
                    description: "This is a test IP asset without hash field",
                },
                media: [{
                        media_id: "Test IP Asset (No Hash)",
                        url: "https://ipfs.io/ipfs/bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"
                        // No hash field - this should work
                    }],
            });
            console.log("✅ Registration result:", result);
        }
        else {
            console.log("⚠️ Asset already exists, skipping registration");
        }
    }
    catch (error) {
        console.error("❌ Test failed:", error.response?.data || error.message);
    }
}
// Run the test
testYakoaWithoutHash().then(() => {
    console.log("🏁 Test completed");
    process.exit(0);
}).catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
});
