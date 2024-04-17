import express from 'express';
import client from '../utils/redisClient';
import { FilterQuery } from 'mongoose';
import TaskModel from '../models/task.model';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';
import notificationModel from '../models/notification.model';
import logger from '../config/logger';
import { Task } from '../types/types';
import { ExtendedTask } from '../types/types';
import { priorityToNumber } from '../utils/priorityToNumber';
import { GetCategoryDay } from '../utils/GetCategoryDay';
import { FormatDateForDisplay } from '../utils/FormatDateForDisplay';

type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

const priorityValues: { [key in Priority]: number } = {
	Urgent: 4,
	High: 3,
	Medium: 2,
	Low: 1,
};

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
                assignedTo: task.assignedTo.map(userId => ({
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

        res.status(200).json(tasks);
    } catch (err) {
        const result = (err as Error).message;
        logger.info(result);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Endpoint to get the count of tasks by status in a specific workspace
export const getWorkspaceTaskStatusCount = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const workspaceId = req.params.id;

		// Vérifier si le workspace existe et si l'utilisateur est membre
		const workspace = await workspaceModel.findById(workspaceId);
		if (!workspace) {
			return;
		}

		if (
			!workspace.members.some(
				(member) => member.userId === req.user._id
			) &&
			workspace.userId !== req.user._id
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// Compter les tâches par statut
		const taskCountByStatus = await TaskModel.aggregate([
			{ $match: { workspaceId } },
			{ $group: { _id: '$status', count: { $sum: 1 } } },
		]);

		// Convertir le résultat en objet avec les statuts comme clés
		const statusCounts = taskCountByStatus.reduce(
			(acc, curr) => {
				acc[curr._id] = curr.count;
				return acc;
			},
			{ Pending: 0, 'In Progress': 0, Completed: 0, Archived: 0 }
		);

		// Retourner le décompte des tâches
		res.status(200).json(statusCounts);
	} catch (err) {
		const result = (err as Error).message;
		logger.info(result);

		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to create a task
export const createTask = async (
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) => {
	try {
		// Check if the request includes task title
		if (!req.body.title) {
			return res.status(400).json({ message: 'Please add a task' });
		}

		const userId = req.body.userId;

		// Check if the user exists
		const userExists = await userModel.exists({ _id: userId });

		if (!userExists) {
			return res
				.status(404)
				.json({ message: 'The specified user does not exist' });
		}

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
		});

		if (task) {
			const taskId = task._id;
			if (!taskId) {
				return res.status(400).json({
					message:
					"Task ID is required or notification's type is wrong",
				});
			}

			const creator = await userModel.findById(userId);
			if (!creator) {
				return res.status(404).json({ message: 'User not found' });
			}

			const message = `${creator.username} vous à assigner la tâche ${task.title}`;

			let users: any = [];
			task.assignedTo.forEach((user: any) => {	
				if (userId !== user.userId) {
					users.push(user.userId);
				}
			});
			if (users.length === 0) {
				return res.status(200).json({ message: 'No users ' });
			} else {
				const notification = new notificationModel({
					creatorId: userId,
					taskId,
					type: 'taskCreation',
					message,
					users,
                    workspaceId: workspaceId,
				});
	
				await notification.save();
			}

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

		res.status(200).json({ task: task });

		next();
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
	res: express.Response,
	next: express.NextFunction
) => {
	try {
		// Data to be updated
		const updates = req.body;

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
				console.log('archiveDate', updates.archiveDate);
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
			if (!isSuperAdmin && !isAdmin && !isTaskOwner && updates.assignedTo !== task.assignedTo) {
                const currentAssignedUserIds = new Set(task.assignedTo);
                const isModifyingExistingAssignees = updates.assignedTo.some((userId: string )=> currentAssignedUserIds.has(userId));

                if (!isModifyingExistingAssignees) {
                    return res.status(403).json({
                        message: 'You do not have sufficient rights to modify the assigned users of this task',
                    });
                }
			} else {
				task.assignedTo = updates.assignedTo;
			}
		}

		const updatedTask = await task.save();

		res.status(200).json({
			message: 'Task updated',
			task: updatedTask,
		});

		// Update the cache for this task
		const key = `task:${task.workspaceId}:${req.user._id}`;
		try {
			await client.setEx(key, 10800, JSON.stringify(updatedTask));
		} catch (error) {
			console.error('Cache update error for a task :', error);
		}

		next();
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
	res: express.Response,
	next: express.NextFunction
) => {
	// Attempt to find and delete the task by the provided id
	const task = await TaskModel.findById(req.params.id);
	const user = await userModel.findById(req.user._id);
	const workspace = await workspaceModel.findById(task?.workspaceId);

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
	const isTaskOwner = task.userId == req.user._id;

	// If no task is found, return a 400 status
	if (!task) {
		return res.status(400).json({ message: 'This task does not exist' });
	}

	// If a task is found, check if the user making the request is the same as the one who created the task
	if (task && req.user._id !== task.userId) {
		return res.status(403).json({
			message: 'You do not have the right to modify this task',
		});
	}

	// If the task is found and the user has sufficients rights, delete the task
	if (task) {
		if (!isSuperAdmin && !isAdmin && !isTaskOwner) {
			return res.status(403).json({
				message:
					'You do not have sufficients rights to perform this action',
			});
		}

		// find notifications related to the task and delete them
		await notificationModel.deleteMany({ taskId: task._id });

		let users: any = [];
		task.assignedTo.forEach((userId: string) => {
            if (req.user._id !== userId) {
                users.push(userId);
            }
        });        

		if (users.length > 0)  {
			const notification = new notificationModel({
				creatorId: req.user._id,
				type: 'taskDeletion',
				message: `${user.username} a supprimé la tâche ${task.title} du workspace ${workspace?.title}`,
				users: users,
			});
	
			await notification.save();
		}

		// Invalidates all cache keys for this user after a task update
		const keys = await client.keys(`task:${req.user._id}:*`);
		try {
			keys &&
				keys.forEach(async (key) => {
					await client.del(key);
				});
		} catch (error) {
			console.error(
				'Error invalidating cache after task deletion :',
				error
			);
		}

		await task.deleteOne();
		res.status(200).json({ message: 'Task deleted ' + req.params.id });

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
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort and limit results
        const sortedTasks = enrichedTasks.sort((a, b) => {
            const dateA = new Date(a.deadline).getTime();
            const dateB = new Date(b.deadline).getTime();
            const numericPriorityA = priorityToNumber(a.priority);
            const numericPriorityB = priorityToNumber(b.priority);
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
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort all tasks by deadline, then priority, then creation date
        const sortedTasks = enrichedTasks.sort((a, b) => {
            const dateA = new Date(a.deadline).getTime();
            const dateB = new Date(b.deadline).getTime();
            if (dateA !== dateB) {
                return dateA - dateB;
            }
            const numericPriorityA = priorityToNumber(a.priority);
            const numericPriorityB = priorityToNumber(b.priority);
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
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let allOverdueTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine overdue tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            if (day === 'En retard') {
                allOverdueTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from overdue tasks
        const assignedUserIds = [...new Set(allOverdueTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all overdue tasks
        const enrichedOverdueTasks = allOverdueTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort overdue tasks by deadline, then priority
        const sortedOverdueTasks = enrichedOverdueTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ overdueTasks: sortedOverdueTasks });
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
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let todayTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine today's tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            if (day === "Aujourd'hui") {
                todayTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from today's tasks
        const assignedUserIds = [...new Set(todayTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all today tasks
        const enrichedTodayTasks = todayTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort today's tasks by deadline, then priority
        const sortedTodayTasks = enrichedTodayTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ todayTasks: sortedTodayTasks });
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
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let tomorrowTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine tomorrow's tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            if (day === 'Demain') {
                tomorrowTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from tomorrow's tasks
        const assignedUserIds = [...new Set(tomorrowTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all tomorrow tasks
        const enrichedTomorrowTasks = tomorrowTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort tomorrow tasks by deadline, then priority
        const sortedTomorrowTasks = enrichedTomorrowTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ tomorrowTasks: sortedTomorrowTasks });
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
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let thisWeekTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine this week's tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'this-week-tasks') {
                thisWeekTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from this week's tasks
        const assignedUserIds = [...new Set(thisWeekTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all this week tasks
        const enrichedThisWeekTasks = thisWeekTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort this week tasks by deadline, then priority
        const sortedThisWeekTasks = enrichedThisWeekTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ thisWeekTasks: sortedThisWeekTasks });
    } catch (error) {
        console.error('An error occurred while retrieving this week tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving this week tasks.'
        });
    }
};

export const getThisWeekendTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let thisWeekendTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine this weekend's tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'this-weekend-tasks') {
                thisWeekendTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from this weekend's tasks
        const assignedUserIds = [...new Set(thisWeekendTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all this weekend tasks
        const enrichedThisWeekendTasks = thisWeekendTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort this weekend tasks by deadline, then priority
        const sortedThisWeekendTasks = enrichedThisWeekendTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ thisWeekendTasks: sortedThisWeekendTasks });
    } catch (error) {
        console.error('An error occurred while retrieving this weekend tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving this weekend tasks.'
        });
    }
};

export const getNextWeekTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let nextWeekTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine next week's tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'next-week-tasks') {
                nextWeekTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from next week's tasks
        const assignedUserIds = [...new Set(nextWeekTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all next week tasks
        const enrichedNextWeekTasks = nextWeekTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort next week tasks by deadline, then priority
        const sortedNextWeekTasks = enrichedNextWeekTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ nextWeekTasks: sortedNextWeekTasks });
    } catch (error) {
        console.error('An error occurred while retrieving next week tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving next week tasks.'
        });
    }
};

export const getNextWeekendTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let nextWeekendTasks = [];

        for (const workspace of workspaces) {
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { assignedTo: userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Determine next weekend's tasks
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'next-weekend-tasks') {
                nextWeekendTasks.push(task);
            }
        }

        // Collect all unique assignedTo userIds from next weekend's tasks
        const assignedUserIds = [...new Set(nextWeekendTasks.flatMap(task => task.assignedTo))];
        const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
            .select('email _id username')
            .lean();

        const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

        // Enrich the assignedTo field in all next weekend tasks
        const enrichedNextWeekendTasks = nextWeekendTasks.map(task => ({
            ...task,
            assignedTo: task.assignedTo.map(userId => ({
                userId: userId,
                email: userMap.get(userId)?.email,
                username: userMap.get(userId)?.username
            }))
        }));

        // Sort next weekend tasks by deadline, then priority
        const sortedNextWeekendTasks = enrichedNextWeekendTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ nextWeekendTasks: sortedNextWeekendTasks });
    } catch (error) {
        console.error('An error occurred while retrieving next weekend tasks:', error);
        res.status(500).json({
            message: 'An error occurred while retrieving next weekend tasks.'
        });
    }
};

