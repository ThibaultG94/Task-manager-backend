import UserModel from '../models/user.model';
import express from 'express';
import bcrypt from 'bcryptjs';
import { User, UserBase } from '../types/types';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { notificationNamespace } from '../server';
import refreshTokenModel from '../models/refreshToken.model';
import workspaceModel from '../models/workspace.model';
import { Workspace } from '../types/types';
import logger from '../config/logger';
import invitationModel from '../models/invitation.model';
import jwt from 'jsonwebtoken';
import taskModel from '../models/task.model';
import workspaceInvitationModel from '../models/workspaceInvitation.model';
import notificationModel from '../models/notification.model';
import { getMessagesCount } from '../utils/messages.utils';
import { getCommonWorkspacesCount } from '../utils/workspaces.utils';

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
					role: 'superadmin',
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

// Endpoint to create a temporary visitor session
export const createVisitorSession = async (req: express.Request, res: express.Response) => {
	try {
		// Create a temporary user with visitor role
		const tempUser = new UserModel({
			username: 'Visitor_' + Date.now(),
			email: `visitor_${Date.now()}@tempmail.com`,
			password: bcrypt.hashSync('visitor', 10),
			role: 'visitor',
		});
		await tempUser.save();

		// Generate token with shorter expiration
		const token = jwt.sign(
			{
				_id: tempUser._id.toHexString(),
				role: tempUser.role
			},
			process.env.JWT_SECRET as string,
			{
				expiresIn: '1h'  // 1 hour validity
			}
		);

		// Find the user which is an admin
		const superAdminUser = await UserModel.findOne({ role: 'superadmin' });
		const workspaceId = "66432773c64f1dbf12d7fcbb";
		const workspace = await workspaceModel.findById(workspaceId);

		const workspaceInvitation = new workspaceInvitationModel({
			senderId: superAdminUser?._id,
			guestId: tempUser._id.toString(),
			role: "member",
			workspaceId,
			status: 'PENDING',
			visitorWorkspace: true,
		});

		workspace.invitationStatus.push({
			userId: tempUser._id.toString(),
			status: 'pending',
		});

		const notification = new notificationModel({
			creatorId: superAdminUser?._id,
			invitationId: workspaceInvitation._id,
			type: 'workspaceInvitation',
			message: `${superAdminUser.username} vous a envoyé une invitation a rejoindre le workspace ${workspace.title} en tant que membre.`,
			userId: tempUser._id.toString(),
			workspaceId: workspaceId,
			visitorNotification: true,
		});

		await notification.save();

		const notifToEmit = {
			...notification.toObject(),
			creatorUsername: tempUser.username,
		};
		
		// Emit notification via Socket.io
		notificationNamespace.to(tempUser._id.toString()).emit('new_notification', notifToEmit);

		await workspaceInvitation.save();
		await workspace.save();

		const firstWorkspace = new workspaceModel({
			title: 'Visitor Workspace',
			userId: tempUser._id,
			description: 'Cet espace est temporaire pour les visiteurs.',
			members: [
				{
					userId: tempUser._id,
					username: tempUser.username,
					email: tempUser.email,
					role: 'admin',
				},
			],
			isDefault: true,
			visitorWorkspace: true,
		});

		await firstWorkspace.save();
		const firstWorkspaceId = firstWorkspace._id;

		if (!firstWorkspaceId) {
			return res.status(400).json({ message: 'Error with firstWorkspaceID' });
		}

		const dateTod = new Date();
		const dateTom = new Date(dateTod);
		dateTom.setDate(dateTod.getDate() + 1);
		const dateToday = dateTod.toISOString().split('T')[0];
		const dateTomorrow = dateTom.toISOString().split('T')[0];

		const firstTask = new taskModel({
			title: 'Validez votre première Tâche',
			workspaceId: firstWorkspaceId,
			userId: tempUser._id,
			description: "Ceci est votre première tâche. Cliquez sur le bouton 'Editer' pour la modifier. Vous pouvez valider la tâche en mettant le status sur 'Archivé'. Vous pouvez également archiver la tâche rapidement en cliquant sur le bouton sur l'icône de validation à droite dans le bloc Tâches Urgentes de la page Dasboard, ou dans chaque bloc de la page Tasks.",
			status: 'Pending',
			deadline: dateToday,
			priority: 'Urgent',
			assignedTo: [tempUser._id],
			visitorTask: true,
		});

		const secondTask = new taskModel({
			title: 'Créez votre premier Workspace',
			workspaceId: firstWorkspaceId,
			userId: tempUser._id,
			description: "Dans la sidebar à gauche, cliquez sur l'icône '+' et sélectionnez l'onglet Workspace. Vous pouvez maintenant créer votre premier Workspace !",
			status: 'Pending',
			deadline: dateToday,
			priority: 'High',
			assignedTo: [tempUser._id],
			visitorTask: true,
		});

		const thirdTask = new taskModel({
			title: 'Créez votre première Tâche',
			workspaceId: firstWorkspaceId,
			userId: tempUser._id,
			description: "Dans la sidebar à gauche, cliquez sur l'icône '+' et restez sur l'onglet Tâches. Vous pouvez maintenant créer votre première tâche !",
			status: 'Pending',
			deadline: dateToday,
			priority: 'Medium',
			assignedTo: [tempUser._id],
			visitorTask: true,
		});

		const fourthTask = new taskModel({
			title: 'Checkez vos notifications',
			workspaceId: firstWorkspaceId,
			userId: tempUser._id,
			description: "En haut à droite de la page, vous pouvez voir une icône de cloche. Cliquez dessus pour voir vos notifications. Vous avez une notification de la part de l'administrateur du site.",
			status: 'Pending',
			deadline: dateTomorrow,
			priority: 'Urgent',
			assignedTo: [tempUser._id],
			visitorTask: true,
		});

		const fifthTask = new taskModel({
			title: 'Ajoutez un contact',
			workspaceId: firstWorkspaceId,
			userId: tempUser._id,
			description: "Dans la sidebar à gauche, cliquez sur l'icône d'ajout de contact et sélectionnez l'onglet 'Ajouter un contact'. Vous pouvez maintenant m'ajouter avec mon email thibault.guilhem@gmail.com !",
			status: 'Pending',
			deadline: dateToday,
			priority: 'Low',
			assignedTo: [tempUser._id],
			visitorTask: true,
		});

		const sixthTask = new taskModel({
			title: 'Rejoignez un Workspace',
			workspaceId: firstWorkspaceId,
			userId: tempUser._id,
			description: "Dans la sidebar à gauche, cliquez sur l'icône '+' et restez sur l'onglet Tâches. Vous pouvez maintenant créer votre première tâche !",
			status: 'Pending',
			deadline: dateTomorrow,
			priority: 'High',
			assignedTo: [tempUser._id],
			visitorTask: true,
		});

		await firstTask.save();
		await secondTask.save();
		await thirdTask.save();
		await fourthTask.save();
		await fifthTask.save();
		await sixthTask.save();

		// Send back the token
		return res.status(200).json({
			message: 'Visitor session created',
			token: token,
			tempUser: {
				id: tempUser._id,
				username: tempUser.username,
				email: tempUser.email,
				role: tempUser.role
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Internal server error', error });
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

      const newRefreshToken = new refreshTokenModel({
        token: refreshToken,
        userId: user._id,
      });
      await newRefreshToken.save();

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
      });

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
		const userIdFromParams = req.params.id;

		// Fetch the user from the database, omitting the password field
		const user: UserBase = await UserModel.findById(
			userIdFromParams
		).select('-password');
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
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

		const user: User = await UserModel.findById(userIdFromToken.toString());

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const contactsPromises = user.contacts.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId.toString());
			const messagesCount = await getMessagesCount(userIdFromToken.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userIdFromToken.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userContacts = await Promise.all(contactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userContacts = userContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})

		res.status(200).json({ userContacts });
	} catch (err) {
		const result = "result: " + (err as Error).message;
		logger.error(result);

		res.status(500).json({ message: 'Internal server error' });
	}
};

