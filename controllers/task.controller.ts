import TaskModel from '../models/task.model';
import express from 'express';
import client from '../utils/redisClient';
import userModel from '../models/user.model';
import { Task } from '../types/types';
import workspaceModel from '../models/workspace.model';
import logger from '../config/logger';
import { priorityToNumber } from '../utils/priorityToNumber';
import { ExtendedTask } from '../types/types';
import { GetCategoryDay } from '../utils/GetCategoryDay';
import { FormatDateForDisplay } from '../utils/FormatDateForDisplay';
import notificationModel from '../models/notification.model';

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
		// Find the task with the id provided in params
		const task: Task = await TaskModel.findById(req.params.id);

		if (!req.user) {
			return res.status(401).json({ message: 'User not authenticated' });
		}

		// If the task does not exist, return a 400 status
		if (!task) {
			return res
				.status(400)
				.json({ message: 'This task does not exist' });
		}

		// Check if the user making the request is the owner of the task
		// by comparing the user's ID from the request (req.user._id)
		// with the ID of the user who owns the task (task.userId)

		if (req.user._id.toString() !== task.userId.toString() && !task.assignedTo.some((user) => user.userId.toString() === req.user._id.toString())) {
			return res.status(403).json({
				message: 'You do not have sufficient rights to perform this action',
			});
		}	

		// If everything is okay, return the task
		res.status(200).json({ task });
	} catch (error) {
		// In case of error, return a 500 status with the error message
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
		// Parsing the page and limit query parameters. If not provided, default value are used.
		const page = parseInt(req.query.page as string, 10) || 1;
		const limit = parseInt(req.query.limit as string, 10) || 10;

		// Calculate the number of tasks to skip based on the page and limit.
		const skip = (page - 1) * limit;

		const workspaceId = req.params.id;

		// Verify if the workspace exists and if the user is a member of it
		const workspace = await workspaceModel.findById(workspaceId);
		if (!workspace) {
			return res.status(404).json({ message: 'Workspace not found' });
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

		// Generate a unique key for caching purposes using the worspace ID, page, and limit.
		const key = `task:${workspaceId}:${page}:${limit}`;

		// First, check if the tasks are already cached
		let cachedTasks: string | null = null;
		try {
			cachedTasks = await client.get(key);
		} catch (err) {
			console.error('Cache retrieval error :', err);
		}

		let tasks: Task[] | null;
		if (cachedTasks) {
			// If the tasks are cached, use them
			tasks = JSON.parse(cachedTasks);
		} else {
			// If the tasks are not cached, fetch the tasks from the database
			tasks = (await TaskModel.find({ workspaceId })
				.skip(skip)
				.limit(limit)) as unknown as Task[];

			// Then, cache the fetched tasks for future requests
			try {
				await client.setEx(key, 10800, JSON.stringify(tasks));
			} catch (err) {
				console.error('Task caching error :', err);
			}
		}

		// Return the tasks
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
export const setTask = async (
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

		// Check if the user making the request is the owner of the workspace
		if (
			req.user._id !== workspace.userId &&
			!workspace.members.some((member) => member.userId === req.user._id)
		) {
			const isSuperAdmin = workspace.members.some(
				(member) =>
					member.userId === req.user._id &&
					member.role === 'superadmin'
			);
			if (!isSuperAdmin) {
				return res.status(403).json({
					message:
						'You do not have sufficients rights to perform this action',
				});
			}
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
			task.assignedTo.forEach((user) => {	
				if (userId !== user.userId) {
					users.push(user.userId);
				}
			});
			if (users.length === 0) {
				return res.status(404).json({ message: 'No users ' });
			} else {
				const notification = new notificationModel({
					creatorId: userId,
					taskId,
					type: 'taskCreation',
					message,
					users,
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

		// Check if the task exists
		if (!task) {
			logger.info(res);

			return res
				.status(400)
				.json({ message: 'This task does not exist' });
		}

		// Check if the user making the request is the owner of the task
		if (task && req.user._id !== task.userId) {
			return res.status(403).json({
				message:
					'You do not have sufficients rights to perform this action',
			});
		}

		// Update the fields of the task
		if (updates.title !== undefined) {
			task.title = updates.title;
		}
		if (updates.userId !== undefined) {
			task.userId = updates.userId;
		}
		if (updates.date !== undefined) {
			task.date = updates.date;
		}
		if (updates.description !== undefined) {
			task.description = updates.description;
		}
		if (
			updates.status !== undefined &&
			task.status !== 'Archived' &&
			updates.status === 'Archived'
		) {
			task.archiveDate = new Date().toISOString();
		}
		if (updates.status !== undefined) {
			task.status = updates.status;
		}
		if (updates.estimatedTime !== undefined) {
			task.estimatedTime = updates.estimatedTime;
		}
		if (updates.comments !== undefined) {
			task.comments = updates.comments;
		}
		if (updates.priority !== undefined) {
			task.priority = updates.priority;
		}
		if (updates.workspaceId !== undefined) {
			task.workspaceId = updates.workspaceId;
		}
		if (updates.deadline !== undefined) {
			task.deadline = updates.deadline;
		}
		if (updates.assignedTo !== undefined) {
			task.assignedTo = updates.assignedTo;
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
		// find notifications related to the task and delete them
		await notificationModel.deleteMany({ taskId: task._id });

		const notification = new notificationModel({
			creatorId: req.user._id,
			type: 'taskDelation',
			message: `${user.username} a supprimé la tâche ${task.title} du workspace ${workspace?.title}`,
			users: task.assignedTo.map((member) => member.userId),
		});

		await notification.save();

		await task.deleteOne();
		res.status(200).json({ message: 'Task deleted ' + req.params.id });

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
	}

	next();
};

// Endpoint to get Urgent Tasks
export const getUrgentTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const urgentTasks: ExtendedTask[] = await TaskModel.find({
			$or: [
			  { userId: userId },
			  { assignedTo: { $elemMatch: { userId: userId } } } 
			],
			deadline: { $exists: true },
			priority: { $exists: true },
			status: { $ne: 'Archived' },
		  });
		  

		const sortedTasks = urgentTasks
			.sort((a, b) => {
				const dateA = new Date(a.deadline).getTime();
				const dateB = new Date(b.deadline).getTime();
				const numericPriorityA = priorityToNumber(a.priority);
				const numericPriorityB = priorityToNumber(b.priority);

				if (dateA === dateB) {
					return numericPriorityB - numericPriorityA;
				}
				return dateA - dateB;
			})
			.slice(0, 4);

		return res.status(200).json({ urgentTasks: sortedTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error has occurred while retrieving urgent tasks.',
		});
	}
};

// Endpoint to get All User Tasks
export const getUserTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const userTasks: ExtendedTask[] = await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
		});

		const sortedTasks = userTasks.sort((a, b) => {
			// Compare by deadline
			const dateA = new Date(a.deadline).getTime();
			const dateB = new Date(b.deadline).getTime();
			if (dateA !== dateB) {
				return dateA - dateB;
			}

			// If deadlines are the same, compare by priority
			const numericPriorityA = priorityToNumber(a.priority);
			const numericPriorityB = priorityToNumber(b.priority);
			if (numericPriorityA !== numericPriorityB) {
				return numericPriorityB - numericPriorityA;
			}

			// If priorities are the same, compare by creation date
			const creationDateA = new Date(a.createdAt).getTime();
			const creationDateB = new Date(b.createdAt).getTime();
			return creationDateA - creationDateB;
		});

		return res.status(200).json({ userTasks: sortedTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occured while retrieving user tasks',
		});
	}
};