export const getThisMonthTasks = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.params.userId;
        // Retrieve workspaces where the user is a member
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let thisMonthTasks = [];

        // Browse each workspace and apply the appropriate filters
        for (const workspace of workspaces) {
            // Check user role in workspace
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                // If user is admin or superadmin, retrieve all tasks (since month status will be checked later)
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                // Otherwise, filter tasks where the user is the creator or assigned
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { 'assignedTo.userId': userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Check each task with your custom date formatting logic for this month
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'this-month-tasks') {
                thisMonthTasks.push(task);
            }
        }

        // Sort this month tasks by deadline, then priority
        const sortedThisMonthTasks = thisMonthTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ thisMonthTasks: sortedThisMonthTasks });
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
        // Retrieve workspaces where the user is a member
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let nextMonthTasks = [];

        // Browse each workspace and apply the appropriate filters
        for (const workspace of workspaces) {
            // Check user role in workspace
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                // If user is admin or superadmin, retrieve all tasks (since next month status will be checked later)
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                // Otherwise, filter tasks where the user is the creator or assigned
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { 'assignedTo.userId': userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Check each task with your custom date formatting logic for next month
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'next-month-tasks') {
                nextMonthTasks.push(task);
            }
        }

        // Sort next month tasks by deadline, then priority
        const sortedNextMonthTasks = nextMonthTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ nextMonthTasks: sortedNextMonthTasks });
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
        // Retrieve workspaces where the user is a member
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let thisYearTasks = [];

        // Browse each workspace and apply the appropriate filters
        for (const workspace of workspaces) {
            // Check user role in workspace
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                // If user is admin or superadmin, retrieve all tasks (since year status will be checked later)
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                // Otherwise, filter tasks where the user is the creator or assigned
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { 'assignedTo.userId': userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Check each task with your custom date formatting logic for this year
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'this-year-tasks') {
                thisYearTasks.push(task);
            }
        }

        // Sort this year tasks by deadline, then priority
        const sortedThisYearTasks = thisYearTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ thisYearTasks: sortedThisYearTasks });
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
        // Retrieve workspaces where the user is a member
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let nextYearTasks = [];

        // Browse each workspace and apply the appropriate filters
        for (const workspace of workspaces) {
            // Check user role in workspace
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                // If user is admin or superadmin, retrieve all tasks (since next year status will be checked later)
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                // Otherwise, filter tasks where the user is the creator or assigned
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { 'assignedTo.userId': userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Check each task with your custom date formatting logic for next year
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'next-year-tasks') {
                nextYearTasks.push(task);
            }
        }

        // Sort next year tasks by deadline, then priority
        const sortedNextYearTasks = nextYearTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ nextYearTasks: sortedNextYearTasks });
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
        // Retrieve workspaces where the user is a member
        const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

        let allTasks = [];
        let becomingTasks = [];

        // Browse each workspace and apply the appropriate filters
        for (const workspace of workspaces) {
            // Check user role in workspace
            const userInWorkspace = workspace.members.find(member => member.userId === userId);
            const role = userInWorkspace ? userInWorkspace.role : null;

            let tasks;
            if (role === 'admin' || role === 'superadmin') {
                // If user is admin or superadmin, retrieve all tasks (since becoming status will be checked later)
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    status: { $ne: 'Archived' }
                }).lean();
            } else {
                // Otherwise, filter tasks where the user is the creator or assigned
                tasks = await TaskModel.find({
                    workspaceId: workspace._id,
                    $or: [
                        { userId: userId },
                        { 'assignedTo.userId': userId }
                    ],
                    status: { $ne: 'Archived' }
                }).lean();
            }

            allTasks.push(...tasks);
        }

        // Check each task with your custom date formatting logic for becoming relevant
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline);
            const category = GetCategoryDay(day, task.status, task.deadline);
            if (category === 'becoming-tasks') {
                becomingTasks.push(task);
            }
        }

        // Sort becoming tasks by deadline, then priority
        const sortedBecomingTasks = becomingTasks.sort((a, b) => {
            const deadlineA = new Date(a.deadline).getTime();
            const deadlineB = new Date(b.deadline).getTime();
            if (deadlineA !== deadlineB) {
                return deadlineA - deadlineB;
            }
            return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
        });

        return res.status(200).json({ becomingTasks: sortedBecomingTasks });
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

        let archivedTasks: ExtendedTask[] | any;
        let totalTasks = 0;

        if (cachedTasks) {
            archivedTasks = JSON.parse(cachedTasks);
        } else {
            // Retrieve workspaces where the user is a member
            const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();

            let allRelevantTasks = [];

            // Browse each workspace and apply the appropriate filters
            for (const workspace of workspaces) {
                // Check user role in workspace
                const userInWorkspace = workspace.members.find(member => member.userId === userId);
                const role = userInWorkspace ? userInWorkspace.role : null;

                let tasks;
                if (role === 'admin' || role === 'superadmin') {
                    // If user is admin or superadmin, retrieve all archived tasks
                    tasks = await TaskModel.find({
                        workspaceId: workspace._id,
                        status: 'Archived'
                    }).lean();
                } else {
                    // Otherwise, filter tasks where the user is the creator or assigned
                    tasks = await TaskModel.find({
                        workspaceId: workspace._id,
                        $or: [
                            { userId: userId },
                            { 'assignedTo.userId': userId }
                        ],
                        status: 'Archived'
                    }).lean();
                }

                allRelevantTasks.push(...tasks);
            }

            totalTasks = allRelevantTasks.length;

            // Sort archived tasks by archiveDate then limit and paginate
            let sortedTasks = allRelevantTasks.sort((a, b) => {
                return (
                    new Date(b.archiveDate).getTime() -
                    new Date(a.archiveDate).getTime()
                );
            });

            archivedTasks = sortedTasks.slice(skip, skip + limit);

            try {
                await client.setEx(key, 10800, JSON.stringify(archivedTasks));
            } catch (err) {
                console.error('Task caching error:', err);
            }
        }

        return res.status(200).json({ archivedTasks, totalTasks });
    } catch (error) {
        res.status(500).json({
            message: 'An error occurred while retrieving archived tasks',
        });
    }
};