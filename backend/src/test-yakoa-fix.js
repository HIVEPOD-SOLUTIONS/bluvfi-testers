"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yakoascanner_1 = require("./services/yakoascanner");
async function testYakoaFix() {
    console.log("🧪 Testing Yakoa API fix...");
    try {
        // Test with the problematic ID that was causing the error
        // Updated to use new contract address
        const problematicId = "0xc42ae93e94417728ddec16ff01089a05222ce547:57:1754506037466";
        const baseId = "0xc42ae93e94417728ddec16ff01089a05222ce547:57";
        console.log("📋 Original problematic ID:", problematicId);
        console.log("📋 Base ID for API call:", baseId);
        // Test the check function with the problematic ID
        console.log("🔍 Testing checkYakoaTokenExists with problematic ID...");
        const result = await (0, yakoascanner_1.checkYakoaTokenExists)(problematicId);
        console.log("✅ Test completed successfully!");
        console.log("🔍 Result:", result);
    }
    catch (error) {
        console.error("❌ Test failed:", error.response?.data || error.message);
    }
}
// Run the test
testYakoaFix().then(() => {
    console.log("🏁 Test completed");
    process.exit(0);
}).catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
});
