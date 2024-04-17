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

		const isSuperAdmin = workspace.members.some(member => member.userId == req.user._id && member.role === 'superadmin');

		if (!isSuperAdmin) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action, you must be a superadmin'});
		}

        let bulkOperations = [];

		if (workspace.title !== updates.title || workspace.description !== updates.description) {
			// Retrieve the IDs of workspace members to be notified (all except the modification creator)
			const memberIdsToNotify = workspace.members
				.filter((member) => member.userId !== req.user._id)
				.map((member) => member.userId);
		
			// Create a notification for each member to be notified
			for (const userId of memberIdsToNotify) {
				const notification = new notificationModel({
					creatorId: req.user._id,
					userId: userId,  // Specify notification recipient ID
					type: 'workspaceUpdate',
					message: `Le workspace ${workspace.title} a été mis à jour`,
					workspaceId: workspace._id,
				});
		
				await notification.save();
			}
		}		

        // Updates the fields of the workspace
        if (updates.title !== undefined) workspace.title = updates.title;
        if (updates.userId !== undefined) workspace.userId = updates.userId;
        if (updates.description !== undefined) workspace.description = updates.description;

        // Process new member invitations
        if (updates.members !== undefined) {
            const newMembers: any = updates.members.filter((member:any) => !workspace.members.some(existingMember => existingMember.userId === member.userId));
            
            for (const member of newMembers) {
                const guestUser = await userModel.findById(member.userId);
				const senderUser = await userModel.findById(req.user._id);
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
					
					if (workspaceInvitation) {
						// Create a notification for workspace invitation
						const notification = new notificationModel({
							creatorId: req.user._id,
							type: 'workspaceInvitation',
							message: `${senderUser.username} vous a invité à rejoindre le workspace ${workspace.title}`,
							userId: member.userId,
							workspaceId: workspace._id,
						});
					
						await notification.save();
						await workspaceInvitation.save();
					}
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

			// Remove the user(s) from the workspace's notifications
			const workspaceNotifications = await notificationModel.find({ workspaceId: workspace._id });

			for (const notification of workspaceNotifications) {
				if (removedMembersIds.includes(notification.userId)) {
					await notification.deleteOne();
				}
			}

			for (const userId of removedMembersIds) {
				const notificationForRemovedMember = new notificationModel({
					creatorId: req.user._id,
					userId: userId,
					type: 'workspaceDeletion',
					message: `Vous avez été retiré du workspace ${workspace.title}`,
					workspaceId: workspace._id,
				});
			
				await notificationForRemovedMember.save();
			}			

			const removedMembersNames = await userModel.find({ _id: { $in: removedMembersIds } }).select('username');
			const userNames = removedMembersNames.map(user => user.username);
			let message;

			if (userNames.length === 1) {
				message = `Le membre ${userNames[0]} a été retiré du workspace ${workspace.title}`;
			} else {
				const formattedUserNames = userNames.slice(0, -1).join(', ') + ' et ' + userNames.slice(-1);
				message = `Les membres ${formattedUserNames} ont été retirés du workspace ${workspace.title}`;
			}

			const notificationRecipients = workspace.members
				.map(member => member.userId)
				.filter(userId => !removedMembersIds.includes(userId) && userId !== req.user._id);

			for (const userId of notificationRecipients) {
				const notificationWorkspaceMembers = new notificationModel({
					creatorId: req.user._id,
					userId: userId,
					type: 'workspaceUpdate',
					message: message,
					workspaceId: workspace._id,
				});

				await notificationWorkspaceMembers.save();
			}

			// Trouver toutes les tâches liées au workspace
			const tasks = await taskModel.find({ workspaceId: req.params.id });

			for (const task of tasks) {
				// Filter assignedTo to remove removed limbs
				task.assignedTo = task.assignedTo.filter((member: any) => !removedMembersIds.includes(member.userId));
		   
				// If assignedTo is empty after removal, add the ID of the member initiating the request
				if (task.assignedTo.length === 0) {
					const userAdmin = await userModel.findById(req.user._id);
					task.assignedTo.push({
						email: userAdmin.email,
						userId: (userAdmin._id).toString(),
						username: userAdmin.username,
					});
				}
		   
				await task.save();
			}
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
		
		const isSuperAdmin = workspace.members.some(member => member.userId == req.user._id && member.role === 'superadmin');
		
		if (!isSuperAdmin) {
			return res.status(403).json({
				message: 'You do not have sufficient rights to perform this action, you must be a superadmin'
			});
		}
		
		// Delete all workspace notifications
		await notificationModel.deleteMany({ workspaceId: workspace._id });
		
		// Create an individual notification for each workspace member
		const membersToNotify = workspace.members.filter(member => member.userId !== req.user._id);
		
		for (const member of membersToNotify) {
			const notification = new notificationModel({
				creatorId: req.user._id,
				userId: member.userId,  // Destinataire unique de la notification
				type: 'workspaceDeletion',
				message: `${user.username} a supprimé le workspace ${workspace.title}`,
				workspaceId: workspace._id,
			});
		
			await notification.save();
		}

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
