import jwt from 'jsonwebtoken';
import express from 'express';
import { UserPayload } from '../types/types';

// Middleware for checking if a user is authenticated
export const auth = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	let token;

	token = req.cookies.token;

	// If no token is provided, return an error
	if (!token) {
		return res
			.status(401)
			.json({ message: 'Access denied. No token provided.' });
	}

	try {
		// Verify the token using the secret key
		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET as string
		) as UserPayload;

		// Assign the decoded payload to req.user, available for subsequent middleware or route handlers
		req.user = decoded;

		// Proceed to the next middleware or route handler
		next();
	} catch (err) {
		// If the token is invalid or expired, return an error
		if (err instanceof jwt.TokenExpiredError) {
			return res.status(401).json({ message: 'Token expired.' });
		} else {
			const result = (err as Error).message;
			res.status(401).json({ message: 'Invalid token.' });
		}
	}
};
