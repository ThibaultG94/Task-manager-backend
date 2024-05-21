import express from 'express';
import commentModel from '../models/comment.model';
import taskModel from '../models/task.model';
import userModel from '../models/user.model';
import { getCommentsWithReplies } from '../utils/comments.utils';
import workspaceModel from '../models/workspace.model';

export const addComment = async (req: express.Request, res: express.Response) => {
    try {
        const { taskId, content } = req.body;
        const userId = req.user._id;
        const user = await userModel.findById(userId);
        const isVisitor = user.role === 'visitor';

        const task = await taskModel.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Find the workspace by ID
		const workspace = await workspaceModel.findById(task.workspaceId);

        if (!workspace) {
			return res
				.status(400)
				.json({ message: 'This workspace does not exist' });
		}

        const isSuperAdmin = workspace.members.some(
			(member) =>
				member.userId === userId &&
				member.role === 'superadmin'
		);
		const isAdmin = workspace.members.some(
			(member) =>
				member.userId === userId &&
				member.role === 'admin'
		);
		const isTaskOwner = task.userId === userId;
        const isAssigned = task.assignedTo.some(
            (assignedId) => assignedId === userId
        );

        // Check if the user making the request is a member of the workspace
		if (task && !workspace.members.some((member) => member.userId === req.user._id) && req.user._id !== workspace.userId){
			return res.status(403).json({
				message:
					'You do not have sufficients rights to perform this action',
			});
		}

        const comment = new commentModel({
            taskId,
            userId,
            content
        });

        await comment.save();

        const membersToNotify = workspace.members.filter(
            (member) => member.userId !== userId
        );

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