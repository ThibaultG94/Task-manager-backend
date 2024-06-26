import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import logger from '../config/logger';
import userModel from '../models/user.model';

export const validate = (schema: Schema, property: 'body' | 'params') => {
	return (req: Request, res: Response, next: NextFunction) => {
		const { error } = schema.validate(req[property]);
		const valid = error == null;

		if (valid) {
			next();
		} else {
			const { details } = error;
			const message = details.map((i) => i.message).join(',');

			logger.error('error', message);
			res.status(422).json({ error: message });
		}
	};
};

// Middleware to validate user ID
export const validateUserID = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		// Get user ID from request params
		const userId = req.params.id || req.user._id;
	
		// Check if user ID is a valid Mongo ObectID
		if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
			return res
				.status(400)
				.send({ error: 'Invalid user ID', userId: userId });
		} else {
			next();
		}
	} catch (error) {
		console.error(error);
		return res.status(500).send({ message: 'Internal server error', error });
	}
};

// Middleware to validate pagination parameters
export const validatePageAndLimit = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// Get page and limit from request query
	const { page, limit } = req.query;

	// Check if page number is a positive integer
	if (page && (!Number.isInteger(+page) || +page <= 0)) {
		return res.status(400).send({ error: 'Invalid page number' });
	}

	// Check if limit number is a positive integer
	if (limit && (!Number.isInteger(+limit) || +limit <= 0)) {
		return res.status(400).send({ error: 'Invalit limit number' });
	}

	next();
};

// Middleware to validate invitation ID
export const validateInvitationId = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const invitationId = req.params.invitationId;

	if (!invitationId) return res.status(400).json({ message: 'Invitation ID is required' });

	if (!/^[0-9a-fA-F]{24}$/.test(invitationId)) {
		console.error('Invalid ID:', invitationId);
		return res.status(400).send({ error: 'Invalid invitation ID' });
	} else {
		next();
	}
};

export const verifyUserExists = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user._id;
	if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const user = await userModel.findById(userId);
    if (!user) {
        return res.status(400).json({ message: 'User does not exist' });
    }
    next();
};
