import express from 'express';
import invitationModel from '../models/invitation.model';
import userModel from '../models/user.model';
import notificationModel from '../models/notification.model';
import { fetchAndCategorizeReceivedInvitations, fetchAndCategorizeSentInvitations } from '../utils/invitations.utils';
import Conversation from '../models/conversation.model';

// Endpoint to send an invitation
export const sendInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.user._id;
		const { senderId, guestEmail, message } = req.body;

		const sender = await userModel.findById(senderId);
		const guestUser = await userModel.findOne({ email: guestEmail });
		const isInvitationAlreadySent = await invitationModel.findOne({
			senderId: senderId,
			guestId: guestUser?._id,
		});
		const isInvitationAlreadyReceived = await invitationModel.findOne({
			senderId: guestUser?._id,
			guestId: senderId,
		});

		if (!sender) {
			return res.status(401).json({ message: 'User not authenticated' });
		}

		if (!guestUser) {
			return res.status(400).json({ message: 'User does not exist' });
		}

		if (guestUser?._id == senderId) {
			return res.status(400).json({
				message: 'You cannot send an invitation to yourself',
			});
		}

		if (isInvitationAlreadySent) {
			return res.status(400).json({
				message: 'Invitation already sent to this user',
			});
		}

		if (isInvitationAlreadyReceived) {
			return res.status(400).json({
				message: 'Invitation already received from this user',
			});
		}

		if (sender.role !== "visitor" && guestUser.role !== "visitor") {
			const invitation = new invitationModel({
				senderId: req.user._id,
				guestId: guestUser._id,
				message,
			});

			await invitation.save();

			const notification = new notificationModel({
				creatorId: senderId,
				invitationId: invitation._id,
				userId: guestUser._id,
				type: 'invitationUpdate',
				message: `${sender?.username} vous a envoyé une invitation`,
			});

			await notification.save();
		} else {
			const invitation = new invitationModel({
				senderId: req.user._id,
				guestId: guestUser._id,
				message,
				visitorInvitation: true,
			});

			await invitation.save();

			const notification = new notificationModel({
				creatorId: senderId,
				invitationId: invitation._id,
				userId: guestUser._id,
				type: 'invitationUpdate',
				message: `${sender?.username} vous a envoyé une invitation`,
				visitorNotification: true,
			});

			await notification.save();

			if (guestUser.email === "thibault.guilhem@gmail.com") {
				invitation.status = 'ACCEPTED';
				sender?.contacts.push(guestUser?._id);
				await invitation.save();
				await sender?.save();

				const notification = new notificationModel({
					creatorId: invitation.guestId,
					invitationId: invitation._id,
					userId: invitation.senderId,
					type: 'invitationUpdate',
					message: `${guestUser?.username} a accepté votre invitation`,
					visitorNotification: true,
				});

				await notification.save();

				const users = [invitation.senderId, invitation.guestId];
				const newConversation = new Conversation({ users, messages: [], visitorConversation: true});
				await newConversation.save();
			}
		}

        const invitations = await fetchAndCategorizeSentInvitations(userId);

		return res.status(200).json({ invitations });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to retrieve sent invitations
export const getSentOutInvitations = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.id;

        const invitations = await fetchAndCategorizeSentInvitations(userId);

		return res.status(200).json({ invitations });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to retrieve received invitations
export const getReceivedInvitations = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.id;

		const invitations = await fetchAndCategorizeReceivedInvitations(userId);

		return res.status(200).json({ invitations });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to accept an invitation
export const acceptInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const invitationId = req.params.invitationId;
		const invitation = await invitationModel.findById(invitationId);
		const userOne = await userModel.findById(invitation?.guestId);
		const userTwo = await userModel.findById(invitation?.senderId);
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

		invitation.status = 'ACCEPTED';
		userOne?.contacts.push(userTwo?._id);
		userTwo?.contacts.push(userOne?._id);
		await invitation.save();
		await userOne?.save();
		await userTwo?.save();

		const notification = new notificationModel({
			creatorId: invitation.guestId,
			invitationId: invitation._id,
			userId: invitation.senderId,
			type: 'invitationUpdate',
			message: `${userOne?.username} a accepté votre invitation`,
		});

		await notification.save();

		const users = [userOne?._id, userTwo?._id];
		const newConversation = new Conversation({ users, messages: [] });
		await newConversation.save();

		const invitations = await fetchAndCategorizeReceivedInvitations(userId);

		const contactsPromises = userOne.contacts.map((contactId) =>
			userModel.findById(contactId).then((userContact) => ({
				id: userContact?._id,
				username: userContact?.username,
				email: userContact?.email,
			}))
		);

		const userContacts = await Promise.all(contactsPromises);

		return res.status(200).json({ invitations, userContacts });
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to decline an invitation
export const declineInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const invitationId = req.params.invitationId;
		const invitation = await invitationModel.findById(invitationId);
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

		const invitations = await fetchAndCategorizeReceivedInvitations(userId);

		return res.status(200).json({ invitations, message: 'Invitation declined' });
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};

export const cancelInvitation = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const invitationId = req.params.invitationId;
		const invitation = await invitationModel.findById(invitationId);
		const userId = req.user._id;

		if (!invitation || invitation.status === 'ACCEPTED') {
			return res.status(400).json({
				message: 'Invitation does not exist or is already accepted',
			});
		}

		if (!req.user || userId !== invitation.senderId) {
			return res.status(403).json({
				message:
					'You do not have sufficients rights to cancel this invitation',
			});
		}

		// Find notification and delete it
		const notification = await notificationModel.findOne({
			invitationId: invitationId,
		});

		if (notification) {
			await notification.deleteOne();
		}

		await invitation.deleteOne();

		const invitations = await fetchAndCategorizeSentInvitations(userId);

		return res.status(200).json({ invitations, message: 'Invitation cancelled' });
	} catch (error) {
		return res.status(500).json({ message: 'Internal server error' });
	}
};
