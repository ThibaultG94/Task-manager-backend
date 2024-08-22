import express from 'express';
import { auth } from '../middlewares/auth.middlewares';
import {
	registerUser,
	loginUser,
	updateUser,
	deleteUser,
	getUser,
	refreshUserToken,
	logoutUser,
	getMe,
	getUsers,
	forgotPassword,
	resetPassword,
	getContacts,
	deleteContact,
	createVisitorSession,
	blockContact,
	getBlockedContacts,
	unBlockContact,
	updateUserAvatar,
} from '../controllers/user.controller';
import {
	validate,
	validateUserID,
} from '../middlewares/validation.middlewares';
import {
	loginSchema,
	registerSchema,
	forgetSchema,
} from '../models/validation.model';
import { apiRegisterAndLoginLimiter } from '../middlewares/rateLimiter.middlewares';

const router = express.Router();

// Route to register a new user
router.post(
	'/register',
	apiRegisterAndLoginLimiter,
	validate(registerSchema, 'body'),
	registerUser
);

// Route to register a new visitor
router.post(
	'/visitor',
	apiRegisterAndLoginLimiter,
	createVisitorSession
);

// Route to log in a user
router.post(
	'/login',
	apiRegisterAndLoginLimiter,
	validate(loginSchema, 'body'),
	loginUser
);

// Route to get a user's account information by their id
router.get('/:id/account', validateUserID, auth, getUser);

// Route to get user's contacts information
router.get('/:id/contacts', validateUserID, auth, getContacts);

// Route to get user's blocked contacts information
router.get('/:id/contacts-blocked', validateUserID, auth, getBlockedContacts);

// Route to get user's from a same workspace basics information by the workspace id
router.get('/:workspaceId/members', auth, getUsers);

// Route to update a user's information by their id
router.put('/:id/update', validateUserID, auth, updateUser);

// Route to update a user's avatar by their id
router.put('/:id/avatar', validateUserID, auth, updateUserAvatar);

// Route to delete a user's account by their id
router.delete('/:id/delete', validateUserID, auth, deleteUser);

// Route to refresh token
router.post('/token', refreshUserToken);

// Route to log out a user
router.get('/logout', logoutUser);

// Route to obtain the account information of the currently logged-in user
router.get('/my-account', auth, getMe);

// Route to request password reset
router.post('/forgot-password', forgotPassword);

// Route to reset password
router.post('/reset-password/:token', resetPassword);

// Route to delete contact
router.delete('/:contactId/delete-contact', auth, deleteContact);

// Route to block a user's account by their id
router.delete('/:contactId/block-contact', auth, blockContact);

// Route to unblock a user's account by their id
router.delete('/:contactId/unblock-contact', auth, unBlockContact);

export default router;
