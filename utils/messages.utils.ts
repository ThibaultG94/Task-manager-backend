import Message from "../models/message.model";

export const getMessagesCount = async (userId: string, contactId: string) => {
	const count = await Message.countDocuments({
		$or: [
			{ senderId: userId, guestId: contactId },
			{ senderId: contactId, guestId: userId },
		],
	});
	return count;
};