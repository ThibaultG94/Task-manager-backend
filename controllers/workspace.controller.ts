import workspaceModel from '../models/workspace.model';
import express from 'express';
import userModel from '../models/user.model';
import taskModel from '../models/task.model';
import mongoose from 'mongoose';

interface UserInfo {
	username: string;
	email: string;
}

// Endpoint to get a workspace by id
export const getWorkspace = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const workspace: any = await workspaceModel
			.findById(req.params.id)
			.lean();

		if (!req.user) {
			return res.status(401).json({ message: 'User not authenticated' });
		}

		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'This workspace does not exist' });
		}

		if (
			req.user._id !== workspace.userId &&
			!workspace.members.some(
				(member: any) => member.userId === req.user._id
			)
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		const memberIds = workspace.members.map((member: any) => member.userId);
		const users = await userModel.find({ _id: { $in: memberIds } });
		const memberInfo = users.map((user) => ({
			userId: user._id,
			username: user.username,
			email: user.email,
			role:
				workspace.members.find(
					(member: any) =>
						member.userId.toString() === user._id.toString()
				)?.role || 'member',
		}));

		workspace.members = memberInfo;

		res.status(200).json(workspace);
	} catch (err) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to get workspaces of a specific user
export const getUserWorkspaces = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.id;

		if (req.user._id.toString() !== userId) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		let workspaces = await workspaceModel
			.find({ userId })
			.sort({ lastUpdateDate: -1 })
			.lean();

		const memberIds = [
			...new Set(
				workspaces.flatMap((workspace) =>
					workspace.members.map((member) => member.userId.toString())
				)
			),
		];
		const users = await userModel
			.find({
				_id: {
					$in: memberIds.map((id) => new mongoose.Types.ObjectId(id)),
				},
			})
			.lean();

		const usersMap = users.reduce<{ [key: string]: UserInfo }>(
			(acc, user) => {
				acc[user._id.toString()] = {
					username: user.username,
					email: user.email,
				};
				return acc;
			},
			{}
		);

		workspaces = workspaces.map((workspace) => {
			const enrichedMembers = workspace.members.map((member) => {
				const userInfo = usersMap[member.userId.toString()];
				return {
					userId: member.userId,
					role: member.role,
					username: userInfo?.username,
					email: userInfo?.email,
				};
			});
			return { ...workspace, members: enrichedMembers };
		});

		res.status(200).json(workspaces);
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to create a new Workpace
export const createWorkspace = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		if (!req.body.title) {
			return res.status(400).json({ message: 'Please add a title' });
		}

		const userId = req.body.userId;

		const userExists = await userModel.exists({ _id: userId });

		if (!userExists) {
			return res
				.status(404)
				.json({ message: 'The specified user does not exist' });
		}

		const workspace = await workspaceModel.create({
			title: req.body.title,
			userId: req.body.userId,
			description: req.body.description,
			members: req.body.members,
		});

		res.status(200).json({ workspace: workspace });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to edit a workspace
export const editWorkspace = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	try {
		const updates = req.body;
		const workspace = await workspaceModel.findById(req.params.id);

		// Check if the workspace exists
		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'This workspace does not exist' });
		}

		// Check if the user making the request is the owner of the workspace
		if (
			req.user._id !== workspace.userId &&
			!workspace.members.some((member) => member.userId === req.user._id)
		) {
			const isSuperAdmin = workspace.members.some(
				(member) =>
					member.userId === req.user._id &&
					member.role === 'superadmin'
			);
			if (!isSuperAdmin) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to perform this action',
				});
			}
		}

		// Updates the fields of the workspace
		if (updates.title !== undefined) {
			workspace.title = updates.title;
		}
		if (updates.userId !== undefined) {
			workspace.userId = updates.userId;
		}
		if (updates.description !== undefined) {
			workspace.description = updates.description;
		}
		if (updates.members !== undefined) {
			workspace.members = updates.members;
		}

		const updatedWorkspace = await workspace.save();

		res.status(200).json({
			message: 'Workspace updated',
			workspace: updatedWorkspace,
		});

		next();
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to delete a workspace
export const deleteWorkspace = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Attempt to find the workspace by the provided id
		const workspace = await workspaceModel.findById(req.params.id);

		// If no workspace is found, return a 400 status
		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'This workspace does not exist' });
		}

		// If a workspace is found, check if the user making the request is a member of the workspace
		if (
			req.user._id !== workspace.userId &&
			!workspace.members.some((member) => member.userId === req.user._id)
		) {
			const isSuperAdmin = workspace.members.some(
				(member) =>
					member.userId === req.user._id &&
					member.role === 'superadmin'
			);

			if (!isSuperAdmin) {
				return res.status(403).json({
					message:
						'You do not have the right to modify this workspace',
				});
			}
		}

		// If the workspace is found and the user has sufficients rights, handle the tasks
		if (workspace) {
			// First, find the default workspace of the user
			let defaultWorkspace = await workspaceModel.findOne({
				userId: req.user._id,
				isDefault: true,
			});

			if (!defaultWorkspace) {
				return res
					.status(500)
					.json({ message: 'No default workspace found' });
			}

			// If the workspace being deleted is the default workspace, create a new default workspace
			if (workspace._id.toString() === defaultWorkspace._id.toString()) {
				defaultWorkspace = new workspaceModel({
					title: 'Default Workspace',
					userId: req.user._id,
					isDefault: true,
				});
			}

			// Update the workspaceId of all tasks created by the user in the workspace being deleted
			await taskModel.updateMany(
				{
					workspaceId: req.params.id,
					userId: req.user._id,
				},
				{ workspaceId: defaultWorkspace._id }
			);

			// If the user is the one who created the workspace, delete the workspace
			if (req.user._id === workspace.userId) {
				await workspace.deleteOne();
				res.status(200).json('Workspace deleted ' + req.params.id);
			} else {
				// If the user is a member but not the creator, just remove the user from the workspace
				workspace.members = workspace.members.filter(
					(member) => member.userId !== req.user._id
				);
				await workspace.save();
				res.status(200).json(
					'User removed from workspace ' + req.params.id
				);
			}

			await workspace.deleteOne();
			res.json('Workspace deleted ' + req.params.id);
		}
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};
