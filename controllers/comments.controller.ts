import express from 'express';
import mongoose from 'mongoose';
import Comment from '../models/comment.model';
import Task from '../models/task.model';

interface Comment extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    taskId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    content: string;
    createdAt: Date;
    replyTo: mongoose.Types.ObjectId | null;
    replies?: Comment[];
}

export const addComment = async (req: express.Request, res: express.Response) => {
    try {
        const { taskId, content } = req.body;
        const userId = req.user._id;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const comment = new Comment({
            taskId,
            userId,
            content
        });

        await comment.save();
        res.status(201).json({ message: 'Comment added successfully', comment });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

export const addReply = async (req: express.Request, res: express.Response) => {
    try {
        const { commentId, content } = req.body;
        const userId = req.user._id;

        const parentComment = await Comment.findById(commentId);
        if (!parentComment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        const reply = new Comment({
            taskId: parentComment.taskId,
            userId,
            content,
            replyTo: commentId
        });

        await reply.save();
        res.status(201).json({ message: 'Reply added successfully', reply });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

export const getCommentsByTaskId = async (req: express.Request, res: express.Response) => {
    try {
        const { taskId } = req.params;

        const comments = await Comment.find({ taskId, replyTo: null })
            .populate('userId', 'username email')
            .exec();

        const populateReplies = async (comment: any): Promise<any> => {
            const replies = await Comment.find({ replyTo: comment._id.toString() })
                .populate('userId', 'username email')
                .exec();
            return {
                ...comment.toObject(),
                replies: await Promise.all(replies.map(populateReplies))
            };
        };

        const commentsWithReplies = await Promise.all(comments.map(populateReplies));

        res.status(200).json({ comments: commentsWithReplies });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};