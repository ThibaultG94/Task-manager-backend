import express from 'express';
import mongoose from 'mongoose';
import commentModel from '../models/comment.model';
import taskModel from '../models/task.model';

export const addComment = async (req: express.Request, res: express.Response) => {
    try {
        const { taskId, content } = req.body;
        const userId = req.user._id;

        const task = await taskModel.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const comment = new commentModel({
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

        const parentComment = await commentModel.findById(commentId);
        if (!parentComment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        const reply = new commentModel({
            taskId: parentComment.taskId,
            userId,
            content,
            replyTo: commentId
        });

        await reply.save();
        const task = await taskModel.findById(parentComment.taskId);

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.status(201).json({ message: 'Reply added successfully', reply });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

export const getCommentsByTaskId = async (req: express.Request, res: express.Response) => {
    try {
        const { taskId } = req.params;

        const comments = await commentModel.find({ taskId, replyTo: null })
            .populate('userId', 'username email')
            .exec();

        const populateReplies = async (comment: any): Promise<any> => {
            const replies = await commentModel.find({ replyTo: comment._id.toString() })
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