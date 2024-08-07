import workspaceModel from '../models/workspace.model';
import userModel from '../models/user.model';
import mongoose from 'mongoose';
import { countTasksByStatus } from './tasks.utils';

type UserInfo = {
    username: string,
    email: string,
    avatar: string
};

interface EnrichedWorkspace extends mongoose.Document {
    title: string;
    userId: string;
    members: {
        role: "admin" | "superadmin" | "member";
        userId?: string;
    }[];
    invitationStatus: any[];
    isDefault: string;
    lastUpdateDate: Date;
    description?: string;
    taskStatusCounts?: Record<string, number>;
}

export async function fetchAndEnrichUserWorkspaces(userId: string) {
    let workspaces: EnrichedWorkspace[] = await workspaceModel
        .find({
            $or: [{ userId }, { 'members.userId': userId }],
        })
        .sort({ lastUpdateDate: -1 })
        .lean();

    const memberIds = [
        ...new Set(
            workspaces.flatMap((workspace) =>
                workspace.members.map((member) => member.userId.toString())
            )
        ),
    ];

    const users = await userModel
        .find({
            _id: { $in: memberIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
        .select('email _id username avatar')
        .lean();

    const usersMap = users.reduce<{ [key: string]: UserInfo }>(
        (acc, user) => {
            acc[user._id.toString()] = {
                username: user.username,
                email: user.email,
                avatar: user.avatar,
            };
            return acc;
        },
        {}
    );

    const sortMembersByRole = (members: any[]) => {
        const roleOrder: { [key: string]: number } = { superadmin: 1, admin: 2, member: 3 };
        return members.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
    };
    
    for (let workspace of workspaces) {
        const statusCounts = await countTasksByStatus(workspace._id.toString());
        const enrichedMembers = workspace.members.map((member) => {
            const userInfo = usersMap[member.userId.toString()];
            return {
                userId: member.userId,
                role: member.role,
                username: userInfo?.username,
                email: userInfo?.email,
                avatar: userInfo?.avatar,
            };
        });

        // Sort enriched members by role
        workspace.members = sortMembersByRole(enrichedMembers);
        workspace.taskStatusCounts = statusCounts;
    }

    return workspaces;
}

// Function to get the number of common workspaces
export const getCommonWorkspacesCount = async (userId: string, contactId: string) => {
	const workspaces = await workspaceModel.find({
		'members.userId': { $all: [userId, contactId] },
	});
	return workspaces.length;
};