"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const register_1 = __importDefault(require("./routes/register"));
const yakoaRoutes_1 = __importDefault(require("./routes/yakoaRoutes"));
const license_1 = __importDefault(require("./routes/license"));
const infringement_1 = __importDefault(require("./routes/infringement"));
const bluvfiTesters_1 = __importDefault(require("./routes/bluvfiTesters"));
const config_1 = require("./utils/config");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// API Routes
app.use('/api/register', register_1.default);
app.use('/api/yakoa', yakoaRoutes_1.default);
app.use('/api/license', license_1.default);
app.use('/api/infringement', infringement_1.default);
app.use('/api/bluvfi-testers', bluvfiTesters_1.default);
// Default route (optional)
app.get('/', (_req, res) => {
    res.send('✅ Yakoa + BNB Chain backend is running!');
});
// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running at http://localhost:${PORT}`);
    try {
        const host = new URL(config_1.networkInfo.rpcProviderUrl).hostname;
        console.log(`📡 RPC: ${host} (chain ${config_1.networkInfo.chain.id})`);
    }
    catch {
        console.log(`📡 RPC: ${config_1.networkInfo.rpcProviderUrl?.slice(0, 40)}... (chain ${config_1.networkInfo.chain.id})`);
    }
});
