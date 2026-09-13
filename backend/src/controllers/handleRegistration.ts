// src/controllers/handleRegistration.ts
import { Request, Response } from 'express';

export const handleRegistration = async (req: Request, res: Response) => {
  try {
    // your Story + Yakoa logic here
    return res.status(200).json({ message: 'Registered successfully!' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};
