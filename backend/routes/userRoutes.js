import express from 'express';
import { getProfessors, getProfessorFilterOptions, getUsers, deleteUser } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
const router = express.Router();
router.get('/professors/options', protect, getProfessorFilterOptions);
router.get('/professors', protect, getProfessors);
router.get('/', protect, authorize('admin'), getUsers);
router.delete('/:id', protect, authorize('admin'), deleteUser);
export default router;
