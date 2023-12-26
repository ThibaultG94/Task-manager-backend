import tipsModel from '../models/tips.model';
import express from 'express';
import userModel from '../models/user.model';
import logger from '../config/logger';

export const createTip = async (
	req: express.Request,
	res: express.Response
) => {
	const userId = req.params.superadminId;
	const isUserIsSuperAdmin = await userModel.findById({
		_id: userId,
		role: 'superadmin',
	});

	try {
		if (!isUserIsSuperAdmin) {
			return res.status(401).json({ message: 'Unauthorized' });
		} else {
			const tip = req.body;
			const newTip = await tipsModel.create(tip);
			return newTip;
		}
	} catch (error) {
		const result = (error as Error).message;
		const request = req.body;
		logger.info(result);

		return res
			.status(500)
			.json({ message: 'Internal server error', result, request, error });
	}
};

export const getTips = async (req: express.Request, res: express.Response) => {
	const tips = await tipsModel.find({ active: true });
	res.status(200).json(tips);
};
