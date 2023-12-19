import taskModel from '../models/task.model';
import userModel from '../models/user.model';
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

interface AssignedUser {
	email: string;
	userId: string;
	username: string;
}

export const validateAssignedUsers = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	try {
		if (req.body.assignedTo && Array.isArray(req.body.assignedTo)) {
			const userChecks = await Promise.all(
				req.body.assignedTo.map(async (assignedUser: AssignedUser) => {
					if (!assignedUser.userId) {
						return false;
					}
					const userExists = await userModel.findOne({
						_id: assignedUser.userId,
					});
					return userExists != null;
				})
			);

			if (userChecks.includes(false)) {
				return res
					.status(400)
					.json({ message: 'Assigned user not found' });
			}
		}

		next();
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};
