import TaskModel from '../models/task.model';
import workspaceModel from '../models/workspace.model';
import userModel from '../models/user.model';
import { FormatDateForDisplay } from './FormatDateForDisplay';
import { GetCategoryDay } from './GetCategoryDay';

type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

const priorityValues: { [key in Priority]: number } = {
	Urgent: 4,
	High: 3,
	Medium: 2,
	Low: 1,
};

export async function countTasksByStatus(workspaceId: string): Promise<Record<string, number>> {
    const taskCountByStatus = await TaskModel.aggregate([
        { $match: { workspaceId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts = taskCountByStatus.reduce<Record<string, number>>(
        (acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        },
        { Pending: 0, InProgress: 0, Completed: 0, Archived: 0 }
    );

    return statusCounts;
}

export async function fetchAndProcessTasks(userId: string, statusFilter: string) {
    const workspaces = await workspaceModel.find({ 'members.userId': userId }).lean();
    let allTasks = [];

    for (const workspace of workspaces) {
        const userInWorkspace = workspace.members.find(member => member.userId === userId);
        const role = userInWorkspace ? userInWorkspace.role : null;

        let tasks;
        if (role === 'admin' || role === 'superadmin') {
            tasks = await TaskModel.find({
                workspaceId: workspace._id,
                status: { $ne: 'Archived' }
            }).lean();
        } else {
            tasks = await TaskModel.find({
                workspaceId: workspace._id,
                $or: [
                    { userId: userId },
                    { assignedTo: userId }
                ],
                status: { $ne: 'Archived' }
            }).lean();
        }

        allTasks.push(...tasks);
    }

    let filteredTasks = [];

    if (['En retard', "Aujourd'hui", "Demain"].includes(statusFilter)) {
        // Filter tasks by specified status
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline as string);
            if (day === statusFilter) {
                filteredTasks.push(task);
            }
        }
    } else {
        for (const task of allTasks) {
            const day = await FormatDateForDisplay(task.deadline as string);
            const category = GetCategoryDay(day, task.status as string, task.deadline as string);
            if (category === statusFilter) {
                filteredTasks.push(task);
            }
        }
    }

    // Enrich tasks with user details
    const userTasks = await enrichTasksWithUserDetails(filteredTasks);

    // Sort tasks
    const sortedTasks = sortTasksByDateAndPriority(userTasks);
    
    return sortedTasks;
};


async function enrichTasksWithUserDetails(tasks: any[]) {
    const assignedUserIds = [...new Set(tasks.flatMap(task => task.assignedTo || []))];
    const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
        .select('email _id username')
        .lean();
    const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

    const commentUserIds = tasks.flatMap(task => task.comments ? task.comments.map((comment: any) => comment.userId) : []);
    const uniqueCommentUserIds = [...new Set(commentUserIds)];
    const commentUsersDetails = await userModel.find({ '_id': { $in: uniqueCommentUserIds } })
        .select('email _id username')
        .lean();
    const commentUserMap = new Map(commentUsersDetails.map(user => [user._id.toString(), user]));

    return tasks.map(task => ({
        ...task,
        assignedTo: (task.assignedTo || []).map((userId: string) => ({
            userId: userId,
            email: userMap.get(userId)?.email,
            username: userMap.get(userId)?.username
        })),
        comments: (task.comments || []).map((comment: any) => ({
            userId: comment.userId,
            email: commentUserMap.get(comment.userId)?.email,
            username: commentUserMap.get(comment.userId)?.username,
            message: comment.content,
            date: comment.createdAt
        }))
    }));
}

function sortTasksByDateAndPriority(tasks: any[]) {
    return tasks.sort((a, b) => {
        const deadlineA = new Date(a.deadline).getTime();
        const deadlineB = new Date(b.deadline).getTime();
        if (deadlineA !== deadlineB) {
            return deadlineA - deadlineB;
        }
        return priorityValues[b.priority as Priority] - priorityValues[a.priority as Priority];
    });
}