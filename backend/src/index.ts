import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import registerRoutes from './routes/register';
import yakoaRoutes from './routes/yakoaRoutes';
import licenseRoutes from './routes/license';
import infringementRoutes from './routes/infringement';
import bluvfiTesterRoutes from './routes/bluvfiTesters';
import { networkInfo } from './utils/config';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use('/api/register', registerRoutes);
app.use('/api/yakoa', yakoaRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/infringement', infringementRoutes);
app.use('/api/bluvfi-testers', bluvfiTesterRoutes);

// Default route (optional)
app.get('/', (_req, res) => {
  res.send('✅ Yakoa + BNB Chain backend is running!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
  try {
    const host = new URL(networkInfo.rpcProviderUrl).hostname;
    console.log(`📡 RPC: ${host} (chain ${networkInfo.chain.id})`);
  } catch {
    console.log(`📡 RPC: ${networkInfo.rpcProviderUrl?.slice(0, 40)}... (chain ${networkInfo.chain.id})`);
  }
});
