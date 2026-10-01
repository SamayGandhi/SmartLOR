import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Request from '../models/Request.js';
import generateToken from '../utils/generateToken.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNotification } from './notificationController.js';

const uploadPath = (storedName) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', storedName);
const safeDelete = (storedName) => { if (!storedName) return; const p = uploadPath(storedName); if (fs.existsSync(p)) fs.unlinkSync(p); };

export const safeUser = (user) => ({
  _id: user._id, name: user.name, email: user.email, role: user.role,
  department: user.department, designation: user.designation, college: user.college,
  university: user.university, studentId: user.studentId, course: user.course,
  semester: user.semester, graduationYear: user.graduationYear, phone: user.phone, bio: user.bio,
  professorVerification: user.role === 'professor' ? {
    status: user.professorVerification?.status || 'pending',
    note: user.professorVerification?.note || '',
    reviewedAt: user.professorVerification?.reviewedAt || null,
    documents: (user.professorVerification?.documents || []).map(d => ({ _id: d._id, type: d.type, originalName: d.originalName, uploadedAt: d.uploadedAt })),
  } : null,
});

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, designation, college, university, studentId, course, semester, graduationYear, phone } = req.body;
  if (!name || !email || !password) { res.status(400); throw new Error('Name, email and password are required'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400); throw new Error('Please enter a valid email'); }
  if (password.length < 8) { res.status(400); throw new Error('Password must be at least 8 characters'); }
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.findOne({ email: normalizedEmail })) { res.status(409); throw new Error('An account with this email already exists'); }
  const safeRole = role === 'professor' ? 'professor' : 'student';
  if (!college?.trim() || !university?.trim() || !department?.trim()) { res.status(400); throw new Error('College, university and department are required'); }
  if (safeRole === 'student' && (!studentId?.trim() || !course?.trim() || !semester?.trim())) { res.status(400); throw new Error('Student ID, course and semester are required for student accounts'); }

  let professorVerification;
  if (safeRole === 'professor') {
    const files = req.files || {};
    const required = [['governmentId', 'governmentId'], ['facultyId', 'facultyId'], ['appointmentLetter', 'appointmentLetter'], ['qualification', 'qualification']];
    const missing = required.filter(([field]) => !files[field]?.[0]).map(([, type]) => type);
    if (missing.length) {
      Object.values(files).flat().forEach(f => safeDelete(f.filename));
      res.status(400); throw new Error(`Professor verification requires: ${missing.join(', ')}`);
    }
    professorVerification = {
      status: 'pending',
      documents: [...required.map(([field, type]) => ({ type, originalName: files[field][0].originalname, storedName: files[field][0].filename, mimeType: files[field][0].mimetype })), ...(files.cv?.[0] ? [{ type: 'cv', originalName: files.cv[0].originalname, storedName: files.cv[0].filename, mimeType: files.cv[0].mimetype }] : [])],
    };
  }

  const user = await User.create({ name, email: normalizedEmail, password, role: safeRole, department, designation, college, university, studentId, course, semester, graduationYear: graduationYear || null, phone, professorVerification });
  // Professor accounts remain usable only for verification-status screens until an admin verifies them.
  res.status(201).json({ user: safeUser(user), token: generateToken(user), message: safeRole === 'professor' ? 'Professor account created. Verification is pending admin review.' : 'Account created.' });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.matchPassword(password || ''))) { res.status(401); throw new Error('Invalid email or password'); }
  user.lastLoginAt = new Date();
  user.lastActivityAt = new Date();
  await user.save();
  res.json({ user: safeUser(user), token: generateToken(user) });
});

export const submitProfessorVerificationDocs = asyncHandler(async (req, res) => {
  if (req.user.role !== 'professor') { res.status(403); throw new Error('Professor account required'); }
  if (!req.user.professorVerification) req.user.professorVerification = {};
  const files = req.files || {};
  const requiredTypes = ['governmentId', 'facultyId', 'appointmentLetter', 'qualification'];
  const currentTypes = new Set((req.user.professorVerification.documents || []).map(d => d.type));
  const missing = requiredTypes.filter(type => !files[type]?.[0] && !currentTypes.has(type));
  if (missing.length) { Object.values(files).flat().forEach(f => safeDelete(f.filename)); res.status(400); throw new Error(`Required professor verification document(s) missing: ${missing.join(', ')}`); }
  for (const [field, values] of Object.entries(files)) {
    const file = values?.[0]; if (!file) continue;
    const existing = req.user.professorVerification.documents.find(d => d.type === field);
    if (existing) safeDelete(existing.storedName);
    req.user.professorVerification.documents = req.user.professorVerification.documents.filter(d => d.type !== field);
    req.user.professorVerification.documents.push({ type: field, originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype });
  }
  req.user.professorVerification.status = 'pending';
  req.user.professorVerification.note = '';
  req.user.professorVerification.reviewedAt = null;
  req.user.professorVerification.reviewedBy = null;
  await req.user.save();
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map(admin => createNotification({ recipient: admin._id, actor: req.user._id, type: 'system', title: 'Faculty verification submitted', message: `${req.user.name} submitted a faculty verification package for ${req.user.college}.`, link: '/admin/users' })));
  res.json({ message: 'Verification package submitted for admin review', user: safeUser(req.user) });
});