export const getOverdueTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let overdueTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			if (day === 'En retard') {
				overdueTasks.push(task);
			}
		}

		overdueTasks = overdueTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ overdueTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving overdue tasks',
		});
	}
};

export const getTodayTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let todayTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			if (day === "Aujourd'hui") {
				todayTasks.push(task);
			}
		}

		todayTasks = todayTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ todayTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving today tasks',
		});
	}
};

export const getTomorrowTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let tomorrowTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			if (day === 'Demain') {
				tomorrowTasks.push(task);
			}
		}

		tomorrowTasks = tomorrowTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ tomorrowTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving tomorrow tasks',
		});
	}
};

export const getThisWeekTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const thisWeekCategories = ['this-week-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let thisWeekTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (thisWeekCategories.includes(category)) {
				thisWeekTasks.push(task);
			}
		}

		thisWeekTasks = thisWeekTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ thisWeekTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving this week tasks',
		});
	}
};

export const getThisWeekendTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const thisWeekendCategories = ['this-weekend-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let thisWeekendTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (thisWeekendCategories.includes(category)) {
				thisWeekendTasks.push(task);
			}
		}

		thisWeekendTasks = thisWeekendTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ thisWeekendTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving this weekend tasks',
		});
	}
};

export const getNextWeekTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const nextWeekCategories = ['next-week-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let nextWeekTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (nextWeekCategories.includes(category)) {
				nextWeekTasks.push(task);
			}
		}

		nextWeekTasks = nextWeekTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ nextWeekTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving next week tasks',
		});
	}
};

