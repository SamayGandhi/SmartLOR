import express from 'express';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/', protect, getNotifications);
router.patch('/read-all', protect, markAllNotificationsRead);
router.patch('/:id/read', protect, markNotificationRead);
export default router;
