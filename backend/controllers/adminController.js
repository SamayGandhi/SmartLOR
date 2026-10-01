import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Request from '../models/Request.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNotification } from './notificationController.js';

const filePathFor = (storedName) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', storedName);

export const getStats = asyncHandler(async (req, res) => {
  const [students, professors, admins, totalRequests, pending, approved, rejected, completed, verificationPending, verified, professorVerificationPending, professorVerified, professorRejected] = await Promise.all([
    User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'professor' }), User.countDocuments({ role: 'admin' }),
    Request.countDocuments(), Request.countDocuments({ status: 'pending' }), Request.countDocuments({ status: 'approved' }),
    Request.countDocuments({ status: 'rejected' }), Request.countDocuments({ status: 'approved', lorFileUrl: { $ne: '' } }),
    Request.countDocuments({ 'verification.status': 'pending' }), Request.countDocuments({ 'verification.status': 'verified' }),
    User.countDocuments({ role: 'professor', 'professorVerification.status': 'pending' }),
    User.countDocuments({ role: 'professor', 'professorVerification.status': 'verified' }),
    User.countDocuments({ role: 'professor', 'professorVerification.status': 'rejected' }),
  ]);
  res.json({ students, professors, admins, totalRequests, pending, approved, rejected, completed, verificationPending, verified, professorVerificationPending, professorVerified, professorRejected });
});

export const verifyProfessor = asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;
  if (!['verified', 'rejected'].includes(status)) { res.status(400); throw new Error('Professor verification status must be verified or rejected'); }
  const professor = await User.findOne({ _id: req.params.id, role: 'professor' });
  if (!professor) { res.status(404); throw new Error('Professor not found'); }
  if (!professor.professorVerification) professor.professorVerification = {};
  const requiredTypes = ['governmentId', 'facultyId', 'appointmentLetter', 'qualification'];
  const uploadedTypes = new Set((professor.professorVerification?.documents || []).map(d => d.type));
  const missing = requiredTypes.filter(type => !uploadedTypes.has(type));
  if (status === 'verified' && missing.length) { res.status(400); throw new Error(`Cannot verify: required document(s) missing: ${missing.join(', ')}`); }
  professor.professorVerification.status = status;
  professor.professorVerification.note = note.trim();
  professor.professorVerification.reviewedAt = new Date();
  professor.professorVerification.reviewedBy = req.user._id;
  await professor.save();
  await createNotification({
    recipient: professor._id, actor: req.user._id, type: status === 'verified' ? 'professor_verified' : 'professor_rejected',
    title: status === 'verified' ? 'Faculty verification approved' : 'Faculty verification needs changes',
    message: status === 'verified' ? 'Your faculty account is verified. You can now receive and process LOR requests.' : `Your faculty verification was rejected.${note.trim() ? ` Note: ${note.trim()}` : ''}`,
    link: status === 'verified' ? '/dashboard' : '/professor-verification',
  });
  const safe = professor.toObject();
  delete safe.password;
  res.json({ message: status === 'verified' ? 'Professor verified successfully' : 'Professor verification rejected', user: safe });
});

export const downloadProfessorVerificationDocument = asyncHandler(async (req, res) => {
  const professor = await User.findOne({ _id: req.params.id, role: 'professor' }).select('professorVerification');
  if (!professor) { res.status(404); throw new Error('Professor not found'); }
  const doc = professor.professorVerification?.documents?.id(req.params.documentId);
  if (!doc) { res.status(404); throw new Error('Verification document not found'); }
  const filePath = filePathFor(doc.storedName);
  if (!fs.existsSync(filePath)) { res.status(404); throw new Error('Stored verification document is missing'); }
  if (req.query.inline === 'true') {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    return res.sendFile(filePath);
  }
  res.download(filePath, doc.originalName);
});
