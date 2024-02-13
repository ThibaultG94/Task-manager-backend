import express from 'express';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';
import workspaceInvitationModel from '../models/workspaceInvitation.model';

// Endpoint to send an invitation
export const sendInvitationWorkspace = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const { senderId, guestId, role, workspaceId } = req.body;

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

		const workspaceInvitation = new workspaceInvitationModel({
			senderId,
			guestId,
			role,
			workspaceId,
			status: 'PENDING',
		});

		await workspaceInvitation.save();

		res.status(200).json({ workspaceInvitation: workspaceInvitation });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to retrieve sent invitations
export const getSentOutWorkspaceInvitations = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.id;
		const user = await userModel.findById(userId);

		if (!user) {
			return res.status(400).json({ message: 'User does not exist' });
		}

		const invitationsSentOut = await workspaceInvitationModel.find({
			senderId: userId,
		});

		const invitationsInformations = await Promise.all(
			invitationsSentOut.map(async (invitation) => {
				const guest = await userModel.findById(invitation.guestId);
				const workspace = await workspaceModel.findById(
					invitation.workspaceId
				);
				if (!guest || !workspace) {
					return res.status(400).json({
						message: 'Guest or workspace does not exist',
					});
				}
				return {
					invitationId: invitation._id,
					guestEmail: guest?.email,
					guestUsername: guest?.username,
					role: invitation.role,
					status: invitation.status,
					workspace,
				};
			})
		);

		const invitationsPending = invitationsInformations.filter(
			(invitation) =>
				invitation.status === 'PENDING' ||
				invitation.status === 'REJECTED'
		);
		const invitationsAccepted = invitationsInformations.filter(
			(invitation) => invitation.status === 'ACCEPTED'
		);

		const invitations = {
			pending: invitationsPending,
			accepted: invitationsAccepted,
		};

		return res.status(200).json({ workspaceInvitations: invitations });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to retrieve received workspace invitations
export const getReceivedWorkspaceInvitations = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.id;
		const user = await userModel.findById(userId);

		if (!user) {
			return res.status(400).json({ message: 'User does not exist' });
		}

		const invitationsReceived = await workspaceInvitationModel.find({
			guestId: userId,
		});

		const invitationsInformations = await Promise.all(
			invitationsReceived.map(async (invitation) => {
				const sender = await userModel.findById(invitation.senderId);
				const workspace = await workspaceModel.findById(
					invitation.workspaceId
				);
				if (!sender || !workspace) {
					return res.status(400).json({
						message: 'Guest or workspace does not exist',
					});
				}
				return {
					invitationId: invitation._id,
					senderEmail: sender?.email,
					senderUsername: sender?.username,
					role: invitation.role,
					status: invitation.status,
					workspace,
				};
			})
		);

		const invitationsPending = invitationsInformations.filter(
			(invitation) => invitation.status === 'PENDING'
		);
		const invitationsAccepted = invitationsInformations.filter(
			(invitation) => invitation.status === 'ACCEPTED'
		);

		const invitations = {
			pending: invitationsPending,
			accepted: invitationsAccepted,
		};

		return res.status(200).json({ invitations });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to accept an invitation
export const acceptWorkspaceInvitation = async (
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
					'You do not have sufficients rights to accept this invitation',
			});
		}

		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'Workspace does not exist' });
		}

		invitation.status = 'ACCEPTED';
		workspace.members.push({
			userId: invitation?.guestId,
			role: invitation?.role,
		});
		await invitation.save();
		await workspace.save();

		res.status(200).json({
			message: 'Workspace invitation accepted',
			invitation,
		});
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
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

		invitation.status = 'REJECTED';
		await invitation.save();

		res.status(200).json({ message: 'Invitation declined' });
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};

export const cancelWorkspaceInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const invitationId = req.params.invitationId;
		const invitation = await workspaceInvitationModel.findById(
			invitationId
		);

		if (!invitation || invitation.status === 'ACCEPTED') {
			return res.status(400).json({
				message: 'Invitation does not exist or is already accepted',
			});
		}

		if (!req.user || req.user._id !== invitation.senderId) {
			return res.status(403).json({
				message:
					'You do not have sufficients rights to cancel this invitation',
			});
		}

		await invitation.deleteOne();

		res.status(200).json({ message: 'Invitation cancelled' });
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};
