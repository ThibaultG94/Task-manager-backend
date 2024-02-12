import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	acceptInvitation,
	cancelInvitation,
	declineInvitation,
	getReceivedInvitations,
	getSentOutInvitations,
	sendInvitation,
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

export default router;
