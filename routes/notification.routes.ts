import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import { setNotification } from '../controllers/notification.controller';

const router = express.Router();

// Route to set a notification
router.post('/set-notification', auth, setNotification);

export default router;
