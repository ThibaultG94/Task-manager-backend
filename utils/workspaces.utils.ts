// workspace.utils.ts
import workspaceModel from '../models/workspace.model';
import userModel from '../models/user.model';
import mongoose from 'mongoose';

type UserInfo = {
    username: string,
    email: string
};

export async function fetchAndEnrichUserWorkspaces(userId: string) {
    let workspaces = await workspaceModel
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

    workspaces = workspaces.map((workspace) => {
        const enrichedMembers = workspace.members.map((member) => {
            const userInfo = usersMap[member.userId.toString()];
            return {
                userId: member.userId,
                role: member.role,
                username: userInfo?.username,
                email: userInfo?.email,
            };
        });
        return { ...workspace, members: enrichedMembers };
    });

    return workspaces;
}
