// workspace.utils.ts
import workspaceInvitationModel from '../models/workspaceInvitation.model';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';

export async function fetchAndProcessWorkspaceInvitations(senderId: string) {
    const invitationsSentOut = await workspaceInvitationModel.find({
        senderId: senderId,
    }).sort({ createdAt: -1 }).lean();

    const invitationsInformations = await Promise.all(
        invitationsSentOut.map(async (invitation) => {
            const guest = await userModel.findById(invitation.guestId);
            const workspace = await workspaceModel.findById(invitation.workspaceId);
            if (!guest || !workspace) {
                throw new Error('Guest or workspace does not exist');
            }
            return {
                invitationId: invitation._id,
                guestEmail: guest.email,
                guestUsername: guest.username,
                role: invitation.role,
                status: invitation.status,
                workspaceName: workspace.title,
                workspace,
            };
        })
    );

    const invitationsPending = invitationsInformations.filter(
        (invitation) => invitation.status === 'PENDING' || invitation.status === 'REJECTED'
    );
    const invitationsAccepted = invitationsInformations.filter(
        (invitation) => invitation.status === 'ACCEPTED'
    );

    return {
        pending: invitationsPending,
        accepted: invitationsAccepted,
    };
}
