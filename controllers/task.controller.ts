import express from 'express';
import client from '../utils/redisClient';
import { FilterQuery } from 'mongoose';
import TaskModel from '../models/task.model';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';
import notificationModel from '../models/notification.model';
import logger from '../config/logger';
import { Task } from '../types/types';
import { priorityToNumber } from '../utils/priorityToNumber';
import { fetchAndProcessTasks } from '../utils/tasks.utils';
import { fetchAndEnrichUserWorkspaces } from '../utils/workspaces.utils';

// Endpoint to get a task by id
export const getTask = async (req: express.Request, res: express.Response) => {
    try {
        const task = await TaskModel.findById(req.params.id).lean();

        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!task) {
            return res.status(400).json({ message: 'This task does not exist' });
        }

        const workspace = await workspaceModel.findById(task.workspaceId);
        if (!workspace) {
            return res.status(400).json({ message: 'This workspace does not exist' });
        }

        const isSuperAdmin = workspace.members.some(member => member.userId === req.user._id && member.role === 'superadmin');
        const isAdmin = workspace.members.some(member => member.userId === req.user._id && member.role === 'admin');
        const isTaskOwner = task.userId.toString() === req.user._id.toString();
        const isAssigned = task.assignedTo.includes(req.user._id.toString());

        if (!isSuperAdmin && !isAdmin && !isTaskOwner && !isAssigned) {
            return res.status(403).json({
                message: 'You do not have sufficient rights to perform this action',
            });
        }

        const usersDetails = await userModel.find({
            '_id': { $in: task.assignedTo }
        }).select('email _id username').lean();

        const enrichedAssignedTo = usersDetails.map(user => ({
            userId: user._id.toString(),
            email: user.email,
            username: user.username
        }));

        const responseTask = { ...task, assignedTo: enrichedAssignedTo };

        res.status(200).json({ task: responseTask });
    } catch (error) {
        const result = (error as Error).message;
        logger.info(result);

        res.status(500).json({ message: 'Internal server error' });
    }
};

