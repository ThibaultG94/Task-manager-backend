import commentModel from '../models/comment.model';
import userModel from '../models/user.model';

export const enrichCommentsWithUserDetails = async (comments: any[]) => {
    const userIds = new Set<string>();
    const collectUserIds = (comments: any[]) => {
        comments.forEach(comment => {
            userIds.add(comment.userId.toString());
            if (comment.replies && comment.replies.length > 0) {
                collectUserIds(comment.replies);
            }
        });
    };

    collectUserIds(comments);

    // Fetch user details
    const users = await userModel.find({ _id: { $in: Array.from(userIds) } }).select('username email').lean();
    const userMap = new Map(users.map(user => [user._id.toString(), user]));

    // Add user details to comments and replies
    const addUserDetails = (comments: any[]): any[] => {
        return comments.map(comment => ({
            ...comment,
            user: userMap.get(comment.userId.toString()),
            replies: comment.replies ? addUserDetails(comment.replies) : []
        }));
    };

    return addUserDetails(comments);
};

export const getCommentsWithReplies = async (taskId: string) => {
    const comments = await commentModel.find({ taskId, replyTo: null }).lean();

    const populateReplies = async (comment: any): Promise<any> => {
        const replies = await commentModel.find({ replyTo: comment._id.toString() }).lean();
        const populatedReplies = await Promise.all(replies.map(populateReplies));
        return {
            ...comment,
            replies: populatedReplies
        };
    };

    const commentsWithReplies = await Promise.all(comments.map(populateReplies));
    return enrichCommentsWithUserDetails(commentsWithReplies);
};
