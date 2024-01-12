import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	acceptInvitation,
	acceptWorkspaceInvitation,
	cancelInvitation,
	declineInvitation,
	getReceivedInvitations,
	getSentOutInvitations,
	listUserInvitations,
	rejectWorkspaceInvitation,
	sendInvitation,
	sendWorkspaceInvitation,
} from '../controllers/invitation.controller';
import { validateInvitationId } from '../middlewares/validation.middlewares';

const router = express.Router();

// Route to send an invitation
router.post('/send-invitation', auth, sendInvitation);

// Route to retrieve sent invitations
router.get('/sentout-invitations/:id', auth, getSentOutInvitations);

// Route to retrieve received invitations
router.get('/received-invitations/:id', auth, getReceivedInvitations);

// Route to accept an invitation
router.put(
	'/:invitationId/accept',
	auth,
	validateInvitationId,
	acceptInvitation
);

// Route to decline an invitation
router.put(
	'/:invitationId/decline',
	auth,
	validateInvitationId,
	declineInvitation
);

// Route to cancel an invitation
router.delete(
	'/:invitationId/cancel',
	auth,
	validateInvitationId,
	cancelInvitation
);

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
