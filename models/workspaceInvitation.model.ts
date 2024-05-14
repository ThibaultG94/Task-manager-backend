import mongoose from 'mongoose';

const workspaceInvitationSchema = new mongoose.Schema(
	{
		senderId: { type: String, required: true },
		guestId: { type: String, required: true },
		role: {
			type: String,
			enum: ['member', 'admin', 'superadmin'],
			default: 'member',
		},
		workspaceId: { type: String, required: true },
		status: {
			type: String,
			enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
			default: 'PENDING',
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
workspaceInvitationSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorWorkspace: true } // Applies only to documents where role is "visitor"
    }
);

export default mongoose.model('workspaceInvitation', workspaceInvitationSchema);
