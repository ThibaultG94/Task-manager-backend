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
			enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
			default: 'PENDING',
		},
	},
	{ timestamps: true }
);

export default mongoose.model('workspaceInvitation', workspaceInvitationSchema);
