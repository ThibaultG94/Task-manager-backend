import express from 'express';
import notificationModel from '../models/notification.model';
import userModel from '../models/user.model';
import taskModel from '../models/task.model';
import workspaceModel from '../models/workspace.model';
import invitationModel from '../models/invitation.model';
import mongoose from 'mongoose';

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
				message = `${creator.username} (${creator.email}) a accepté votre invitation`;
			} else if (creatorId !== invitation.guestId) {
				users.push(invitation.guestId);
				message = `${creator.username} (${creator.email}) vous a envoyé une invitation`;
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

// Endpoint to retrieve notifications for a specific user
export const getNotifications = async (
	req: express.Request,
	res: express.Response
) => {
	const { userId } = req.params;
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	try {
		// New notifications: not read, seen less than a week ago, or read less than 24 hours ago
		const newNotifications = await notificationModel
			.find({
				users: { $in: [userId] },
				$or: [
					{ read: false },
					{ viewedAt: { $gte: oneWeekAgo } },
					{ read: true, viewedAt: { $gte: oneDayAgo } },
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
						viewedAt: { $lt: oneWeekAgo, $gte: oneDayAgo },
					},
					{
						read: false,
						viewedAt: { $lt: oneWeekAgo, $gte: oneMonthAgo },
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