// Endpoint to get tasks of a specific workspace
export const getWorkspaceTasks = async (
    req: express.Request,
    res: express.Response
) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const skip = (page - 1) * limit;
        const workspaceId = req.params.id;

        const workspace = await workspaceModel.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        if (
            !workspace.members.some(member => member.userId === req.user._id) &&
            workspace.userId !== req.user._id
        ) {
            return res.status(403).json({
                message: 'You do not have sufficient rights to perform this action',
            });
        }

        const key = `task:${workspaceId}:${page}:${limit}`;
        let cachedTasks: string | null = null;

        try {
            cachedTasks = await client.get(key);
        } catch (err) {
            console.error('Cache retrieval error:', err);
        }

        let tasks = [];
        if (cachedTasks) {
            tasks = JSON.parse(cachedTasks);
        } else {
            const userRole = workspace.members.find(member => member.userId === req.user._id)?.role;
            let queryConditions: FilterQuery<Task> = { workspaceId: workspaceId };

            if (userRole === 'superadmin' || userRole === 'admin') {
                queryConditions = { ...queryConditions };
            } else {
                queryConditions = { 
                    ...queryConditions,
                    $or: [
                        { userId: req.user._id },
                        { assignedTo: { $in: [req.user._id] } }
                    ]
                };
            }

            tasks = await TaskModel.find(queryConditions)
                .skip(skip)
                .limit(limit)
                .lean();

            // Fetch user details for assignedTo
            const assignedUserIds = tasks.flatMap(task => task.assignedTo);
            const uniqueUserIds = [...new Set(assignedUserIds)];
            const usersDetails = await userModel.find({ '_id': { $in: uniqueUserIds } })
                .select('email _id username')
                .lean();

            const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));
            tasks = tasks.map(task => ({
                ...task,
                assignedTo: (task.assignedTo as string[]).map(userId => ({
                    userId: userId,
                    email: userMap.get(userId)?.email,
                    username: userMap.get(userId)?.username
                }))
            }));

            try {
                await client.setEx(key, 10800, JSON.stringify(tasks));
            } catch (err) {
                console.error('Task caching error:', err);
            }
        }

        res.status(200).json({ tasks });
    } catch (err) {
        const result = (err as Error).message;
        logger.info(result);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Endpoint to create a task
export const createTask = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Check if the request includes task title
		if (!req.body.title) {
			return res.status(400).json({ message: 'Please add a task' });
		}

		const userId = req.body.userId;

		// Check if the user exists
		const user = await userModel.findById(userId);

		if (!user) {
			return res
				.status(404)
				.json({ message: 'The specified user does not exist' });
		}

        const isVisitor = user.role === 'visitor';

		const workspaceId = req.body.workspaceId;
		const workspace = await workspaceModel.findById(workspaceId);

		// Check if the workspace exists
		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'This workspace does not exist' });
		}

		const isSuperAdmin = workspace.members.some(
			(member) =>
				member.userId === req.user._id &&
				member.role === 'superadmin'
		);
		const isAdmin = workspace.members.some(
			(member) =>
				member.userId === req.user._id &&
				member.role === 'admin'
		);

		if (!isSuperAdmin && !isAdmin) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// Create a new task
		const task = await TaskModel.create({
			title: req.body.title,
			userId: req.body.userId,
			description: req.body.description,
			status: req.body.status,
			priority: req.body.priority,
			workspaceId: req.body.workspaceId,
			deadline: req.body.deadline,
			assignedTo: req.body.assignedTo,
			archiveDate:
				req.body.status === 'Archived'
					? new Date().toISOString()
					: null,
            visitorTask: isVisitor,
		});

		// Création de la tâche réussie, maintenant envoyer des notifications
        if (task) {
            const taskId = task._id;
            const creator = await userModel.findById(userId);
            const message = `${creator.username} vous a assigné la tâche ${task.title}`;

            // Notifications pour les utilisateurs assignés
            const assignedUserIds = task.assignedTo.filter(memberId => memberId !== userId);
            for (const memberId of assignedUserIds) {
                const notification = new notificationModel({
                    creatorId: userId,
                    userId: memberId,
                    taskId: taskId,
                    type: 'taskCreation',
                    message: message,
                    workspaceId: workspaceId,
                    visitorNotification: isVisitor,
                });
                await notification.save();
            }

            // Notifications pour les superadmins et admins du workspace qui ne sont pas l'utilisateur à l'origine de la requête
            workspace.members.forEach(async (member) => {
                if ((member.role === 'superadmin' || member.role === 'admin') && member.userId !== req.user._id) {
                    const notificationForAdmins = new notificationModel({
                        creatorId: userId,
                        userId: member.userId,
                        taskId: taskId,
                        type: 'taskCreation',
                        message: `Une nouvelle tâche '${task.title}' a été créée dans le workspace ${workspace.title}.`,
                        workspaceId: workspaceId,
                        visitorNotification: isVisitor,
                    });
                    await notificationForAdmins.save();
                }
            });

            await workspaceModel.findByIdAndUpdate(
                workspaceId,
                {
                    $set: { lastUpdateDate: new Date() },
                },
                { new: true, runValidators: true, context: 'query' }
            );
            
        } else {
            return res.status(404).json({ message: 'Task not found' });
        }
		// Invalide all cache keys for this user
		const keys = await client.keys(`task:${userId}:*`);
		try {
			keys &&
				keys.forEach(async (key) => {
					await client.del(key);
				});
		} catch (err) {
			console.error(
				'Error invalidating cache after task creation :',
				err
			);
		}

        const workspaces = await fetchAndEnrichUserWorkspaces(userId);

        return res.status(200).json({ task, workspaces });
	} catch (error) {
		// If something goes wrong, log the error and send a server error response
		const result = (error as Error).message;
		const request = req.body;
		logger.info(result);

		return res
			.status(500)
			.json({ message: 'Internal server error', result, request });
	}
};

