import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import { sendInvitationWorkspace } from '../controllers/workspaceInvitation.controller';

const router = express.Router();

// Route to send a workspace invitation
router.post('/send-invitation', auth, sendInvitationWorkspace);

export default router;
