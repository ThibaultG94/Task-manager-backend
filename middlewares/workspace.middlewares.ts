import express from 'express';
import workspaceModel from '../models/workspace.model';
import taskModel from '../models/task.model';
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
		return res.status(500).json({ message: 'Internal server error', error });
	}
};

export const updateLastUpdateTask = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	const taskId = req.params.id;
	const task = await taskModel.findById(taskId);
	const workspaceId = task.workspaceId;

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
		return res.status(500).json({ message: 'Internal server error', error });
	}
};
