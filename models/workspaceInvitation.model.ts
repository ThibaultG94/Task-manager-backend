import mongoose from 'mongoose';

const workspaceInvitationSchema = new mongoose.Schema(
	{
		inviterId: { type: String, required: true },
		inviteeId: { type: String, required: true },
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
