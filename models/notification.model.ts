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
			enum: ['invitationUpdate', 'taskUpdate', 'workspaceUpdate', 'taskCreation', 'taskDeletion', 'workspaceDeletion', 'workspaceInvitation', "newComment", "replycomment"],
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
		visitorNotification: {
			type: Boolean,
			default: false,
			required: false,
		},
	},
	{ timestamps: true }
);

// TTL index for visitor accounts
notificationSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorNotification: true } // Applies only to documents where role is "visitor"
    }
);

export default mongoose.model('notification', notificationSchema);
