import { Request, Response } from 'express';
import Message from '../models/message.model';

// Create a message
export const createMessage = async (req: Request, res: Response) => {
  try {
    const { user, message } = req.body;
    const newMessage = new Message({ user, message });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};

// Récupérer tous les messages
export const getMessages = async (req: Request, res: Response) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 });
    res.status(200).json(messages);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};
