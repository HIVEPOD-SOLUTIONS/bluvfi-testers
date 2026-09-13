// story/backend/src/app.ts

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import registerRoutes from './routes/register';
import yakoaRoutes from './routes/yakoaRoutes';
import licenseRoutes from './routes/license';
import bluvfiTesterRoutes from './routes/bluvfiTesters';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use('/api/register', registerRoutes);
app.use('/api/yakoa', yakoaRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/bluvfi-testers', bluvfiTesterRoutes);

// Default route (optional)
app.get('/', (_req, res) => {
  res.send('✅ Yakoa + BNB Chain backend is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
});
