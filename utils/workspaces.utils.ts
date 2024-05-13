import workspaceModel from '../models/workspace.model';
import userModel from '../models/user.model';
import mongoose from 'mongoose';
import { countTasksByStatus } from './tasks.utils';

type UserInfo = {
    username: string,
    email: string
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
        .select('email _id username')
        .lean();

    const usersMap = users.reduce<{ [key: string]: UserInfo }>(
        (acc, user) => {
            acc[user._id.toString()] = {
                username: user.username,
                email: user.email,
            };
            return acc;
        },
        {}
    );
    
    for (let workspace of workspaces) {
        const statusCounts = await countTasksByStatus(workspace._id.toString());
        const enrichedMembers = workspace.members.map((member) => {
            const userInfo = usersMap[member.userId.toString()];
            return {
                userId: member.userId,
                role: member.role,
                username: userInfo?.username,
                email: userInfo?.email,
            };
        });
        workspace.members = enrichedMembers;
        workspace.taskStatusCounts = statusCounts;
    }

    return workspaces;
}