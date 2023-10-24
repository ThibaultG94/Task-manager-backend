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
	getArchivedTasks,
	getOverdueTasks,
	getTodayTasks,
	getTomorrowTasks,
	getThisWeekTasks,
	getThisWeekendTasks,
	getNextWeekTasks,
	getNextWeekendTasks,
	getThisMonthTasks,
	getThisYearTasks,
	getNextYearTasks,
	getBecomingTasks,
	getNextMonthTasks,
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

// Route to get all overdue tasks for a specific user
router.get('/:userId/overdue', auth, getOverdueTasks);

// Route to get all today tasks for a specific user
router.get('/:userId/today', auth, getTodayTasks);

// Route to get all tomorrow tasks for a specific user
router.get('/:userId/tomorrow', auth, getTomorrowTasks);

// Route to get all this week tasks for a specific user
router.get('/:userId/this-week', auth, getThisWeekTasks);

// Route to get all this weekend tasks for a specific user
router.get('/:userId/this-weekend', auth, getThisWeekendTasks);

// Route to get all next week tasks for a specific user
router.get('/:userId/next-week', auth, getNextWeekTasks);

// Route to get all next weekend tasks for a specific user
router.get('/:userId/next-weekend', auth, getNextWeekendTasks);

// Route to get all this month tasks for a specific user
router.get('/:userId/this-month', auth, getThisMonthTasks);

// Route to get all next month tasks for a specific user
router.get('/:userId/next-month', auth, getNextMonthTasks);

// Route to get all this year tasks for a specific user
router.get('/:userId/this-year', auth, getThisYearTasks);

// Route to get all next year tasks for a specific user
router.get('/:userId/next-year', auth, getNextYearTasks);

// Route to get all becoming tasks for a specific user
router.get('/:userId/becoming', auth, getBecomingTasks);

// Route to get all archived tasks for a specific user
router.get('/:userId/archived', auth, getArchivedTasks);

// Route to update task's categories
router.post('/:userId/category', updateTaskCategories);

// Route to update a task by its id
router.put('/:id', auth, editTask);

// Route to delete a task by its id
router.delete('/:id', auth, deleteTask);

export default router;
