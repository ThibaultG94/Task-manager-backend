import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
		senderId: { type: String, required: true },
		guestId: { type: String, required: true },
        conversationId: { type: String, required: true },
        message: { type: String, required: true },
        read: {
			type: Boolean,
			default: false,
		},
        visitorModel: {
            type: Boolean,
            default: false,
            required: false,
        },
    },
    { timestamps: true }
);

// TTL index for visitor accounts
messageSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorMessage: true } // Applies only to documents where role is "visitor"
    }
);

const Message = mongoose.model('Message', messageSchema);

export default Message;
