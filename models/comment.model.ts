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
    }
});

export default mongoose.model('Comment', commentSchema);
