import UserModel from '../models/user.model';
import express from 'express';
import bcrypt from 'bcryptjs';
import { User, UserBase } from '../types/types';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import refreshTokenModel from '../models/refreshToken.model';
import workspaceModel from '../models/workspace.model';
import { Workspace } from '../types/types';
import logger from '../config/logger';

// Enpoint to create a user
export const registerUser = async (
	req: express.Request,
	res: express.Response
) => {
	// Extract username, email, password and role from the request body
	const { username, email, password, role } = req.body;

	if (
		(typeof username && typeof email && typeof password && typeof role) !==
		'string'
	) {
		return res.status(422).send('Invalid input');
	}

	try {
		// Attempt to find an existing user with the provided email
		const existingUser = await UserModel.findOne({ email });

		if (existingUser) {
			return res.status(400).json({
				message:
					'Email already in use. Please change email address or login.',
			});
		}

		// If no user with the provided email exists, create a new user
		// with the provided details and save them to the database
		const newUser = new UserModel({ username, email, password, role });
		await newUser.save();

		// After the user is saved, create a new workspace for them
		const workspace = new workspaceModel({
			title: 'Default Workspace',
			userId: newUser._id,
			description: 'This is your default workspace',
			members: [
				{
					userId: newUser._id,
					username: newUser.username,
					email: newUser.email,
				},
			],
			isDefault: true,
		});

		await workspace.save();

		if (process.env.NODE_ENV === 'test') {
			res.status(201).json({
				message:
					'User successfully registered and default workspace created',
				user: newUser,
			});
		} else {
			res.status(201).json({
				message:
					'User successfully registered and default workspace created',
			});
		}
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);
		res.status(500).json({
			message: 'Internal server error',
		});
	}
};

