// workspace.utils.ts
import workspaceInvitationModel from '../models/workspaceInvitation.model';
import userModel from '../models/user.model';
import workspaceModel from '../models/workspace.model';

export async function fetchAndProcessWorkspaceInvitations(senderId: string) {
    const currentUser = await userModel.findById(senderId);
    const blockedUserIds = currentUser?.blocked || [];
  
    const invitationsSentOut = await workspaceInvitationModel.find({
      senderId: senderId,
    }).sort({ createdAt: -1 }).lean();
  
    const filteredInvitations = invitationsSentOut.filter(invitation =>
      !blockedUserIds.includes(invitation.guestId.toString())
    );
  
    const invitationsInformations = await Promise.all(
      filteredInvitations.map(async (invitation) => {
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
  
  export async function fetchAndProcessReceivedWorkspaceInvitations(guestId: string) {
    const currentUser = await userModel.findById(guestId);
    const blockedUserIds = currentUser?.blocked || [];
  
    const invitationsReceived = await workspaceInvitationModel.find({
      guestId: guestId,
    }).sort({ createdAt: -1 }).lean();
  
    const filteredInvitations = invitationsReceived.filter(invitation =>
      !blockedUserIds.includes(invitation.senderId.toString())
    );
  
    const invitationsInformations = await Promise.all(
      filteredInvitations.map(async (invitation) => {
        const sender = await userModel.findById(invitation.senderId);
        const workspace = await workspaceModel.findById(invitation.workspaceId);
        if (!sender || !workspace) {
          throw new Error('Sender or workspace does not exist');
        }
        return {
          invitationId: invitation._id,
          senderEmail: sender.email,
          senderUsername: sender.username,
          role: invitation.role,
          status: invitation.status,
          workspaceName: workspace.title,
          workspace,
        };
      })
    );
  
    const invitationsPending = invitationsInformations.filter(
      (invitation) => invitation.status === 'PENDING'
    );
    const invitationsAccepted = invitationsInformations.filter(
      (invitation) => invitation.status === 'ACCEPTED'
    );
    const invitationsRejected = invitationsInformations.filter(
      (invitation) => invitation.status === 'REJECTED'
    );
  
    return {
      pending: invitationsPending,
      accepted: invitationsAccepted,
      rejected: invitationsRejected,
    };
  }
  