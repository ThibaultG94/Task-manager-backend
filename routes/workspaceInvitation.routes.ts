import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	getReceivedWorkspaceInvitations,
	getSentOutWorkspaceInvitations,
	sendInvitationWorkspace,
} from '../controllers/workspaceInvitation.controller';

const router = express.Router();

// Route to send a workspace invitation
router.post('/send-invitation', auth, sendInvitationWorkspace);

// Route to retrieve sent workspaces invitations
router.get('/sentout-invitations/:id', auth, getSentOutWorkspaceInvitations);

// Route to retrieve received invitations
router.get('/received-invitations/:id', auth, getReceivedWorkspaceInvitations);

export default router;
