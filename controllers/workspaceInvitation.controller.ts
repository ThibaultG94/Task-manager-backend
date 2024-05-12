import express from 'express';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';
import workspaceInvitationModel from '../models/workspaceInvitation.model';
import notificationModel from '../models/notification.model';
import { fetchAndEnrichUserWorkspaces } from '../utils/workspaces.utils';
import { fetchAndProcessReceivedWorkspaceInvitations, fetchAndProcessWorkspaceInvitations } from '../utils/workspaceInvitations.utils';

// Endpoint to send an invitation
export const sendInvitationWorkspace = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const { senderId, guestId, role, workspaceId } = req.body;
		const userId = req.user._id;

		const sender = await userModel.findById(senderId);
		const guestUser = await userModel.findById(guestId);
		const workspace = await workspaceModel.findById(workspaceId);

		if (!sender) {
			return res.status(401).json({ message: 'User not authenticated' });
		}

		if (!guestUser) {
			return res.status(400).json({ message: 'User does not exist' });
		}

		if (guestId == senderId) {
			return res.status(400).json({
				message: 'You cannot send an invitation to yourself',
			});
		}

		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'Workspace does not exist' });
		}

		if (workspace.isDefault === "true") {
			return res.status(400).json({
				message:
					'You cannot send an invitation to the default workspace',
			});
		}

		// Search if there is already an invitation for this user in this workspace
		const invitationExists = await workspaceInvitationModel.findOne({
			senderId,
			guestId,
			workspaceId,
		});

		if (invitationExists && invitationExists.status === 'CANCELLED') {
			invitationExists.status = 'REJECTED';
			let invitationUpdated = false;
			workspace.invitationStatus.forEach((inv) => {
				if (
					inv.userId === invitationExists.guestId &&
					inv.status !== 'declined'
				) {
					inv.status = 'declined';
					invitationUpdated = true;
				}
			});

			if (invitationUpdated) {
				await invitationExists.save();
				await workspace.save();
				
				res.status(200).json({ message: 'Invitation declined' });
			} else {
				res.status(404).json({
					message: 'Invitation not found or already declined',
				});
			}
			return res.status(200).json({ message: 'Invitation send' });
		}

		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'Workspace does not exist' });
		}

		const workspaceInvitation = new workspaceInvitationModel({
			senderId,
			guestId,
			role,
			workspaceId,
			status: 'PENDING',
		});

		workspace.invitationStatus.push({
			userId: guestId,
			status: 'pending',
		});

		const notification = new notificationModel({
			creatorId: senderId,
			invitationId: workspaceInvitation._id,
			type: 'workspaceInvitation',
			message: `${sender.username} vous a envoyé une invitation a rejoindre le workspace ${workspace.title} en tant que ${role}`,
			userId: guestId,
			workspaceId: workspaceId,
		});

		await notification.save();
		await workspaceInvitation.save();
		await workspace.save();

		const workspaces = await fetchAndEnrichUserWorkspaces(userId);
        const workspaceInvitations = await fetchAndProcessWorkspaceInvitations(userId);

		return res.status(200).json({ workspaceInvitations, workspaces });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to retrieve sent invitations
export const getSentOutWorkspaceInvitations = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.id;
        const workspaceInvitations = await fetchAndProcessWorkspaceInvitations(userId);
        return res.status(200).json({ workspaceInvitations });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error });
    }
};

// Endpoint to retrieve received workspace invitations
export const getReceivedWorkspaceInvitations = async (
    req: express.Request, res: express.Response
) => {
    try {
        const userId = req.params.id;
        const workspaceInvitations = await fetchAndProcessReceivedWorkspaceInvitations(userId);
        return res.status(200).json({ workspaceInvitations });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

// Endpoint to accept an invitation
export const acceptWorkspaceInvitation = async (
    req: express.Request,
    res: express.Response
) => {
    try {
        const invitationId = req.params.invitationId;
        const invitation = await workspaceInvitationModel.findById(invitationId);
        const workspace = await workspaceModel.findById(invitation?.workspaceId);
        const userId = req.body.userId;

        if (!invitation || invitation.status === 'CANCELLED') {
            return res.status(400).json({
                message: 'Invitation does not exist or is not pending',
            });
        }

        if (!userId || userId !== invitation.guestId) {
            return res.status(403).json({
                message: 'You do not have sufficient rights to accept this invitation',
            });
        }

        if (!workspace) {
            return res.status(400).json({ message: 'Workspace does not exist' });
        }

        invitation.status = 'ACCEPTED';
        workspace.members.push({
            userId: invitation.guestId,
            role: invitation.role,
        });

        // Update workspace invitations status
        workspace.invitationStatus = workspace.invitationStatus.filter(
            workspaceInvitation => workspaceInvitation.userId !== invitation.guestId
        );

		const guestUser = await userModel.findById(invitation.guestId);

        // Send notification to the invitation sender
        const senderNotification = new notificationModel({
            creatorId: invitation.guestId,
            userId: invitation.senderId,
            type: 'workspaceInvitation',
            message: `${guestUser.username} a rejoint le workspace ${workspace.title} en tant que ${invitation.role}`,
            workspaceId: workspace._id,
        });

        await senderNotification.save();

        // Send notifications to other members
        const otherMembers = workspace.members.filter(
            member => member.userId !== invitation.guestId && member.userId !== invitation.senderId
        );

        for (const member of otherMembers) {
            const notification = new notificationModel({
                creatorId: invitation.guestId,
                userId: member.userId,
                type: 'workspaceUpdate',
                message: `${guestUser.username} a rejoint le workspace ${workspace.title} en tant que ${invitation.role}`,
                workspaceId: workspace._id,
            });

            await notification.save();
        }

        await invitation.save();
        await workspace.save();

		const workspaceInvitations = await fetchAndProcessReceivedWorkspaceInvitations(userId);
		const workspaces = await fetchAndEnrichUserWorkspaces(userId);

		return res.status(200).json({ workspaceInvitations, message: 'Workspace invitation accepted', workspaces });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error });
    }
};

