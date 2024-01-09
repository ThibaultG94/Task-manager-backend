import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema(
	{
		senderId: { type: String, required: true },
		guestId: { type: String, required: true },
		message: { type: String },
		status: {
			type: String,
			enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
			default: 'PENDING',
		},
	},
	{ timestamps: true }
);

export default mongoose.model('invitation', invitationSchema);