export const getNextWeekendTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const nextWeekendCategories = ['next-weekend-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let nextWeekendTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (nextWeekendCategories.includes(category)) {
				nextWeekendTasks.push(task);
			}
		}

		nextWeekendTasks = nextWeekendTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ nextWeekendTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving next weekend tasks',
		});
	}
};

export const getThisMonthTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const thisMonthCategories = ['this-month-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let thisMonthTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (thisMonthCategories.includes(category)) {
				thisMonthTasks.push(task);
			}
		}

		thisMonthTasks = thisMonthTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ thisMonthTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving this month tasks',
		});
	}
};

export const getNextMonthTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const nextMonthCategories = ['next-month-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let nextMonthTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (nextMonthCategories.includes(category)) {
				nextMonthTasks.push(task);
			}
		}

		nextMonthTasks = nextMonthTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ nextMonthTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving next month tasks',
		});
	}
};

export const getThisYearTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const thisYearCategories = ['this-year-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let thisYearTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (thisYearCategories.includes(category)) {
				thisYearTasks.push(task);
			}
		}

		thisYearTasks = thisYearTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ thisYearTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving this year tasks',
		});
	}
};

export const getNextYearTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const nextYearCategories = ['next-year-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let nextYearTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (nextYearCategories.includes(category)) {
				nextYearTasks.push(task);
			}
		}

		nextYearTasks = nextYearTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ nextYearTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving next year tasks',
		});
	}
};

export const getBecomingTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const becomingCategories = ['becoming-tasks'];

		const tasks = (await TaskModel.find({
			$or: [
				{ userId: userId },
				{ assignedTo: { $elemMatch: { userId: userId } } } 
			  ],
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		let becomingTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (becomingCategories.includes(category)) {
				becomingTasks.push(task);
			}
		}

		becomingTasks = becomingTasks.sort((a, b) => {
			if (
				new Date(a.deadline).getTime() ===
				new Date(b.deadline).getTime()
			) {
				return (
					priorityValues[b.priority as Priority] -
					priorityValues[a.priority as Priority]
				);
			}
			return (
				new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
			);
		});

		return res.status(200).json({ becomingTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving becoming tasks',
		});
	}
};

export const getArchivedTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const page = parseInt(req.query.page as string, 10) || 1;
		const limit = parseInt(req.query.limit as string, 10) || 10;
		const skip = (page - 1) * limit;
		const userId = req.params.userId;
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
			// Récupérer le nombre total de tâches archivées
			totalTasks = await TaskModel.countDocuments({
				$or: [
			  { userId: userId },
			  { assignedTo: { $elemMatch: { userId: userId } } } 
			],
				status: 'Archived',
			});

			let allRelevantTasks = await TaskModel.find({
				$or: [
			  { userId: userId },
			  { assignedTo: { $elemMatch: { userId: userId } } } 
			],
				status: 'Archived',
			})
				.lean()
				.exec();

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