// Endpoint to decline an invitation
export const declineWorkspaceInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const invitationId = req.params.invitationId;
		const invitation = await workspaceInvitationModel.findById(
			invitationId
		);
		const workspace = await workspaceModel.findById(
			invitation?.workspaceId
		);
		const userId = req.body.userId;

		if (!invitation || invitation.status !== 'PENDING') {
			return res.status(400).json({
				message: 'Invitation does not exist or is not pending',
			});
		}

		if (!userId || userId !== invitation.guestId) {
			return res.status(403).json({
				message:
					'You do not have sufficients rights to decline this invitation',
			});
		}

		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'Workspace does not exist' });
		}

		let invitationUpdated = false;
		workspace.invitationStatus.forEach((inv) => {
			if (
				inv.userId === invitation?.guestId &&
				inv.status !== 'declined'
			) {
				inv.status = 'declined';
				invitationUpdated = true;
			}
		});

		if (invitationUpdated) {
			await workspace.save();
			res.status(200).json({ message: 'Invitation declined' });
		} else {
			res.status(404).json({
				message: 'Invitation not found or already declined',
			});
		}

		invitation.status = 'REJECTED';
		await invitation.save();

		const workspaceInvitations = await fetchAndProcessReceivedWorkspaceInvitations(userId);

		return res.status(200).json({ workspaceInvitations, message: 'Invitation declined' });
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};

export const cancelWorkspaceInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.user._id;
		const invitationId = req.params.invitationId;
		const invitation = await workspaceInvitationModel.findById(
			invitationId
		);

		if (!invitation || invitation.status === 'ACCEPTED') {
			return res.status(400).json({
				message: 'Invitation does not exist or is already accepted',
			});
		}

		if (
			!req.user ||
			req.user._id.toString() !== invitation.senderId.toString()
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to cancel this invitation',
			});
		}

		const workspace = await workspaceModel.findById(invitation.workspaceId);
		if (!workspace) {
			return res.status(404).json({ message: 'Workspace not found' });
		}

		if (invitation.status === 'REJECTED') {
			invitation.status = 'CANCELLED';
			let invitationUpdated = false;
			workspace.invitationStatus.forEach((inv) => {
				if (
					inv.userId === invitation?.guestId &&
					inv.status !== 'cancelled'
				) {
					inv.status = 'cancelled';
					invitationUpdated = true;
				}
			});
			if (invitationUpdated) {
				await invitation.save();
				await workspace.save();
				return res
					.status(200)
					.json({ message: 'Invitation cancelled' });
			} else {
				return res.status(404).json({
					message: 'Invitation not found or already cancelled',
				});
			}
		}

		const index = workspace.invitationStatus.findIndex(
			(inv) => inv.userId === invitation.guestId
		);
		if (index !== -1) {
			workspace.invitationStatus.splice(index, 1);
			await workspace.save();
		}

		await invitation.deleteOne();

		// Find notifications related to this invitation
		const notifications = await notificationModel.find({
			invitationId: invitationId,
		});

		await Promise.all(
			notifications.map(async (notification) => {
				await notification.deleteOne();
			})
		);

		const workspaceInvitations = await fetchAndProcessWorkspaceInvitations(userId);
		const workspaces = await fetchAndEnrichUserWorkspaces(userId);

		return res.status(200).json({ message: 'Invitation cancelled and member removed from workspace', workspaceInvitations, workspaces });
	} catch (error) {
		return res
			.status(500)
			.json({ message: 'Internal server error', error });
	}
};
