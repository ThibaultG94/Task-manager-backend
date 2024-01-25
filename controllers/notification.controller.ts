import express from 'express';
import client from '../utils/redisClient';
import notificationModel from '../models/notification.model';
import userModel from '../models/user.model';
import taskModel from '../models/task.model';
import workspaceModel from '../models/workspace.model';
import invitationModel from '../models/invitation.model';

// Endpoint to set a notification
export const setNotification = async (
	req: express.Request,
	res: express.Response
) => {
	const { creatorId, invitationId, taskId, workspaceId, type } = req.body;
	let message = '';
	let users = [];

	try {
		const creator = await userModel.findById(creatorId);
		if (!creator) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (type === 'invitationUpdate') {
			if (!invitationId) {
				return res.status(400).json({
					message:
						"Invitation ID is required or notification's type is wrong",
				});
			}
			const invitation = await invitationModel.findById(invitationId);
			if (!invitation) {
				return res
					.status(404)
					.json({ message: 'Invitation not found' });
			}
			if (creatorId !== invitation.senderId) {
				users.push(invitation.senderId);
				message = `${creator.username} a accepté votre invitation`;
			} else if (creatorId !== invitation.guestId) {
				users.push(invitation.guestId);
				message = `${creator.username} vous a envoyé une invitation`;
			} else {
				return res.status(400).json({ message: 'Invalid invitation' });
			}

			const notification = new notificationModel({
				creatorId,
				invitationId,
				type,
				message,
				users,
			});

			await notification.save();

			return res.status(200).json({ notification: notification });
		} else if (type === 'taskUpdate') {
			if (!taskId) {
				return res.status(400).json({
					message:
						"Task ID is required or notification's type is wrong",
				});
			}

			const task = await taskModel.findById(taskId);
			if (!task) {
				return res.status(404).json({ message: 'Task not found' });
			}
			users.push(
				task.assignedTo.map((user) => {
					if (creatorId !== user.userId) return user.userId;
				})
			);

			const notification = new notificationModel({
				creatorId,
				taskId,
				type,
				message,
				users,
			});

			await notification.save();

			return res.status(200).json({ notification: notification });
		} else if (type === 'workspaceUpdate') {
			if (!workspaceId) {
				return res.status(400).json({
					message:
						"Workspace ID is required or notification's type is wrong",
				});
			}

			const workspace = await workspaceModel.findById(workspaceId);
			if (!workspace) {
				return res.status(404).json({ message: 'Workspace not found' });
			}

			users.push(
				workspace.members.map((member) => {
					if (creatorId !== member.userId) return member.userId;
				})
			);

			const notification = new notificationModel({
				creatorId,
				workspaceId,
				type,
				message,
				users,
			});

			await notification.save();

			return res.status(200).json({ notification: notification });
		}
	} catch (error) {
		res.status(500).json({ message: 'Internal server error', error });
	}
};
// Endpoint to retrieve all notifications for a specific user with pagination
export const getAllNotifications = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const page = parseInt(req.query.page as string, 10) || 1;
		const limit = parseInt(req.query.limit as string, 10) || 10;
		const skip = (page - 1) * limit;
		const userId = req.params.userId;
		const key = `notifications:${userId}:${page}:${limit}`;

		let cachedNotifications: string | null = null;
		try {
			cachedNotifications = await client.get(key);
		} catch (err) {
			console.error('Cache retrieval error:', err);
		}

		let notifications: any;
		let totalNotifications = 0;

		if (cachedNotifications) {
			notifications = JSON.parse(cachedNotifications);
		} else {
			// Récupérer le nombre total de notifications
			totalNotifications = await notificationModel.countDocuments({
				users: { $in: [userId] },
			});

			// Récupérer les notifications avec une limite et un saut
			notifications = await notificationModel
				.find({ users: { $in: [userId] } })
				.skip(skip)
				.limit(limit)
				.lean();

			const creatorIds = [
				...new Set(notifications.map((n: any) => n.creatorId)),
			];
			const users = await userModel.find({ _id: { $in: creatorIds } });
			const usernameMap: any = users.reduce(
				(acc, user) => ({
					...acc,
					[user._id.toString()]: user.username,
				}),
				{}
			);

			const mapNotifications: any = (notifications: any) =>
				notifications.map((n: any) => ({
					...n,
					creatorUsername: usernameMap[n.creatorId],
				}));

			try {
				await client.setEx(
					key,
					10800,
					JSON.stringify(mapNotifications)
				);
			} catch (err) {
				console.error('Notifications caching error:', err);
			}
		}

		return res.status(200).json({ notifications, totalNotifications });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error', error });
	}
};

