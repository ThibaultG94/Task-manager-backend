import express from 'express';
import commentModel from '../models/comment.model';
import taskModel from '../models/task.model';
import userModel from '../models/user.model';

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

        const comments = await commentModel.find({ taskId, replyTo: null }).lean();

        const populateReplies = async (comment: any): Promise<any> => {
            const replies = await commentModel.find({ replyTo: comment._id.toString() }).lean();
            const populatedReplies = await Promise.all(replies.map(populateReplies));
            return {
                ...comment,
                replies: populatedReplies
            };
        };

        const commentsWithReplies = await Promise.all(comments.map(populateReplies));

        // Collect all unique userIds from comments and replies
        const userIds = new Set<string>();
        const collectUserIds = (comments: any[]) => {
            comments.forEach(comment => {
                userIds.add(comment.userId.toString());
                if (comment.replies && comment.replies.length > 0) {
                    collectUserIds(comment.replies);
                }
            });
        };

        collectUserIds(commentsWithReplies);

        // Fetch user details
        const users = await userModel.find({ _id: { $in: Array.from(userIds) } }).select('username email').lean();
        const userMap = new Map(users.map(user => [user._id.toString(), user]));

        // Add user details to comments and replies
        const addUserDetails = (comments: any[]): any[] => {
            return comments.map(comment => ({
                ...comment,
                user: userMap.get(comment.userId.toString()),
                replies: comment.replies ? addUserDetails(comment.replies) : []
            }));
        };

        const enrichedComments = addUserDetails(commentsWithReplies);

        res.status(200).json({ comments: enrichedComments });
    } catch (error) {
        console.error('An error occurred while retrieving comments:', error);
        res.status(500).json({ message: 'Internal server error', error });
    }
};
