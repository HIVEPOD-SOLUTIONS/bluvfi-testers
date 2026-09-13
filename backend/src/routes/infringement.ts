import express from 'express';
import { handleInfringementStatus, handleInfringementStatusByContract } from '../controllers/infringementController';

const router = express.Router();

// Get infringement status by Yakoa ID
router.get('/status/:id', handleInfringementStatus);

// Get infringement status by contract address and token ID
router.get('/status/:contractAddress/:tokenId', handleInfringementStatusByContract);

export default router; 