// Endpoint to get blocked contacts
export const getBlockedContacts = async (
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

		const user: User = await UserModel.findById(userIdFromToken.toString());

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const blockedContactsPromises = user.blocked.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId.toString());
			const messagesCount = await getMessagesCount(userIdFromToken.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userIdFromToken.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userBlockedContacts = await Promise.all(blockedContactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userBlockedContacts = userBlockedContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})

		res.status(200).json({ userBlockedContacts });
	} catch (err) {
		const result = "result: " + (err as Error).message;
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

export const deleteContact = async (req: express.Request, res: express.Response) => {
    try {
        const userId = req.user._id;
        const contactId = req.params.contactId;

        const user: User = await UserModel.findById(userId);
		if (!user.contacts.map(contact => contact.toString()).includes(contactId)) {
			console.log("Contact non trouvé dans les contacts de l'utilisateur.");
			return res.status(404).send({ message: 'Contact not found' });
		}
		
		const contact: User = await UserModel.findById(contactId);
		if (!contact.contacts.map(contact => contact.toString()).includes(userId)) {
			console.log("Contact non trouvé dans les contacts de l'utilisateur.");
			return res.status(404).send({ message: 'Contact not found' });
		}

		user.contacts = user.contacts.filter((contact) => contact.toString() !== contactId);
		contact.contacts = contact.contacts.filter((contact) => contact.toString() !== userId);

		await user.save();
		await contact.save();


        // Search invitation and delete it
		await invitationModel.findOneAndDelete({
			$or: [
				{ senderId: userId, guestId: contactId },
				{ senderId: contactId, guestId: userId }
			]
		});		

        const contactsPromises = user.contacts.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId.toString());
			const messagesCount = await getMessagesCount(userId.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userId.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userContacts = await Promise.all(contactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userContacts = userContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})

		res.status(200).json({ userContacts });
    } catch (error) {
		const result = (error as Error).message;
        logger.error(result);
        res.status(500).send({ message: 'Internal server error', details: result.toString() });
    }
};

