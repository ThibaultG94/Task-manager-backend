import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 1000,
	message: 'Too many requests from this IP, please try again later.',
});

export const apiRegisterAndLoginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: process.env.NODE_ENV === 'development' ? 3000000 : 2000000,
	message: 'Too many requests from this IP, please try again later.',
});
