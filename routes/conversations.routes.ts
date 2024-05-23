import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
  createConversation,
  getConversations,
  getConversationById,
  addMessageToConversation,
} from '../controllers/conversations.controller';

const router = express.Router();

router.post('/', auth, createConversation);
router.get('/', auth, getConversations);
router.get('/:id', auth, getConversationById);
router.post('/:id/message', auth, addMessageToConversation);

export default router;
