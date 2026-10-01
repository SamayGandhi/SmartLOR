import asyncHandler from 'express-async-handler';
import Feedback from '../models/Feedback.js';

export const submitFeedback = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) { res.status(400); throw new Error('Feedback cannot be empty'); }
  const feedback = await Feedback.create({ from: req.user._id, to: req.user._id, message: message.trim(), role: req.user.role === 'professor' ? 'professor' : 'student' });
  res.status(201).json(feedback);
});
