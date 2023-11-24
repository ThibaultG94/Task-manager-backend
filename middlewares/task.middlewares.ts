import taskModel from '../models/task.model';
import workspaceModel from '../models/workspace.model';
import express from 'express';

// Middleware to update the workspace's updatedAt when a task is modified
export const updateWorkspaceTimestamp = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	const taskId = req.params.id || req.body.taskId;
	let workspaceId = req.body.workspaceId;

	try {
		if (!workspaceId) {
			// Si workspaceId n'est pas dans le body, le récupérer depuis la tâche
			const task = await taskModel.findById(taskId);
			if (task) {
				workspaceId = task.workspaceId;
			}
		}

		if (workspaceId) {
			await workspaceModel.findByIdAndUpdate(
				workspaceId,
				{ $set: { lastUpdateDate: new Date() } },
				{ new: true, runValidators: true, context: 'query' }
			);
		}

		next();
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};
