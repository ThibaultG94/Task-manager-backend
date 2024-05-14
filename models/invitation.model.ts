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
		visitorInvitation: {
			type: Boolean,
			default: false,
			required: false,
		},
	},
	{ timestamps: true }
);

// TTL index for visitor accounts
invitationSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorInvitation: true } // Applies only to documents where role is "visitor"
    }
);

export default mongoose.model('invitation', invitationSchema);
