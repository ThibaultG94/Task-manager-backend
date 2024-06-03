import express from 'express';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import userModel from '../models/user.model';

export const createConversation = async (req: express.Request, res: express.Response) => {
  const { users, visitorConversation = false } = req.body;
  try {
    const newConversation = new Conversation({ users, messages: [], visitorConversation });
    await newConversation.save();
    res.status(201).json({ newConversation });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const getConversations = async (req: express.Request, res: express.Response) => {
  try {
    // Récupérer les utilisateurs bloqués par le user actuel
    const currentUser = await userModel.findById(req.user._id);
    const blockedUserIds = currentUser?.blocked || [];

    // Récupérer les conversations de l'utilisateur actuel
    const conversations = await Conversation.find({ users: req.user._id }).lean();
    if (!conversations) {
      return res.status(404).json({ message: 'Conversations not found' });
    }

    // Filtrer les conversations pour exclure celles contenant des utilisateurs bloqués
    const filteredConversations = conversations.filter(conversation => 
      !conversation.users.some(userId => blockedUserIds.includes(userId.toString()))
    );

    const userConversations = await Promise.all(filteredConversations.map(async (conversation) => {
      const users = await Promise.all(conversation.users.map(async (userId) => {
        const user = await userModel.findById(userId);
        return {
          _id: user?._id,
          username: user?.username,
          email: user?.email,
        };
      }));

      const messages = await Promise.all(conversation.messages.map(async (messageId) => {
        const message = await Message.findById(messageId);
        return {
          _id: message?._id,
          content: message?.message,
          senderId: message?.senderId,
          guestId: message?.guestId,
          conversationId: message?.conversationId,
          read: message?.read,
          createdAt: message?.createdAt,
        };
      }));

      return { ...conversation, users, messages };
    }));

    res.status(200).json({ userConversations });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const getConversationById = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  try {
    const conversation = await Conversation.findById(id)
      .populate('users')
      .populate('messages');
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.status(200).json(conversation);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const addMessageToConversation = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { content, senderId } = req.body;
  try {
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const newMessage = new Message({ content, senderId, conversationId: id });
    await newMessage.save();
    conversation.messages.push(newMessage._id.toString());
    conversation.lastMessage = content;
    await conversation.save();
    res.status(200).json(newMessage);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};