// Endpoint to edit a task
export const editTask = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Data to be updated
		const updates = req.body;

        const user = await userModel.findById(req.user._id);
        const isVisitor = user.role === 'visitor';

		// Find the task by ID
		const task = (await TaskModel.findById(req.params.id)) as Task;

		// Find the workspace by ID
		const workspace = await workspaceModel.findById(task.workspaceId);

		const isSuperAdmin = workspace.members.some(
			(member) =>
				member.userId === req.user._id &&
				member.role === 'superadmin'
		);
		const isAdmin = workspace.members.some(
			(member) =>
				member.userId === req.user._id &&
				member.role === 'admin'
		);
		const isTaskOwner = task.userId === req.user._id;

		// Check if the task exists
		if (!task) {
			logger.info(res);

			return res
				.status(400)
				.json({ message: 'This task does not exist' });
		}

		if (!workspace) {
			return res
				.status(400)
				.json({ message: 'This workspace does not exist' });
		}

		// Check if the user making the request is a member of the workspace
		if (task && !workspace.members.some((member) => member.userId === req.user._id) && req.user._id !== workspace.userId){
			return res.status(403).json({
				message:
					'You do not have sufficients rights to perform this action',
			});
		}

		// Update the fields of the task
		if (updates.title !== undefined) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.title !== task.title) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to modify this title',
				});
			} else {
				task.title = updates.title;
			}
		}

		if (updates.userId !== undefined) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.userId !== task.userId) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to modify the owner of this task',
				});
			} else {
				task.userId = updates.userId;
			}
		}

		if (updates.date !== undefined) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.date !== task.date) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to modify the date of this task',
				});
			} else {
				task.date = updates.date;
			}
		}
	
		if (updates.description !== undefined) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.description !== task.description) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to modify this description',
				});
			} else {
				task.description = updates.description;
			}
		}
			
		if (
			updates.status !== undefined &&
			task.status !== 'Archived' &&
			updates.status === 'Archived'
		) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.archiveDate !== task.archiveDate) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to archive this task',
				});
			} else {
				task.archiveDate = new Date().toISOString();
			}
		}

		if (updates.status !== undefined) {
			if (updates.status === 'Archived') {
				if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.status !== task.status) {
					return res.status(403).json({
						message:
							'You do not have sufficients rights to modify the status of this task',
					});
				} else {
					task.status = updates.status;
				}
			} else {
				task.status = updates.status;
			}
		}

		if (updates.estimatedTime !== undefined) {
			task.estimatedTime = updates.estimatedTime;
		}

		if (updates.comments !== undefined) {
			task.comments = updates.comments;
		}

		if (updates.priority !== undefined) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.priority !== task.priority) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to modify the priority of this task',
				});
			} else {
				task.priority = updates.priority;
			}
		}

		if (updates.workspaceId !== undefined) {
			if (updates.workspaceId !== task.workspaceId) {
				if (!isSuperAdmin && !isAdmin && !isTaskOwner) {
					return res.status(403).json({
						message:
							'You do not have sufficients rights to modify the workspace of this task',
					});
				} else {
					task.workspaceId = updates.workspaceId;
				}
			} else {
				task.workspaceId = updates.workspaceId;
			}
		}

		if (updates.deadline !== undefined) {
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.deadline !== task.deadline) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to modify the deadline of this task',
				});
			} else {
				task.deadline = updates.deadline;
			}
		}

		if (updates.assignedTo !== undefined) {
            const currentAssignedUserIds = new Set(task.assignedTo);
            const updatedAssignedUserIds = new Set(updates.assignedTo);
            
            // Unassigned users
            const usersToRemove = Array.from(currentAssignedUserIds).filter(userId => !updatedAssignedUserIds.has(userId));
        
            // Map to store user roles
            const userRoles = new Map();
            workspace.members.forEach(member => {
                userRoles.set(member.userId, member.role);
            });
            
            // Update list of assigned users
            if (!isSuperAdmin && !isAdmin && !isTaskOwner && usersToRemove.some(userId => !currentAssignedUserIds.has(userId))) {
                return res.status(403).json({
                    message: 'You do not have sufficient rights to modify the assigned users of this task',
                });
            } else {
                task.assignedTo = updates.assignedTo;
            
                // Handle notifications for unassigned users
                usersToRemove.forEach(async (userId) => {
                    if (userId !== req.user._id) { // Ensure the notification is not created for the user making the request
                        const userRole = userRoles.get(userId) || 'member'; // Assuming 'member' as default if no role is found
                        const isUserSuperAdmin = userRole === 'superadmin';
                        const isUserAdmin = userRole === 'admin';
                        const isUserOwner = task.userId === userId;
            
                        if (!isUserSuperAdmin && !isUserAdmin && !isUserOwner) { // Check if the unassigned user is not a superadmin, admin, or the owner
                            await notificationModel.deleteMany({ taskId: task._id, userId: userId });
                        }
            
                        // Create new notification for unassigned user
                        const newNotification = new notificationModel({
                            creatorId: req.user._id,
                            userId: userId,
                            message: `Vous avez été désaffecté de la tâche: ${task.title}`,
                            type: isUserSuperAdmin || isUserAdmin || isUserOwner ? 'taskUpdate' : 'workspaceUpdate',
                            taskId: task._id,
                            workspaceId: task.workspaceId,
                            visitorNotification: isVisitor,
                        });
                        await newNotification.save();
                    }
                });
            }
        }              

		const updatedTask = await task.save();

        const taskObject = updatedTask.toObject();

        const usersDetails = await userModel.find({ '_id': { $in: taskObject.assignedTo } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        const enrichedTask = {
            ...taskObject,
            assignedTo: updatedTask.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        };

        const workspaces = await fetchAndEnrichUserWorkspaces(req.user._id);

        // Update the cache for this task
        const key = `task:${task.workspaceId}:${req.user._id}`;
        try {
            await client.setEx(key, 10800, JSON.stringify(enrichedTask));
        } catch (error) {
            console.error('Cache update error for a task :', error);
        }

		return res.status(200).json({
			message: 'Task updated',
			task: enrichedTask,
            workspaces,
		});
	} catch (error) {
		// If something goes wrong, log the error and a server error response
		const result = (error as Error).message;
		logger.error(result);

		return res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to delete a task
export const deleteTask = async (
    req: express.Request,
    res: express.Response
) => {
    try {
        // Tentative de trouver et supprimer la tâche par l'id fourni
        const task = await TaskModel.findById(req.params.id);
        const user = await userModel.findById(req.user._id);
        const isVisitor = user.role === 'visitor';
        if (!task) {
            return res.status(400).json({ message: 'This task does not exist' });
        }

        const workspace = await workspaceModel.findById(task.workspaceId);
        if (!workspace) {
            return res.status(400).json({ message: 'Workspace does not exist' });
        }

        const isSuperAdmin = workspace.members.some(
            (member) => member.userId === req.user._id && member.role === 'superadmin'
        );
        const isAdmin = workspace.members.some(
            (member) => member.userId === req.user._id && member.role === 'admin'
        );
        const isTaskOwner = task.userId == req.user._id;

        if (!isSuperAdmin && !isAdmin && !isTaskOwner) {
            return res.status(403).json({
                message: 'You do not have sufficient rights to perform this action',
            });
        }

        // Delete notifications related to the task
        await notificationModel.deleteMany({ taskId: task._id });

        // Send notifications to assigned users except the user who is deleting the task
        const assignedUserIds = task.assignedTo.filter(userId => userId !== req.user._id);
        assignedUserIds.forEach(async (userId) => {
            const notification = new notificationModel({
                creatorId: req.user._id,
                userId: userId,
                type: 'taskDeletion',
                message: `${user.username} a supprimé la tâche ${task.title} du workspace ${workspace.title}`,
                workspaceId: workspace._id,
                visitorNotification: isVisitor,
            });
            await notification.save();
        });

        // Additionally notify superadmins and admins of the workspace
        workspace.members.forEach(async (member) => {
            if ((member.role === 'superadmin' || member.role === 'admin') && member.userId !== req.user._id) {
                const notification = new notificationModel({
                    creatorId: req.user._id,
                    userId: member.userId,
                    type: 'taskDeletion',
                    message: `${user.username} a supprimé la tâche ${task.title} qui vous concerne dans le workspace ${workspace.title}`,
                    workspaceId: workspace._id,
                    visitorNotification: isVisitor,
                });
                await notification.save();
            }
        });

        // Delete the task
        await task.deleteOne();
        
        // Invalidate cache if necessary
        const keys = await client.keys(`task:${req.user._id}:*`);
        if (keys) { 
            keys.forEach(async (key) => {
                await client.del(key);
            });
        }

        const workspaces = await fetchAndEnrichUserWorkspaces(req.user._id);
        
        return res.status(200).json({ message: 'Task deleted ' + req.params.id, workspaces });
    } catch (error) {
        console.error('Error during task deletion:', error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};

// Endpoint to get Urgent Tasks
export const getUrgentTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allUrgentTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    deadline: { $exists: true },
                    priority: { $exists: true },
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    deadline: { $exists: true },
                    priority: { $exists: true },
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allUrgentTasks.push(...tasks);
        }

        // Collect all unique assignedTo userIds from the tasks
        const assignedUserIds = [...new Set(allUrgentTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all tasks
        const enrichedTasks = allUrgentTasks.map(task => ({
            ...task,
            assignedTo: (task.assignedTo as string[]).map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort and limit results
        const sortedTasks = enrichedTasks.sort((a, b) => {
            const dateA = new Date((a.deadline as string) || '').getTime();
            const dateB = new Date((b.deadline as string) || '').getTime();
            const numericPriorityA = priorityToNumber(a.priority as string);
            const numericPriorityB = priorityToNumber(b.priority as string);
            return dateA === dateB ? numericPriorityB - numericPriorityA : dateA - dateB;
        }).slice(0, 4);

        return res.status(200).json({ urgentTasks: sortedTasks });
    } catch (error) {
        console.error('An error occurred while retrieving urgent tasks:', error);
        res.status(500).json({
            message: 'An error has occurred while retrieving urgent tasks.'
        });
    }
};

// Endpoint to get All User Tasks
export const getUserTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allUserTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ]
                }).lean();
            }

            allUserTasks.push(...tasks);
        }

        // Collect all unique assignedTo userIds from the tasks
        const assignedUserIds = [...new Set(allUserTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all tasks
        const enrichedTasks = allUserTasks.map(task => ({
            ...task,
            assignedTo: (task.assignedTo as string[]).map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));        

        // Sort all tasks by deadline, then priority, then creation date
        const sortedTasks = enrichedTasks.sort((a, b) => {
            const dateA = new Date((a.deadline as string) || '').getTime();
            const dateB = new Date((b.deadline as string) || '').getTime();
            if (dateA !== dateB) {
                return dateA - dateB;
            }
            const numericPriorityA = priorityToNumber(a.priority as string);
            const numericPriorityB = priorityToNumber(b.priority as string);
            if (numericPriorityA !== numericPriorityB) {
                return numericPriorityB - numericPriorityA;
            }
            const creationDateA = new Date(a.createdAt).getTime();
            const creationDateB = new Date(b.createdAt).getTime();
            return creationDateA - creationDateB;
        });

        return res.status(200).json({ userTasks: sortedTasks });
    } catch (error) {
        console.error('An error occurred while retrieving user tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving user tasks.'
        });
    }
};

export const getOverdueTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const overdueTasks = await fetchAndProcessTasks(userId, 'En retard'); 

        return res.status(200).json({ overdueTasks });
    } catch (error) {
        console.error('An error occurred while retrieving overdue tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving overdue tasks.'
        });
    }
};

