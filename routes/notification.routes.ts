import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import { setNotification } from '../controllers/notification.controller';

const router = express.Router();

// Route to set a notification
router.post('/set-notification', auth, setNotification);

// Route to retrieve notifications
router.get('/get-notifications/:userId', auth);

// Route to mark a notification as read
router.put('/mark-read/:notificationId', auth);

export default router;
