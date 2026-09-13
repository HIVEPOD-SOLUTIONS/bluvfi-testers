// src/routes/license.ts
import express from 'express';
import handleLicenseMinting from '../controllers/licenseController';
import { asyncHandler } from '../utils1/asyncHandler';

const router = express.Router();

router.post('/mint', asyncHandler(handleLicenseMinting));

export default router; 