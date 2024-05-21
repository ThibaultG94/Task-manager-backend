import express from 'express';
import commentModel from '../models/comment.model';
import taskModel from '../models/task.model';
import { getCommentsWithReplies } from '../utils/comments.utils';

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

        const enrichedComments = await getCommentsWithReplies(taskId);

        res.status(201).json({ message: 'Comment added successfully', comments: enrichedComments });
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

        const enrichedComments = await getCommentsWithReplies(parentComment.taskId);

        res.status(201).json({ message: 'Reply added successfully', comments: enrichedComments });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

export const getCommentsByTaskId = async (req: express.Request, res: express.Response) => {
    try {
        const { taskId } = req.params;

        const enrichedComments = await getCommentsWithReplies(taskId);

        res.status(200).json({ comments: enrichedComments });
    } catch (error) {
        console.error('An error occurred while retrieving comments:', error);
        res.status(500).json({ message: 'Internal server error', error });
    }
};