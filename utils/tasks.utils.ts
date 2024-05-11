import TaskModel from '../models/task.model';
import workspaceModel from '../models/workspace.model';
import userModel from '../models/user.model';
import { FormatDateForDisplay } from './FormatDateForDisplay';

export async function countTasksByStatus(workspaceId: string) {
    const taskCountByStatus = await TaskModel.aggregate([
        { $match: { workspaceId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts = taskCountByStatus.reduce(
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

        const query = {
            workspaceId: workspace._id,
            status: { $ne: 'Archived' },
            ...(
                role === 'admin' || role === 'superadmin' ? {} : { $or: [{ userId }, { assignedTo: userId }] }
            )
        };

        const tasks = await TaskModel.find(query).lean();
        allTasks.push(...tasks);
    }

    // Filter tasks by specified status
    const filteredTasks = allTasks.filter(async task => await FormatDateForDisplay(task.deadline) === statusFilter);

    // Enrich tasks with user details
    const userTasks = await enrichTasksWithUserDetails(filteredTasks);

    // Sort tasks
    const sortedTasks = sortTasksByDateAndPriority(userTasks);
    
    return sortedTasks;
};


async function enrichTasksWithUserDetails(tasks: any[]) {
    const assignedUserIds = [...new Set(tasks.flatMap(task => task.assignedTo))];
    const usersDetails = await userModel.find({ '_id': { $in: assignedUserIds } })
        .select('email _id username')
        .lean();
    const userMap = new Map(usersDetails.map(user => [user._id.toString(), user]));

    return tasks.map(task => ({
        ...task,
        assignedTo: task.assignedTo.map((userId: string) => ({
            userId: userId,
            email: userMap.get(userId)?.email,
            username: userMap.get(userId)?.username
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
        // Ajoute une logique pour comparer les priorités si nécessaire
        return 0; // Modifie cette ligne en fonction de la logique de comparaison de priorité
    });
}