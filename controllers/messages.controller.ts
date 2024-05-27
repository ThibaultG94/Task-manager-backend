import { Request, Response } from 'express';
import Message from '../models/message.model';

// Create a message
export const createMessage = async (req: Request, res: Response) => {
  try {
    const { senderId, guestId, message } = req.body;
    const newMessage = new Message({ senderId, guestId, message });
    await newMessage.save();
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

// Make a message as read
export const readMessage = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findByIdAndUpdate(messageId, { read: true });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    res.status(200).json({ message });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};