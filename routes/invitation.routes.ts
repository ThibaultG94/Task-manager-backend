import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	acceptWorkspaceInvitation,
	listUserInvitations,
	rejectWorkspaceInvitation,
	sendInvitation,
	sendWorkspaceInvitation,
} from '../controllers/invitation.controller';
import { validateInvitationId } from '../middlewares/validation.middlewares';

const router = express.Router();

// Route to send an invitation
router.post('/send-invitation', auth, sendInvitation);

// Route to send an invitation
router.post('/send-workspace-invitation', auth, sendWorkspaceInvitation);

// Route to accept a workspace invitation
router.post('/:id/accept', auth, acceptWorkspaceInvitation);

// Route to reject a workspace invitation
router.put(
	'/:invitationId/reject',
	auth,
	validateInvitationId,
	rejectWorkspaceInvitation
);

// Route to get the list of the user's invitations
router.get('/list', auth, listUserInvitations);

export default router;
