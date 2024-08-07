import express from 'express';
import client from '../utils/redisClient';
import { notificationNamespace } from '../server';
import notificationModel from '../models/notification.model';
import userModel from '../models/user.model';
import taskModel from '../models/task.model';
import workspaceModel from '../models/workspace.model';

// Function to send a notification
const sendNotification = async (creatorId: string, userId: string, message: string, type: string, isVisitor: boolean, creator: any, taskId?: string, workspaceId?: string) => {
    const notification = new notificationModel({
        creatorId: creatorId,
        userId: userId,
        taskId: taskId,
        type: type,
        message: message,
        workspaceId: workspaceId,
        visitorNotification: isVisitor,
    });
    await notification.save();

    const notifToEmit = {
        ...notification.toObject(),
        creatorUsername: creator.username,
    };

    // Emit notification via Socket.io
    notificationNamespace.to(userId.toString()).emit('new_notification', notifToEmit);

    return notification._id;
};

// Endpoint to set a notification
export const setNotification = async (req: express.Request, res: express.Response) => {
    const { creatorId, taskId, workspaceId, type } = req.body;

    try {
        const creator = await userModel.findById(creatorId);
        if (!creator) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isVisitor = creator.role === 'visitor';
        let notificationsIds: any = [];

        // Handle invitation updates
        if (type === 'taskUpdate') {
            if (!taskId) {
                return res.status(400).json({
                    message: "Task ID is required for this type of notification",
                });
            }

            const task = await taskModel.findById(taskId);
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            // Retrieving the workspace to obtain the list of members
            const workspace = await workspaceModel.findById(task.workspaceId);
            if (!workspace) {
                return res.status(404).json({ message: 'Workspace not found' });
            }

            // Create notifications for users assigned to the task
            const taskMessage = `${creator.username} a mis à jour la tâche ${task.title}`;
            const assignedPromises = task.assignedTo.map(async (userId) => {
                if (creatorId !== userId) {
                    const notificationId = await sendNotification(creatorId, userId, taskMessage, type, isVisitor, creator, taskId, task.workspaceId);
                    notificationsIds.push(notificationId);
                }
            });

            await Promise.all(assignedPromises);

            // Create notification for superadmins, admins, and workspace owner
            const adminPromises = workspace.members
                .filter(member => !task.assignedTo.includes(member.userId))
                .map(async (member) => {
                    if ((member.role === 'superadmin' || member.role === 'admin' || member.userId === task.userId) && creatorId !== member.userId) {
                        const notificationId = await sendNotification(creatorId, member.userId, taskMessage, type, isVisitor, creator, taskId, task.workspaceId);
                        notificationsIds.push(notificationId);
                    }
                });

            await Promise.all(adminPromises);

            return res.status(200).json({ notificationsIds });

        } else if (type === 'workspaceUpdate') {
            if (!workspaceId) {
                return res.status(400).json({
                    message: "Workspace ID is required for this type of notification",
                });
            }

            const workspace = await workspaceModel.findById(workspaceId);
            if (!workspace) {
                return res.status(404).json({ message: 'Workspace not found' });
            }

            // Create a notification for each member in the workspace, excluding the creator
            const workspaceMessage = `${creator.username} a mis à jour le workspace ${workspace.title}`;
            const workspacePromises = workspace.members.map(async (member: any) => {
                if (creatorId !== member.userId) {
                    const notificationId = await sendNotification(creatorId, member.userId, workspaceMessage, type, isVisitor, creator, undefined, workspaceId);
                    notificationsIds.push(notificationId);
                }
            });

            await Promise.all(workspacePromises);

            return res.status(200).json({ notificationsIds });
        }

    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

// Endpoint to retrieve all notifications for a specific user with pagination
export const getAllNotifications = async (req: express.Request, res: express.Response) => {
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
        let totalNumberOfNotifications = 0;

        if (cachedNotifications) {
            notifications = JSON.parse(cachedNotifications);
        } else {
            // Retrieve the total number of notifications
            totalNumberOfNotifications = await notificationModel.countDocuments({
                userId: userId,  // Use userId for filter
            });

            // Retrieve notifications with a limit and a jump
            notifications = await notificationModel
                .find({ userId: userId })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .lean();

            const creatorIds = [
                ...new Set(notifications.map((n: any) => n.creatorId)),
            ];
            const creators = await userModel.find({ _id: { $in: creatorIds } });
            const creatorMap: any = creators.reduce(
                (acc, creator) => ({
                    ...acc,
                    [creator._id.toString()]: creator.username,
                }),
                {}
            );
            const avatarMap: any = creators.reduce(
                (acc, creator) => ({
                    ...acc,
                    [creator._id.toString()]: creator.avatar,
                }),
                {}
            );

            const mapNotifications: any = (notifications: any) =>
                notifications.map((n: any) => ({
                    ...n,
                    creatorUsername: creatorMap[n.creatorId],
                    avatar: avatarMap[n.creatorId],
                }));

            notifications = mapNotifications(notifications);

            try {
                await client.setEx(
                    key,
                    10800, // TTL for cache in seconds
                    JSON.stringify(notifications)
                );
            } catch (err) {
                console.error('Notifications caching error:', err);
            }
        }

        return res.status(200).json({ notifications, totalNumberOfNotifications });
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
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        // New notifications: not read, seen less than a week ago, or read less than 24 hours ago
        const newNotifications = await notificationModel
            .find({
                userId: userId,
                $or: [
                    { read: false },
                    { read: true, viewedAt: { $gt: oneDayAgo } },
                ],
            })
            .sort({ createdAt: -1 })
            .lean();

        // Older notifications: read between 24 hours and a week, or not read but seen between a week and a month
        const earlierNotifications = await notificationModel
            .find({
                userId: userId,
                $or: [
                    {
                        read: true,
                        viewedAt: { $gte: oneMonthAgo, $lte: oneDayAgo },
                    },
                    {
                        read: false,
                        viewedAt: { $gte: oneMonthAgo, $lt: oneWeekAgo },
                    },
                ],
            })
            .sort({ createdAt: -1 })
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
        const avatarMap: any = users.reduce(
            (acc, user) => ({ ...acc, [user._id.toString()]: user.avatar }),
            {}
        );

        const mapNotifications: any = (notifications: any) =>
            notifications.map((n: any) => ({
                ...n,
                creatorUsername: usernameMap[n.creatorId],
                avatar: avatarMap[n.creatorId],
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

        // Check that the user exists before proceeding
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!notificationsIds || notificationsIds.length === 0) {
            return res
                .status(400)
                .json({ message: 'Notifications IDs are required' });
        }

        // Update specified notifications, verifying that they belong to the user
        await notificationModel.updateMany(
            {
                _id: { $in: notificationsIds },
                userId: userId, // Ensure that the notification belongs to the user
            },
            { viewedAt: new Date() } // No need for toISOString() here, Mongoose handles conversion
        );

        return res.status(200).json({ message: 'Notifications updated' });
    } catch (error) {
        console.error(error);
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
            return res.status(400).json({ message: 'Notification ID is required' });
        }

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const notification = await notificationModel.findById(notificationId);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Check whether the notification belongs to the user before marking it as read
        if (notification.userId !== userId) {
            return res.status(403).json({
                message: 'User is not allowed to access this notification',
            });
        }

        await notificationModel.findByIdAndUpdate(notificationId, {
            read: true,
            viewedAt: new Date()  // Let's also add a timestamp for the moment when it is read
        });

        return res.status(200).json({ message: 'Notification marked as read' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};
// Endpoint to delete a notification
export const deleteNotification = async (
    req: express.Request,
    res: express.Response
) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user._id;

        if (!notificationId) {
            return res.status(400).json({ message: 'Notification ID is required' });
        }

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const notification = await notificationModel.findById(notificationId);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Check whether the notification belongs to the user before deleting it
        if (notification.creatorId !== userId) {
            return res.status(403).json({
                message: 'User is not allowed to access this notification',
            });
        }

        await notification.deleteOne();

        return res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};