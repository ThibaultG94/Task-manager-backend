import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		userId: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		members: [
			{
				userId: String,
				role: {
					type: String,
					enum: ['admin', 'superadmin', 'member', 'visitor'],
					default: 'member',
				},
			},
		],
		invitationStatus: [
			{
				userId: String,
				status: {
					type: String,
					enum: ['pending', 'declined', 'cancelled'],
					default: 'pending',
				},
			},
		],
		isDefault: {
			type: String,
			default: false,
		},
		lastUpdateDate: {
			type: Date,
			default: Date.now,
		},
		visitorWorkspace: {
			type: Boolean,
			default: false,
			required: false,
		},
	},
	{ timestamps: true }
);

// TTL index for visitor accounts
workspaceSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorWorkspace: true } // Applies only to documents where role is "visitor"
    }
);

workspaceSchema.index({ userId: 1 });

export default mongoose.model('workspace', workspaceSchema);
