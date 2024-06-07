import { Request, Response } from 'express';
import Message from '../models/message.model';
import { messageNamespace } from '../server';
import Conversation from '../models/conversation.model';

// Create a message
export const createMessage = async (req: Request, res: Response) => {
  try {
    const { senderId, guestId, conversationId, message } = req.body;
    const newMessage = new Message({ senderId, guestId, conversationId, message, read: false });
    await newMessage.save();

    await Conversation.findByIdAndUpdate(conversationId, {
      $push: { messages: newMessage._id },
      lastMessage: newMessage._id
    });

    messageNamespace.to(guestId).emit('receive_message', {
      ...newMessage.toObject(),
      content: newMessage.message,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};

// Retrieve all messages
export const getMessages = async (req: Request, res: Response) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 });
    res.status(200).json(messages);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};

// Mark a message as read
export const readMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByIdAndUpdate(messageId, { read: true });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    messageNamespace.to(message.senderId).emit('message_read', {
      messageId,
      userId: message.senderId,
    });

    res.status(200).json({ message });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};