// Endpoint to retrieve notifications for a specific user
export const getNotifications = async (
	req: express.Request,
	res: express.Response
) => {
	const { userId } = req.params;
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const oneWeekAgo = new Date(
		Date.now() - 7 * 24 * 60 * 60 * 1000
	).toISOString();
	const oneMonthAgo = new Date(
		Date.now() - 30 * 24 * 60 * 60 * 1000
	).toISOString();

	try {
		// New notifications: not read, seen less than a week ago, or read less than 24 hours ago
		const newNotifications = await notificationModel
			.find({
				users: { $in: [userId] },
				$or: [
					{ read: false },
					{ read: true, viewedAt: { $gt: oneDayAgo } },
				],
			})
			.lean();

		// Older notifications: read between 24 hours and a week, or not read but seen between a week and a month
		const earlierNotifications = await notificationModel
			.find({
				users: { $in: [userId] },
				$or: [
					{
						read: true,
						viewedAt: { $gte: oneWeekAgo, $lte: oneDayAgo },
					},
					{
						read: false,
						viewedAt: { $gte: oneMonthAgo, $lt: oneWeekAgo },
					},
				],
			})
			.lean();

		const creatorIds = [
			...new Set(
				[...newNotifications, ...earlierNotifications].map(
					(n) => n.creatorId
				)
			),
		];

		const users = await userModel.find({ _id: { $in: creatorIds } });
		const usernameMap: any = users.reduce(
			(acc, user) => ({ ...acc, [user._id.toString()]: user.username }),
			{}
		);

		const mapNotifications: any = (notifications: any) =>
			notifications.map((n: any) => ({
				...n,
				creatorUsername: usernameMap[n.creatorId],
			}));

		return res.status(200).json({
			newNotifications: mapNotifications(newNotifications),
			earlierNotifications: mapNotifications(earlierNotifications),
		});
	} catch (error) {
		res.status(500).json({ message: 'Internal server error', error });
	}
};

// Endpoint to mark notifications as viewed
export const markNotificationsAsViewed = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const { userId } = req.params;
		const { notificationsIds } = req.body;

		const user = userModel.findById(userId);

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (!notificationsIds) {
			return res
				.status(400)
				.json({ message: 'Notifications IDs are required' });
		}

		await notificationModel.updateMany(
			{
				_id: { $in: notificationsIds },
				users: { $in: [userId] },
			},
			{ viewedAt: new Date().toISOString() }
		);

		return res.status(200).json({ message: 'Notifications updated' });
	} catch (error) {
		console.log(error);
		return res
			.status(500)
			.json({ message: 'Internal server error', error });
	}
};

// Endpoint to mark a notification as read
export const markNotificationAsRead = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const { notificationId } = req.params;
		const { userId } = req.body;

		if (!notificationId) {
			return res
				.status(400)
				.json({ message: 'Notification ID is required' });
		}

		if (!userId) {
			return res.status(400).json({ message: 'User ID is required' });
		}

		const notification = await notificationModel.findById(notificationId);

		if (!notification) {
			return res.status(404).json({ message: 'Notification not found' });
		}

		if (!notification.users.includes(userId)) {
			return res.status(403).json({
				message: 'User is not allowed to access this notification',
			});
		}

		await notificationModel.findByIdAndUpdate(notificationId, {
			read: true,
		});

		return res.status(200).json({ message: 'Notification updated' });
	} catch (error) {
		console.log(error);
		return res
			.status(500)
			.json({ message: 'Internal server error', error });
	}
};