export const blockContact = async (req: express.Request, res: express.Response) => {
	try {
		const userId = req.user._id;
		const contactId = req.params.contactId;

		const user = await UserModel.findById(userId);
		if (!user) {
			return res.status(404).send({ message: 'User not found' });
		}
		if (!user.contacts.map(contact => contact.toString()).includes(contactId)) {
			return res.status(404).send({ message: 'Contact not found' });
		}
		// add contact to blocked contacts
		user.blocked.push(contactId);
		// remove contact from contacts
		user.contacts = user.contacts.filter((contact) => contact.toString() !== contactId);

		await user.save();

		const contactsPromises = user.contacts.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId.toString());
			const messagesCount = await getMessagesCount(userId.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userId.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userContacts = await Promise.all(contactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userContacts = userContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})

		const blockedContactsPromises = user.blocked.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId);
			const messagesCount = await getMessagesCount(userId.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userId.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userBlockedContacts = await Promise.all(blockedContactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userBlockedContacts = userBlockedContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})

		res.status(200).json({ userContacts, userBlockedContacts });
	} catch (error) {
		const result = (error as Error).message;
		logger.error(result);
		res.status(500).send({ message: 'Internal server error' });
	}
};

export const unBlockContact = async (req: express.Request, res: express.Response) => {
	try {
		const userId = req.user._id;
		const contactId = req.params.contactId;

		const user = await UserModel.findById(userId);
		if (!user) {
			return res.status(404).send({ message: 'User not found' });
		}
		if (!user.blocked.map(contact => contact.toString()).includes(contactId)) {
			return res.status(404).send({ message: 'Contact not found' });
		}
		// remove contact from blocked contacts
		user.blocked = user.blocked.filter((contact) => contact.toString() !== contactId);
		// add contact to contacts
		user.contacts.push(contactId);

		await user.save();

		const contactsPromises = user.contacts.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId.toString());
			const messagesCount = await getMessagesCount(userId.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userId.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userContacts = await Promise.all(contactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userContacts = userContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})


		const blockedContactsPromises = user.blocked.map(async (contactId: any) => {
			const contact = await UserModel.findById(contactId);
			const messagesCount = await getMessagesCount(userId.toString(), contactId.toString());
			const commonWorkspacesCount = await getCommonWorkspacesCount(userId.toString(), contactId.toString());

			return {
				id: contact?._id,
				username: contact?.username,
				email: contact?.email,
				messagesCount,
				commonWorkspacesCount,
			};
		});

		let userBlockedContacts = await Promise.all(blockedContactsPromises);

		// Sort by messagesCount and commonWorkspacesCount
		userBlockedContacts = userBlockedContacts.sort((a, b) => {
			if (b.messagesCount !== a.messagesCount) {
				return b.messagesCount - a.messagesCount;
			}
			return b.commonWorkspacesCount - a.commonWorkspacesCount;
		})

		res.status(200).json({ userContacts, userBlockedContacts });
	} catch (error) {
		const result = (error as Error).message;
		logger.error(result);
		res.status(500).send({ message: 'Internal server error' });
	}
};