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
		userId: {
            type: String,
            ref: 'User',
            required: true,
        },
		type: {
			type: String,
			enum: ['invitationUpdate', 'taskUpdate', 'workspaceUpdate', 'taskCreation', 'taskDeletion', 'workspaceDeletion', 'workspaceInvitation'],
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
