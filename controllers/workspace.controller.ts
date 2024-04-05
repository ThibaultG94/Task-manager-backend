import workspaceModel from '../models/workspace.model';
import express from 'express';
import userModel from '../models/user.model';
import taskModel from '../models/task.model';
import mongoose from 'mongoose';
import workspaceInvitationModel from '../models/workspaceInvitation.model';
import notificationModel from '../models/notification.model';

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
			.find({
				$or: [{ userId }, { 'members.userId': userId }],
			})
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
export const editWorkspace = async (req: express.Request, res: express.Response) => {
    try {
        const updates = req.body;
        const workspace = await workspaceModel.findById(req.params.id);

        if (!workspace) {
            return res.status(400).json({ message: 'This workspace does not exist' });
        }

        if (req.user._id !== workspace.userId && !workspace.members.some(member => member.userId === req.user._id)) {
            const isSuperAdmin = workspace.members.some(member => member.userId === req.user._id && member.role === 'superadmin');
            if (!isSuperAdmin) {
                return res.status(403).json({
                    message: 'You do not have sufficient rights to perform this action',
                });
            }
        }

        let bulkOperations = [];

        // Updates the fields of the workspace
        if (updates.title !== undefined) workspace.title = updates.title;
        if (updates.userId !== undefined) workspace.userId = updates.userId;
        if (updates.description !== undefined) workspace.description = updates.description;

        // Process new member invitations
        if (updates.members !== undefined) {
            const newMembers = updates.members.filter((member:any) => !workspace.members.some(existingMember => existingMember.userId === member.userId));
            
            for (const member of newMembers) {
                const guestUser = await userModel.findById(member.userId);
                if (!guestUser || member.userId === req.user._id || workspace.isDefault === "true") continue;

                let invitationExists = await workspaceInvitationModel.findOne({ senderId: req.user._id, guestId: member.userId, workspaceId: req.params.id });

                if (invitationExists && invitationExists.status === 'CANCELLED') {
                    bulkOperations.push({
                        updateOne: {
                            filter: { _id: invitationExists._id },
                            update: { status: 'REJECTED' }
                        }
                    });
                } else if (!invitationExists) {
                    const workspaceInvitation = new workspaceInvitationModel({
                        senderId: req.user._id,
                        guestId: member.userId,
                        role: member.role,
                        workspaceId: req.params.id,
                        status: 'PENDING',
                    });
                    await workspaceInvitation.save();
                }

                workspace.invitationStatus.push({ userId: member.userId, status: 'pending' });
            }
        }

        // Determine removed members
        const removedMembersIds = workspace.members.filter(existingMember => !updates.members.some((updateMember:any) => updateMember.userId === existingMember.userId)).map(member => member.userId);
        
        if (removedMembersIds.length > 0) {
            // Cancel invitations in workspace.invitationStatus
            workspace.invitationStatus = workspace.invitationStatus.filter(invitation => !removedMembersIds.includes(invitation.userId));
            // Prepare to delete invitations from workspaceInvitationModel
            removedMembersIds.forEach(userId => {
                bulkOperations.push({
                    deleteOne: {
                        filter: { workspaceId: req.params.id, guestId: userId }
                    }
                });
            });
        }

        // Execute all bulk operations if any
        if (bulkOperations.length > 0) {
            await workspaceInvitationModel.bulkWrite(bulkOperations);
        }

        // Update workspace members based on remaining ones
        workspace.members = updates.members.filter((member:any) => workspace.members.some(existingMember => existingMember.userId === member.userId));

        // Save the workspace with updated info
        const updatedWorkspace = await workspace.save();

        return res.status(200).json({
            message: 'Workspace updated successfully',
            workspace: updatedWorkspace,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};


// Endpoint to delete a workspace
export const deleteWorkspace = async (req: express.Request, res: express.Response) => {
    try {
        const workspaceId = req.params.id;
        const workspace = await workspaceModel.findById(workspaceId);
		const user = await userModel.findById(req.user._id);

        if (!workspace) {
            return res.status(400).json({ message: 'This workspace does not exist' });
        }

        if (req.user._id !== workspace.userId && !workspace.members.some(member => member.userId === req.user._id)) {
            const isSuperAdmin = workspace.members.some(member => member.userId === req.user._id && member.role === 'superadmin');
            if (!isSuperAdmin) {
                return res.status(403).json({ message: 'You do not have the right to modify this workspace' });
            }
        }

		await notificationModel.deleteMany({ workspaceId: workspace._id });

		const notification = new notificationModel({
			creatorId: req.user._id,
			type: 'workspaceDelation',
			message: `${user.username} a supprimé le workspace ${workspace.title}`,
			users: workspace.members.filter((member) => member.userId !== req.user._id).map((member) => member.userId),
		});
	
		await notification.save();


        // Here, we handle the cleanup of all associated workspace invitations before proceeding with workspace deletion
        await workspaceInvitationModel.deleteMany({ workspaceId: workspaceId });


        // Proceed with your existing logic for handling tasks and deleting the workspace
        let defaultWorkspace = await workspaceModel.findOne({ userId: req.user._id, isDefault: true });

        if (!defaultWorkspace) {
            return res.status(500).json({ message: 'No default workspace found' });
        }

        if (workspace._id.toString() === defaultWorkspace._id.toString()) {
            defaultWorkspace = new workspaceModel({
                title: 'Default Workspace',
                userId: req.user._id,
                isDefault: true,
            });
        }

        await taskModel.updateMany({ workspaceId: workspaceId, userId: req.user._id }, { workspaceId: defaultWorkspace._id });

        if (req.user._id === workspace.userId) {
            await workspace.deleteOne();
            return res.status(200).json('Workspace deleted ' + workspaceId);
        } else {
            workspace.members = workspace.members.filter(member => member.userId !== req.user._id);
            await workspace.save();
            return res.status(200).json('User removed from workspace ' + workspaceId);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
