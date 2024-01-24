import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	getNotifications,
	markNotificationAsRead,
	markNotificationsAsViewed,
	setNotification,
} from '../controllers/notification.controller';

const router = express.Router();

// Route to set a notification
router.post('/set-notification', auth, setNotification);

// Route to retrieve notifications
router.get('/get-notifications/:userId', auth, getNotifications);

// Route to mark notifications as viewed
router.put('/mark-viewed/:userId', auth, markNotificationsAsViewed);

// Route to mark a notification as read
router.put('/mark-read/:notificationId', auth, markNotificationAsRead);

export default router;
