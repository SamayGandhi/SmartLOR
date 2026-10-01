import asyncHandler from 'express-async-handler';
import Notification from '../models/Notification.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 60);
  const includeRead = req.query.history === 'true';
  const filter = { recipient: req.user._id };
  if (!includeRead) filter.readAt = null;
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
  res.json({ items, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) { res.status(404); throw new Error('Notification not found'); }
  res.json(notification);
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ message: 'All notifications marked as read' });
});

export const createNotification = async ({ recipient, actor = null, request = null, type, title, message, link = '' }) => {
  if (!recipient) return null;
  try { return await Notification.create({ recipient, actor, request, type, title, message, link }); }
  catch (error) { console.error('SmartLOR notification error:', error.message); return null; }
};
