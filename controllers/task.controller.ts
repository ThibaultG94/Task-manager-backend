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
		if (task !== null && req.user._id !== task.userId) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// If everything is okay, return the task
		res.status(200).json(task);
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
			!workspace.members.includes(req.user._id) &&
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
				.limit(limit)) as Task[];

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

// Endpoint to create a task
export const setTasks = async (req: express.Request, res: express.Response) => {
	try {
		// Check if the request includes task title
		if (!req.body.title) {
			return res.status(400).json({ message: 'Please add a task' });
		}

		const userId = req.body.userId;

		// Check if the user exists
		const userExists = (await userModel.findOne({ _id: userId.toString() }))
			? true
			: false;

		if (!userExists) {
			return res.status(404).json({
				message: 'The specified user does not exist',
				userExists,
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
			category: req.body.category,
		});

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
	} catch (error) {
		// If something goes wrong, log the error and send a server error response
		const result = (error as Error).message;
		logger.info(result);

		return res
			.status(500)
			.json({ message: 'Internal server error', result });
	}
};

// Endpoint to edit a task
export const editTask = async (req: express.Request, res: express.Response) => {
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
		if (updates.category !== undefined) {
			task.category = updates.category;
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
	// Attempt to find and delete the task by the provided id
	const task = await TaskModel.findById(req.params.id);

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
};

// Endpoint to get Urgent Tasks
export const getUrgentTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const urgentTasks: ExtendedTask[] = await TaskModel.find({
			userId: userId,
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
			.slice(0, 3);

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
			userId: userId,
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

// Endpoint to update all tasks categories
export const updateTaskCategories = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const tasks = (await TaskModel.find({
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		tasks.forEach(async (task) => {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			task.category = category;
			await task.save();
		});

		return res.status(200).json({ message: 'Categories updated' });
	} catch (error) {
		console.error('Error updating categories:', error);
	}
};

export const getShortTermTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const shortTermCategories = [
			'retard-tasks',
			'today-tasks',
			'tomorrow-tasks',
		];

		const tasks = (await TaskModel.find({
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		const shortTermTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (shortTermCategories.includes(category)) {
				shortTermTasks.push(task);
			}
		}

		return res.status(200).json({ shortTermTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving short-term tasks',
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
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		const overDueTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			if (day === 'En retard') {
				overDueTasks.push(task);
			}
		}

		return res.status(200).json({ overDueTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving short-term tasks',
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
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		const todayTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			if (day === "Aujourd'hui") {
				todayTasks.push(task);
			}
		}

		return res.status(200).json({ todayTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving short-term tasks',
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
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		const tomorrowTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			if (day === 'Demain') {
				tomorrowTasks.push(task);
			}
		}

		return res.status(200).json({ tomorrowTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving short-term tasks',
		});
	}
};

export const getMidTermTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const midTermCategories = [
			'this-week-tasks',
			'this-weekend-tasks',
			'next-week-tasks',
			'next-weekend-tasks',
		];

		const tasks = (await TaskModel.find({
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		const midTermTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (midTermCategories.includes(category)) {
				midTermTasks.push(task);
			}
		}

		return res.status(200).json({ midTermTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving mid-term tasks',
		});
	}
};

export const getLongTermTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const longTermCategories = [
			'this-month-tasks',
			'this-year-tasks',
			'next-year-tasks',
			'becoming-tasks',
		];

		const tasks = (await TaskModel.find({
			userId: userId, // Include only tasks that belong to the specified userId
			status: { $ne: 'Archived' }, // Exclude tasks with 'Archived' status
		})) as Task[];

		const longTermTasks = [];

		for (const task of tasks) {
			const day = await FormatDateForDisplay(task.deadline);
			const category = GetCategoryDay(day, task.status, task.deadline);
			if (longTermCategories.includes(category)) {
				longTermTasks.push(task);
			}
		}

		return res.status(200).json({ longTermTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving long-term tasks',
		});
	}
};

export const getArchivedTasks = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userId = req.params.userId;
		const archivedTasks: ExtendedTask[] = await TaskModel.find({
			userId: userId,
			status: 'Archived',
		});

		return res.status(200).json({ archivedTasks });
	} catch (error) {
		res.status(500).json({
			message: 'An error occurred while retrieving archived tasks',
		});
	}
};