export const getUserProfile = asyncHandler(async (req, res) => res.json(safeUser(req.user)));

export const updateProfile = asyncHandler(async (req, res) => {
  const fields = ['name','department','designation','college','university','studentId','course','semester','graduationYear','phone','bio'];
  const institutionFields = ['college','university','department','designation'];
  const studentWorkflowFields = ['name','department','college','university','studentId','course','semester','graduationYear'];
  const institutionChanged = req.user.role === 'professor' && institutionFields.some(field => req.body[field] !== undefined && String(req.body[field]).trim() !== String(req.user[field] || '').trim());
  const studentWorkflowChanged = req.user.role === 'student' && studentWorkflowFields.some(field => req.body[field] !== undefined && String(req.body[field]).trim() !== String(req.user[field] || '').trim());
  for (const field of fields) if (req.body[field] !== undefined) req.user[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
  if (!req.user.name || !req.user.department || !req.user.college || !req.user.university) { res.status(400); throw new Error('Name, department, college and university are required'); }
  let reverificationRequired = false;
  if (institutionChanged && req.user.role === 'professor') {
    if (!req.user.professorVerification) req.user.professorVerification = {};
    // Existing evidence may describe the previous affiliation. Remove it before the new
    // verification cycle so stale documents cannot satisfy the new review.
    for (const doc of req.user.professorVerification.documents || []) safeDelete(doc.storedName);
    req.user.professorVerification.documents = [];
    req.user.professorVerification.status = 'pending';
    req.user.professorVerification.note = 'Your institution or faculty details changed. Upload fresh verification documents; an administrator must review them before faculty access is restored.';
    req.user.professorVerification.reviewedAt = null;
    req.user.professorVerification.reviewedBy = null;
    reverificationRequired = true;
  }
  await req.user.save();
  if (reverificationRequired) {
    const admins = await User.find({ role: 'admin' }).select('_id');
    await Promise.all(admins.map(admin => createNotification({
      recipient: admin._id, actor: req.user._id, type: 'system',
      title: 'Faculty re-verification required',
      message: `${req.user.name} changed institution/faculty details and must submit fresh verification documents.`,
      link: '/admin/users',
    })));
  }

  // Student workflow changes must be confirmed and supported by a fresh document package
  // before the professor is notified. This prevents a profile edit from silently changing
  // the evidence that a professor is being asked to review.
  let pendingRequestUpdates = 0;
  let studentDocumentsRequired = false;
  if (studentWorkflowChanged) {
    // Any active, unfinished LOR workflow depends on the student's submitted identity/context.
    // A profile change therefore invalidates the previous evidence and re-opens the request for
    // fresh document verification. Completed requests are historical records and are left alone.
    const activeRequests = await Request.find({
      student: req.user._id,
      $or: [
        { status: 'pending' },
        { status: 'approved', completedAt: null },
      ],
    });
    pendingRequestUpdates = activeRequests.length;
    studentDocumentsRequired = true;

    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const request of activeRequests) {
      for (const doc of request.documents || []) safeDelete(doc.storedName);
      safeDelete(path.basename(request.draftFileUrl || ''));
      safeDelete(path.basename(request.lorFileUrl || ''));

      request.documents = [];
      request.status = 'pending';
      request.studentChangePending = true;
      request.studentChangeAt = new Date();
      request.verification.status = 'pending';
      request.verification.note = 'Student profile details changed. Fresh supporting documents are required before this request is sent back to the professor.';
      request.verification.verifiedAt = null;
      request.verification.verifiedBy = null;
      request.responseMessage = '';
      request.recommendationText = '';
      request.relationship = '';
      request.relationshipDuration = '';
      request.comparisonGroup = '';
      request.comparisonCount = null;
      request.assessmentLevel = '';
      request.recommendationStrength = '';
      request.strengths = '';
      request.evidence = '';
      request.constructiveFeedback = '';
      request.additionalRemarks = '';
      request.draftFileUrl = '';
      request.draftFileName = '';
      request.draftGeneratedAt = null;
      request.pdfTemplateVersion = 0;
      request.lorFileUrl = '';
      request.lorFileName = '';
      request.reviewedAt = null;
      request.completedAt = null;
      request.approvedAt = null;
      request.requestExpiresAt = null;
      request.lorExpiresAt = null;
      await request.save();

      await createNotification({
        recipient: req.user._id, actor: req.user._id, request: request._id, type: 'system',
        title: 'Supporting documents required',
        message: 'Your profile change reset this active LOR workflow. Upload a fresh four-document package before the professor is notified.',
        link: '/request-documents',
      });
      for (const admin of admins) {
        await createNotification({
          recipient: admin._id, actor: req.user._id, request: request._id, type: 'system',
          title: 'Student LOR re-verification required',
          message: `${req.user.name} changed profile details and the active LOR request now requires fresh supporting documents and professor review.`,
          link: '/admin/requests',
        });
      }
    }
  }

  res.json({ ...safeUser(req.user), reverificationRequired, pendingRequestUpdates, studentDocumentsRequired });
});

export const logoutUser = asyncHandler(async (req, res) => {
  req.user.sessionVersion = (req.user.sessionVersion || 0) + 1;
  await req.user.save();
  res.json({ message: 'Logged out successfully' });
});
