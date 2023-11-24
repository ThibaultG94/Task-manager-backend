import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	createWorkspace,
	deleteWorkspace,
	editWorkspace,
	getUserWorkspaces,
	getWorkspace,
} from '../controllers/workspace.controller';
import { validateUserID } from '../middlewares/validation.middlewares';
import { updateLastUpdateDate } from '../middlewares/workspace.middlewares';

const router = express.Router();

// Route to create a new workspace
router.post('/user/:id/create-workspace', auth, createWorkspace);

// Route to get a workspace by its id
router.get('/:id', auth, validateUserID, getWorkspace);

// Route to get all workspaces for a specific user
router.get('/user/:id', auth, validateUserID, getUserWorkspaces);

// Route to update a workspace by its id
router.put('/:id', auth, validateUserID, editWorkspace, updateLastUpdateDate);

// Route to delete a workspace by its id
router.delete('/:id', auth, validateUserID, deleteWorkspace);

export default router;
