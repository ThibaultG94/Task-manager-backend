import { Request } from 'express';
import { Document } from 'mongoose';

// Define the structure of a Task object
// This interface describes the properties that a Task object will have in the application
export interface Task extends Document {
	title: string;
	userId: string;
	date?: string;
	description?: string;
	status: string;
	estimatedTime?: number;
	comments?: string;
	priority?: string;
	workspaceId: string;
	deadline?: string;
	assignedTo?: {
		email: string;
		userId: string;
		username: string;
	}[];
	archiveDate?: string;
}

export type ExtendedTask = Task & {
	numericPriority: number;
	createdAt: Date;
	updatedAt: Date;
};

export interface Workspace extends Document {
	title: string;
	userId: string;
	description: string;
	members: {
		userId: string;
		username: string;
		email: string;
	}[];
	isDefault: string;
}

export interface WorkspaceInvitation extends Document {
	inviterId: string;
	inviteeId: string;
	workspaceId: string;
	status: string[];
}

// Define the base structure of a User object
interface UserBase {
	[key: string]: any;
	username: string;
	email: string;
	password: string;
	role: string;
	tips: boolean;
	contacts: string[];
}

// Define a User object that extends UserBase and includes Mongoose Document capabilities
export interface User extends UserBase, Document {
	comparePasswords(candidatePassword: string): Promise<boolean>;
	generateAuthToken(): string;
}

// Define a UserDocument that extends UserBase and includes Mongoose Document capabilities
export interface UserDocument extends UserBase, Document {
	comparePasswords(candidatePassword: string): Promise<boolean>;
	generateAuthToken(): string;
}

// Define the payload structure of a User object
export interface UserPayload {
	_id: string;
	role: string;
}

export interface UserToken {
	email: string;
	_id: string;
}

// Extend the Request object from an express module
declare module 'express-serve-static-core' {
	interface Request {
		user?: {
			_id: string;
			role: string;
		};
	}
}
