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

// Endpoint to retrieve received invitations
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

		// Transformer les invitations en utilisant Promise.all
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

		// Filtrer les invitations
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
