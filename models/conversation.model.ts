import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
    {
        users: {
			type: [String],
			required: true,
		},
        messages: {
			type: [String],
			required: true,
		},
        lastMessage: {
            type: String,
            default: '',
        },
        visitorConversation: {
			type: Boolean,
			default: false,
			required: false,
		},
    },
    { timestamps: true }
);

// TTL index for visitor accounts
conversationSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorConversation: true } // Applies only to documents where role is "visitor"
    }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
