import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	acceptWorkspaceInvitation,
	cancelWorkspaceInvitation,
	declineWorkspaceInvitation,
	getReceivedWorkspaceInvitations,
	getSentOutWorkspaceInvitations,
	sendInvitationWorkspace,
} from '../controllers/workspaceInvitation.controller';
import { validateInvitationId } from '../middlewares/validation.middlewares';

const router = express.Router();

// Route to send a workspace invitation
router.post('/send-invitation', auth, sendInvitationWorkspace);

// Route to retrieve sent workspaces invitations
router.get('/sentout-invitations/:id', auth, getSentOutWorkspaceInvitations);

// Route to retrieve received workspace invitations
router.get('/received-invitations/:id', auth, getReceivedWorkspaceInvitations);

// Route to accept a workspace invitation
router.put(
	'/:invitationId/accept',
	auth,
	validateInvitationId,
	acceptWorkspaceInvitation
);

// Route to decline a workspace invitation
router.put(
	'/:invitationId/decline',
	auth,
	validateInvitationId,
	declineWorkspaceInvitation
);

// Route to cancel an invitation
router.delete(
	'/:invitationId/cancel',
	auth,
	validateInvitationId,
	cancelWorkspaceInvitation
);

export default router;