// Endpoint to login a user
export const loginUser = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Extract email and password from the request body
		const { email, password } = req.body;

		if ((typeof email && typeof password) !== 'string') {
			return res.status(422).send('Invalid input');
		}

		// Attempt to find a user with the provided email
		const user: User = await UserModel.findOne({ email });

		// If no user with the provided email exists, return a 404 status
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// If a user with the provided email exists, validate the provided password
		const isPasswordValid = await bcrypt.compare(password, user.password);

		// If the password is not valid, return a 401 status
		if (!isPasswordValid) {
			return res.status(401).json({ message: 'Invalid password' });
		}

		// If the user exists and the password is valid,
		// generate an authentication token and a refresh token for the user
		if (user && isPasswordValid) {
			const token = user.generateAuthToken();
			const refreshToken = user.generateRefreshToken();

			// Store the refresh token in the database
			const newRefreshToken = new refreshTokenModel({
				token: refreshToken,
				userId: user._id,
			});
			await newRefreshToken.save();

			return res.status(200).json({
				token: token,
				refreshToken: refreshToken,
				user: {
					id: user._id,
					username: user.username,
					email: user.email,
				},
			});
		} else {
			// If the user does not exist or the password is not valid, return a 400 status
			return res.status(400).json({ message: 'Identifiants incorrects' });
		}
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to edit a user
export const updateUser = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Check if the request body is empty
		if (Object.keys(req.body).length === 0) {
			return res
				.status(422)
				.json({ message: 'No fields for update were provided' });
		}

		// Extract ID and Role from Token
		const userIdFromToken = await req.user._id;
		const userRoleFromToken = await req.user.role;

		const userIdFromParams = req.params.id;

		// Fetch the user to be updated
		const userToUpdate = await UserModel.findById(userIdFromParams);

		// Check if a non-superadmin is trying to edit an admin, prevent if so
		if (
			userToUpdate &&
			userToUpdate.role !== 'user' &&
			userRoleFromToken !== 'superadmin' &&
			userIdFromToken !== userIdFromParams
		) {
			return res.status(403).json({
				message:
					'You do not have the permissions necessary to perform this action',
			});
		}

		// Allow user to update their own data or, if user is an admin, to update any data
		if (
			userIdFromToken !== userIdFromParams &&
			userRoleFromToken !== 'admin' &&
			userRoleFromToken !== 'superadmin'
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// Data to be updated
		const updates = req.body;

		// Check if the user exists
		if (!userToUpdate) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Update the user fields
		if (updates.username !== undefined) {
			userToUpdate.username = updates.username;
		}
		if (updates.email !== undefined) {
			userToUpdate.email = updates.email;
		}
		if (updates.password !== undefined) {
			userToUpdate.password = updates.password;
		}
		if (updates.role !== undefined) {
			userToUpdate.role = updates.role;
		}
		if (updates.tips !== undefined) {
			userToUpdate.tips = updates.tips;
		}
		if (updates.contacts !== undefined) {
			userToUpdate.contacts = updates.contacts;
		}

		// Save the user
		const updatedUser = await userToUpdate.save();

		res.status(200).json({
			message: 'User updated',
			user: updatedUser,
		});
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to delete a user
export const deleteUser = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Extract the user ID and role from the token
		const userIdFromToken = req.user._id;
		const roleFromToken = req.user.role;
		const userIdFromParams = req.params.id;

		// Fetch the user to be deleted
		const userToDelete = await UserModel.findById(userIdFromParams);

		// Prevent a non-superadmin from deleting an admin
		if (
			userToDelete &&
			userToDelete.role !== 'user' &&
			roleFromToken !== 'superadmin' &&
			userIdFromToken !== userIdFromParams
		) {
			return res.status(403).json({
				message:
					'You do not have the permissions necessary to perform this action',
			});
		}

		// Allow a user to delete their own account ir, if the user is an admin or a superadmin, to delete any user account
		if (
			userIdFromToken !== userIdFromParams &&
			roleFromToken !== 'admin' &&
			roleFromToken !== 'superadmin'
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// Delete the user
		const deletedUser = await UserModel.findByIdAndDelete(userIdFromParams);

		// Check if the user was actually deleted
		if (!deletedUser) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.status(200).json({
			message: 'User deleted',
			user: deletedUser,
		});
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Enpoint to get a user
export const getUser = async (req: express.Request, res: express.Response) => {
	try {
		// Extract the user ID and role from the token
		const userIdFromToken = req.user._id;
		const userRoleFromToken = req.user.role;

		const userIdFromParams = req.params.id;

		// Deny the request if a user asks for data of another user and the requester is not an admin or a superadmin
		if (
			userIdFromToken !== userIdFromParams &&
			userRoleFromToken !== 'admin' &&
			userRoleFromToken !== 'superadmin'
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// Fetch the user from the database, omitting the password field
		const user: UserBase = await UserModel.findById(
			userIdFromParams
		).select('-password');
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Deny the request if an admin user asks for data of another admin or superadmin and the requester is not a superadmin
		if (
			user.role !== 'user' &&
			userRoleFromToken !== 'superadmin' &&
			userIdFromToken !== userIdFromParams
		) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		// Send the user data back in the response
		res.status(200).json({ user });
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);

		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to get contacts
export const getContacts = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const userIdFromToken = req.user._id;
		const userId = req.params.id;

		if (userIdFromToken !== userId) {
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
			});
		}

		const user: User = await UserModel.findById(userIdFromToken);

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const contactsPromises = user.contacts.map((contactId) =>
			UserModel.findById(contactId).then((userContact) => ({
				id: userContact?._id,
				username: userContact?.username,
				email: userContact?.email,
			}))
		);

		const userContacts = await Promise.all(contactsPromises);

		res.status(200).json({ userContacts });
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);

		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to get users from a same workspace
export const getUsers = async (req: express.Request, res: express.Response) => {
	try {
		const workspace: Workspace = await workspaceModel.findById(
			req.params.id
		);

		if (!req.user) {
			return res.status(401).json({ message: 'User not authenticated' });
		}

		if (!req.params.id) {
			return res.status(400).json({
				message: 'There is no workspace id in the request',
				id: req.params.id,
			});
		}

		if (!workspace) {
			return res.status(400).json({
				message: 'This workspace does not exist',
				id: req.params.id,
			});
		}

		if (
			!workspace.members.some((member) => member.userId === req.user._id)
		) {
			const userId = req.user._id;
			return res.status(403).json({
				message:
					'You do not have sufficient rights to perform this action',
				id: userId,
			});
		}

		const members = workspace.members;

		const users = members.forEach(async (member) => {
			const user = await UserModel.findById(member);
			const userData = {
				id: user?._id,
				username: user?.username,
				email: user?.email,
			};

			return userData;
		});

		res.status(200).json(users);
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);

		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to refresh JWT token
export const refreshUserToken = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Extract refresh token from the HttpOnly cookie
		const { refreshToken } = req.cookies;

		// If no refresh token is provided, return a 401 status
		if (!refreshToken) {
			return res
				.status(401)
				.json({ message: 'Refresh token not provided' });
		}

		// Attempt to find a refresh token in the database
		const savedRefreshToken = await refreshTokenModel.findOne({
			token: refreshToken,
		});

		// If no refresh token is found in the database, return a 404 status
		if (!savedRefreshToken) {
			return res.status(404).json({ message: 'Refresh token not found' });
		}

		// If a refresh token is found, validate it and generate a new JWT for the user
		const user: User = await UserModel.findById(savedRefreshToken.userId);
		if (user) {
			const token = user.generateAuthToken();

			// Generate a new refresh token
			const newRefreshToken = user.generateRefreshToken();

			// Delete the old refresh token from the database
			await refreshTokenModel.deleteOne({ token: refreshToken });

			// Store the new refresh token in the database
			const updatedRefreshToken = new refreshTokenModel({
				token: newRefreshToken,
				userId: user._id,
			});
			await updatedRefreshToken.save();

			// Set the new token and refresh token in HttpOnly cookies
			res.cookie('token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV !== 'development',
				sameSite: 'strict',
				path: '/',
			});

			res.cookie('refreshToken', newRefreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV !== 'development',
				sameSite: 'strict',
				path: '/users/token',
			});

			res.status(200).json({
				message: 'Token refresh successful',
			});
		} else {
			// If the user does not exist, return a 400 status
			res.status(400).json({ message: 'User not found' });
		}
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);
		res.status(500).json({ message: 'Internal server error' });
	}
};