export const getTodayTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const todayTasks = await fetchAndProcessTasks(userId, "Aujourd'hui");

        return res.status(200).json({ todayTasks });
    } catch (error) {
        console.error('An error occurred while retrieving today tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving today tasks.'
        });
    }
};

export const getTomorrowTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const tomorrowTasks = await fetchAndProcessTasks(userId, "Demain");

        return res.status(200).json({ tomorrowTasks });
    } catch (error) {
        console.error('An error occurred while retrieving tomorrow tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving tomorrow tasks.'
        });
    }
};

export const getThisWeekTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const thisWeekTasks = await fetchAndProcessTasks(userId, "this-week-tasks");

        return res.status(200).json({ thisWeekTasks });
    } catch (error) {
        console.error('An error occurred while retrieving this week tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving this week tasks.'
        });
    }
};

export const getNextWeekTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const nextWeekTasks = await fetchAndProcessTasks(userId, "next-week-tasks");

        return res.status(200).json({ nextWeekTasks });
    } catch (error) {
        console.error('An error occurred while retrieving next week tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving next week tasks.'
        });
    }
};

export const getThisMonthTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const thisMonthTasks = await fetchAndProcessTasks(userId, "this-month-tasks");

        return res.status(200).json({ thisMonthTasks });
    } catch (error) {
        console.error('An error occurred while retrieving this month tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving this month tasks.'
        });
    }
};

