import express from 'express';
import mongoose from 'mongoose';
import commentModel from '../models/comment.model';
import userModel from '../models/user.model';
import taskModel from '../models/task.model';

interface Comment extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    taskId: string;
    userId: string;
    content: string;
    createdAt: Date;
    replyTo: mongoose.Types.ObjectId | null;
    replies?: Comment[];
}

const enrichTaskWithCommentsAndUsers = async (task: any) => {
    const userMap = await getUserMap(task);
    const comments = await commentModel.find({ taskId: task._id.toString() }).lean();

    const commentUserIds = comments.map(comment => comment.userId);
    const uniqueCommentUserIds = [...new Set(commentUserIds)];
    const commentUsersDetails = await userModel.find({ '_id': { $in: uniqueCommentUserIds } })
        .select('email _id username')
        .lean();
    const commentUserMap = new Map(commentUsersDetails.map(user => [user._id.toString(), user]));

    const buildCommentTree = (comment: any, allComments: any[]): any => {
        const replies = allComments.filter(c => c.replyTo && c.replyTo.toString() === comment._id.toString());
        return {
            ...comment,
            _id: comment._id.toString() as unknown as mongoose.Types.ObjectId,
            replyTo: comment.replyTo ? comment.replyTo.toString() as unknown as mongoose.Types.ObjectId : null,
            replies: replies.map(reply => buildCommentTree(reply, allComments)),
            user: {
                userId: comment.userId,
                email: commentUserMap.get(comment.userId)?.email,
                username: commentUserMap.get(comment.userId)?.username
            }
        };
    };

    const commentsByTaskId = comments.reduce<{ [key: string]: any[] }>((acc, comment) => {
        if (comment.replyTo === null) {
            acc[comment.taskId] = acc[comment.taskId] || [];
            acc[comment.taskId].push(buildCommentTree(comment, comments));
        }
        return acc;
    }, {});

    return {
        ...task.toObject(),
        assignedTo: (task.assignedTo || []).map((userId: string) => ({
            userId: userId,
            email: userMap.get(userId)?.email,
            username: userMap.get(userId)?.username
        })),
        comments: commentsByTaskId[task._id.toString()] || []
    };
};

const getUserMap = async (task: any) => {
    const assignedUserIds = [...new Set((task.assignedTo || []).map((userId: string) => userId))];
    const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
        .select('email _id username')
        .lean();
    return new Map(usersDetails.map(user => [user._id.toString(), user]));
};

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
        const enrichedTask = await enrichTaskWithCommentsAndUsers(task);

        res.status(201).json({ message: 'Comment added successfully', task: enrichedTask });
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
        
        const enrichedTask = await enrichTaskWithCommentsAndUsers(task);

        res.status(201).json({ message: 'Reply added successfully', task: enrichedTask });
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