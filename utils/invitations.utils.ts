import invitationModel from '../models/invitation.model';
import userModel from '../models/user.model';

export async function fetchAndCategorizeSentInvitations(userId: string) {
    const invitations = await invitationModel.find({ senderId: userId }).sort({ createdAt: -1 });

    const invitationsInformations = await Promise.all(
        invitations.map(async (invitation) => {
            const guest = await userModel.findById(invitation.guestId);
            return {
                invitationId: invitation._id,
                guestEmail: guest?.email,
                guestUsername: guest?.username,
                message: invitation.message,
                status: invitation.status,
            };
        })
    );

    return categorizeSentInvitations(invitationsInformations);
}

function categorizeSentInvitations(invitations: any[]) {
    const invitationsPending = invitations.filter(invitation => invitation.status === 'PENDING' || invitation.status === 'REJECTED');
    const invitationsAccepted = invitations.filter(invitation => invitation.status === 'ACCEPTED');

    return {
        pending: invitationsPending,
        accepted: invitationsAccepted,
    };
}

export async function fetchAndCategorizeReceivedInvitations(userId: string) {
    const invitations = await invitationModel.find({ guestId: userId }).sort({ createdAt: -1 });

    const invitationsInformations = await Promise.all(
        invitations.map(async (invitation) => {
            const sender = await userModel.findById(invitation.senderId);
            return {
                invitationId: invitation._id,
                senderEmail: sender?.email,
                senderUsername: sender?.username,
                message: invitation.message,
                status: invitation.status,
            };
        })
    );

    return categorizeReceivedInvitations(invitationsInformations);
}

function categorizeReceivedInvitations(invitations: any[]) {
    const invitationsPending = invitations.filter(invitation => invitation.status === 'PENDING');
    const invitationsAccepted = invitations.filter(invitation => invitation.status === 'ACCEPTED');
    const invitationsRejected = invitations.filter(invitation => invitation.status === 'REJECTED');

    return {
        pending: invitationsPending,
        accepted: invitationsAccepted,
        rejected: invitationsRejected,
    };
}
