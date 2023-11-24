import express from 'express';
import workspaceModel from '../models/workspace.model';
// Middleware to update the lastUpdateDate of a workspace
export const updateLastUpdateDate = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	const workspaceId = req.params.id;

	try {
		await workspaceModel.findByIdAndUpdate(
			workspaceId,
			{
				$set: { lastUpdateDate: new Date() },
			},
			{ new: true, runValidators: true, context: 'query' }
		);
		next();
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};
