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
