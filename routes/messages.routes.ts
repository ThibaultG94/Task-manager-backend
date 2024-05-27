import { Router } from 'express';
import { createMessage, getMessages, readMessage } from '../controllers/messages.controller';

const router = Router();

router.post('/', createMessage);
router.get('/', getMessages);
router.put('/:messageId', readMessage);

export default router;
