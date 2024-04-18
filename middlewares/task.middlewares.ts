import taskModel from '../models/task.model';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';
import express from 'express';
import { Task } from '../types/types';

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
            // Map over each userID in the assignedTo array and check for existence
            const userChecks = await Promise.all(
                req.body.assignedTo.map(async (userId: string) => {
                    if (!userId) {
                        return false; // Ensure the userId is not empty
                    }
                    const userExists = await userModel.findOne({
                        _id: userId
                    });
                    return userExists != null; // Check if the user exists
                })
            );

            // If any of the checks failed (include false), return an error
            if (userChecks.includes(false)) {
                return res
                    .status(400)
                    .json({ message: 'One or more assigned users not found' });
            }
        }

        next(); // Proceed if all user IDs are valid
    } catch (error) {
        return res.status(500).json({ message: 'Error validating assigned users' });
    }
};

export const checkWorkspacePermission = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	try {
		// Find the task by ID
		const task = (await taskModel.findById(req.params.id)) as Task;
		const workspaceId = task.workspaceId;
		const workspace = await workspaceModel.findById(workspaceId);

		if (!workspace) {
			return res.status(404).json({ message: 'Workspace not found' });
		}

		const isOwner = req.user._id === workspace.userId;
		const isSuperAdmin = workspace.members.some(
			(member) =>
				member.userId === req.user._id && member.role === 'superadmin'
		);

		if (!isOwner && !isSuperAdmin) {
			return res.status(403).json({
				message: 'Insufficient permissions to access this workspace',
			});
		}

		next();
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};
