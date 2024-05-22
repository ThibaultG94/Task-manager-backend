import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    taskId: {
        type: String,
        ref: 'Task',
        required: true
    },
    userId: {
        type: String,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    replyTo: {
        type: String,
        ref: 'Comment',
        default: null
    },
    visitorComment: {
        type: Boolean,
        default: false,
        required: false,
    },
});

// TTL index for visitor accounts
commentSchema.index(
    { "createdAt": 1 },
    {
        expireAfterSeconds: 3600, // Documents expire after 3600 seconds (1 hour)
        partialFilterExpression: { visitorComment: true } // Applies only to documents where role is "visitor"
    }
);

export default mongoose.model('Comment', commentSchema);