export const getNextMonthTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const nextMonthTasks = await fetchAndProcessTasks(userId, "next-month-tasks");

        return res.status(200).json({ nextMonthTasks });
    } catch (error) {
        console.error('An error occurred while retrieving next month tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving next month tasks.'
        });
    }
};

export const getThisYearTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const thisYearTasks = await fetchAndProcessTasks(userId, "this-year-tasks");

        return res.status(200).json({ thisYearTasks });
    } catch (error) {
        console.error('An error occurred while retrieving this year tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving this year tasks.'
        });
    }
};

export const getNextYearTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const nextYearTasks = await fetchAndProcessTasks(userId, "next-year-tasks");

        return res.status(200).json({ nextYearTasks });
    } catch (error) {
        console.error('An error occurred while retrieving next year tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving next year tasks.'
        });
    }
};

export const getBecomingTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;

        const becomingTasks = await fetchAndProcessTasks(userId, "becoming-tasks");

        return res.status(200).json({ becomingTasks });
    } catch (error) {
        console.error('An error occurred while retrieving becoming tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving becoming tasks.'
        });
    }
};

export const getArchivedTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const skip = (page - 1) * limit;
        const key = `archived_tasks:${userId}:${page}:${limit}`;

        let cachedTasks: string | null = null;
        try {
            cachedTasks = await client.get(key);
        } catch (err) {
            console.error('Cache retrieval error:', err);
        }

        let archivedTasks = [];
        let totalTasks = 0;

        if (cachedTasks) {
            archivedTasks = JSON.parse(cachedTasks);
        } else {
            const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

            let allRelevantTasks = [];

            for (const workspace of workspaces) {
                const userInWorkspace = workspace.members.find(member => member.userId === userId);
                const role = userInWorkspace ? userInWorkspace.role : null;

                let tasks;
                if (role === 'admin' || role === 'superadmin') {
                    tasks = await TaskModel.find({
                        workspaceId: workspace._id,
                        status: 'Archived'
                    }).lean();
                } else {
                    tasks = await TaskModel.find({
                        workspaceId: workspace._id,
                        $or: [
                            { userId: userId },
                            { assignedTo: userId }
                        ],
                        status: 'Archived'
                    }).lean();
                }

                allRelevantTasks.push(...tasks);
            }

            totalTasks = allRelevantTasks.length;

            let sortedTasks = allRelevantTasks.sort((a, b) => {
                const dateA = new Date((a.archiveDate as string) || '').getTime();
                const dateB = new Date((b.archiveDate as string) || '').getTime();
                return dateB - dateA;
            });

            archivedTasks = sortedTasks.slice(skip, skip + limit);

            // Enrich assignedTo field in archived tasks
            const assignedUserIds = [...new Set(archivedTasks.flatMap(task => task.assignedTo))];
            const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
                .select('email _id username')
                .lean();

            const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

            archivedTasks = archivedTasks.map(task => ({
                ...task,
                assignedTo: (task.assignedTo as string[]).map(userId => ({
                    userId: userId,
                    email: userMap.get(userId)?.email,
                    username: userMap.get(userId)?.username
                }))
            }));

            try {
                await client.setEx(key, 10800, JSON.stringify(archivedTasks));
            } catch (err) {
                console.error('Task caching error:', err);
            }
        }

        return res.status(200).json({ archivedTasks, totalTasks });
    } catch (error) {
        console.error('An error occurred while retrieving archived tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving archived tasks.'
        });
    }
};
