import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
	{
		creatorId: {
			type: String,
			ref: 'User',
			required: true,
		},
		invitationId: {
			type: String,
			ref: 'Invitation',
			required: false,
		},
		taskId: {
			type: String,
			ref: 'Task',
			required: false,
		},
		workspaceId: {
			type: String,
			ref: 'Workspace',
			required: false,
		},
		users: {
			type: [String],
			ref: 'User',
			required: false,
		},
		type: {
			type: String,
			enum: ['invitationUpdate', 'taskUpdate', 'workspaceUpdate', 'taskCreation', 'taskDelation', 'workspaceDelation', 'workspaceInvitation'],
			required: true,
		},
		message: {
			type: String,
			required: true,
		},
		read: {
			type: Boolean,
			default: false,
		},
		viewedAt: {
			type: Date,
			required: false,
		},
	},
	{ timestamps: true }
);

export default mongoose.model('notification', notificationSchema);
