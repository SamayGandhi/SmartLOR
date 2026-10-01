import express from 'express';
import { getStats, verifyProfessor, downloadProfessorVerificationDocument } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/stats', protect, authorize('admin'), getStats);
router.patch('/professors/:id/verification', protect, authorize('admin'), verifyProfessor);
router.get('/professors/:id/documents/:documentId', protect, authorize('admin'), downloadProfessorVerificationDocument);
export default router;