export const logoutUser = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const { refreshToken, token } = req.cookies;

		if (refreshToken) {
			await refreshTokenModel.deleteOne({ token: refreshToken });
			res.clearCookie('refreshToken');
		}

		if (token) {
			res.clearCookie('token');
		}

		if (!refreshToken && !token) {
			return res.status(400).json({ message: 'No token to delete' });
		}

		res.status(200).json({ message: 'User logged out successfully' });
	} catch (err) {
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to obtain the user currently logged in
export const getMe = async (req: express.Request, res: express.Response) => {
	try {
		const userIdFromToken = req.user._id;

		const user: UserBase = await UserModel.findById(userIdFromToken).select(
			'-password'
		);

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.status(200).json({ user });
	} catch (err) {
		const result = (err as Error).message;
		logger.error(result);

		res.status(500).json({ message: 'Internal server error' });
	}
};

export const forgotPassword = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		// Retrieves the request email address
		const { email } = req.body;

		// Search user by email
		const user = await UserModel.findOne({ email });

		if (!user) {
			return res
				.status(404)
				.json({ message: 'User not found with this email address' });
		}

		// Generates a reset token
		const token = crypto.randomBytes(20).toString('hex');

		// Defines the token and its expiry date
		user.resetPasswordToken = token;
		user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

		await user.save();

		// Configure email sending
		let transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.GMAIL_USER,
				pass: process.env.GMAIL_PASS,
			},
		});

		let mailOptions = {
			from: process.env.GMAIL,
			to: user.email,
			subject: 'Réinitialisation de mot de passe Task Manager',
			html: `
			<div style="font-family: Arial, sans-serif; color: #333;">
			<p>Bonjour,</p>
			<p>Vous recevez cet email parce qu'une demande de réinitialisation du mot de passe de votre compte Task Manager a été reçue.</p>
			<p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le bouton ci-dessous :</p>
			<p><a href="${process.env.FRONTEND_URL}/pages/reset/${token}" style="background-color: #1a82e2; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a></p>
			<p>Ce lien est valide pour les prochaines 24 heures. Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email ou contacter notre support si vous avez des questions.</p>
			<p>Cordialement,</p>
			<p>L'équipe Task Manager</p>
		</div>
		
  `,
			text: `Bonjour,

			Vous recevez cet email parce qu'une demande de réinitialisation du mot de passe de votre compte Task Manager a été reçue.
			
			Pour réinitialiser votre mot de passe, copiez et collez le lien suivant dans votre navigateur :
			${process.env.FRONTEND_URL}/pages/reset/${token}
			
			Ce lien est valide pour les prochaines 24 heures. Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email ou contactez notre support si vous avez des questions.
			
			Cordialement,
			L'équipe Task Manager
			`,
		};

		transporter.sendMail(mailOptions, function (err) {
			if (err) {
				logger.error(err);
				return res.status(500).json({ message: 'Error sending email' });
			}
			res.status(200).json({
				message:
					'An email has been sent to ' +
					user.email +
					' with instructions.',
			});
		});
	} catch (error) {
		logger.error((error as Error).message);
	}
};

export const resetPassword = async (
	req: express.Request,
	res: express.Response
) => {
	try {
		const user = await UserModel.findOne({
			resetPasswordToken: req.params.token,
			resetPasswordExpires: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(404).send('Invalid or expired reset token.');
		}

		// Reset password
		user.password = req.body.password;
		user.resetPasswordToken = undefined;
		user.resetPasswordExpires = undefined;
		await user.save();

		res.send('Password successfully reset.');
	} catch (error) {
		logger.error((error as Error).message);
		res.status(500).send({ message: 'Internal server error' });
	}
};
