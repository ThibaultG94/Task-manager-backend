import express from 'express';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';

export const createConversation = async (req: express.Request, res: express.Response) => {
  const { users, visitorConversation = false } = req.body;
  try {
    const newConversation = new Conversation({ users, messages: [], visitorConversation });
    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const getConversations = async (req: express.Request, res: express.Response) => {
  try {
    const conversations = await Conversation.find({ users: req.user._id })
      .populate('users')
      .populate('messages');
    res.status(200).json(conversations);
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
