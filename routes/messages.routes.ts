import { Router } from 'express';
import { createMessage, getMessages, readMessage } from '../controllers/messages.controller';
import { auth } from '../middlewares/auth.middlewares';

const router = Router();

router.post('/', auth, createMessage);
router.get('/', auth, getMessages);
router.put('/:messageId', auth, readMessage);

export default router;
