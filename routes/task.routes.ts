import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	setTasks,
	getTask,
	getWorkspaceTasks,
	editTask,
	deleteTask,
	getUrgentTasks,
	getUserTasks,
	updateTaskCategories,
	getShortTermTasks,
	getMidTermTasks,
	getLongTermTasks,
	getArchivedTasks,
} from '../controllers/task.controller';
import {
	validateUserID,
	validatePageAndLimit,
} from '../middlewares/validation.middlewares';

const router = express.Router();

// Route to create a new task
router.post('/', auth, setTasks);

// Route to get a task by its id
router.get('/:id', auth, getTask);

// Route to get all tasks for a specific workspace
router.get(
	'/workspace/:id',
	validateUserID,
	validatePageAndLimit,
	auth,
	getWorkspaceTasks
);

// Route to the three most urgent tasks with the userId
router.get('/:userId/urgent', auth, getUrgentTasks);

// Route to get all tasks for a specific user
router.get('/:userId/all-tasks', auth, getUserTasks);

// Route to get all short-term tasks for a specific user
router.get('/:userId/short-term', auth, getShortTermTasks);

// Route to get all mid-term tasks for a specific user
router.get('/:userId/mid-term', auth, getMidTermTasks);

// Route to get all long-term tasks for a specific user
router.get('/:userId/long-term', auth, getLongTermTasks);

// Route to get all archived tasks for a specific user
router.get('/:userId/archived', auth, getArchivedTasks);

// Route to update task's categories
router.post('/:userId/category', updateTaskCategories);

// Route to update a task by its id
router.put('/:id', auth, editTask);

// Route to delete a task by its id
router.delete('/:id', auth, deleteTask);

export default router;
