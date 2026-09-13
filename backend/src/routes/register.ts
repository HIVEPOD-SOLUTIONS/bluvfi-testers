// src/routes/register.ts
import express from 'express';
import handleRegistration from '../controllers/registerController';
import { asyncHandler } from '../utils1/asyncHandler';

const router = express.Router();

router.post('/', asyncHandler(handleRegistration));

export default router;