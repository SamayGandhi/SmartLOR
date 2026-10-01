import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Request from '../models/Request.js';
import Notification from '../models/Notification.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const getProfessorFilterOptions = asyncHandler(async (req, res) => {
  const [colleges, universities, departments] = await Promise.all([
    User.distinct('college', { role: 'professor', 'professorVerification.status': 'verified', college: { $nin: ['', null] } }),
    User.distinct('university', { role: 'professor', 'professorVerification.status': 'verified', university: { $nin: ['', null] } }),
    User.distinct('department', { role: 'professor', 'professorVerification.status': 'verified', department: { $nin: ['', null] } }),
  ]);
  const clean = values => values.filter(Boolean).map(v => String(v).trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  res.json({ colleges: clean(colleges), universities: clean(universities), departments: clean(departments) });
});

export const getProfessors = asyncHandler(async (req, res) => {
  const { search = '', college = '', university = '', department = '' } = req.query;
  const filter = { role: 'professor', 'professorVerification.status': 'verified' };
  if (college) filter.college = { $regex: college, $options: 'i' };
  if (university) filter.university = { $regex: university, $options: 'i' };
  if (department) filter.department = { $regex: department, $options: 'i' };
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { department: { $regex: search, $options: 'i' } },
    { college: { $regex: search, $options: 'i' } },
    { university: { $regex: search, $options: 'i' } },
  ];
  const professors = await User.find(filter).select('name email department designation college university bio').sort({ name: 1 });
  res.json(professors);
});

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('name email role department designation college university studentId course semester graduationYear phone bio createdAt professorVerification').sort({ createdAt: -1 });
  res.json(users.map(user => { const item = user.toObject(); if (item.professorVerification?.documents) item.professorVerification.documents = item.professorVerification.documents.map(({ _id, type, originalName, uploadedAt }) => ({ _id, type, originalName, uploadedAt })); return item; }));
});

const filePathFor = (storedName) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', storedName);

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) { res.status(400); throw new Error('You cannot delete your own account'); }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  const docs = user.professorVerification?.documents || [];
  for (const doc of docs) { const file = filePathFor(doc.storedName); if (fs.existsSync(file)) fs.unlinkSync(file); }
  const requests = await Request.find({ $or: [{ student: user._id }, { professor: user._id }] }).select('documents draftFileUrl lorFileUrl');
  for (const request of requests) {
    for (const doc of request.documents || []) { const file = filePathFor(doc.storedName); if (fs.existsSync(file)) fs.unlinkSync(file); }
    for (const url of [request.draftFileUrl, request.lorFileUrl]) { const file = filePathFor(url); if (fs.existsSync(file)) fs.unlinkSync(file); }
  }
  const relatedRequests = await Request.find({ $or: [{ student: user._id }, { professor: user._id }] }).select('_id');
  await Request.deleteMany({ $or: [{ student: user._id }, { professor: user._id }] });
  await Notification.deleteMany({ $or: [{ recipient: user._id }, { actor: user._id }, { request: { $in: relatedRequests.map(r => r._id) } }] });
  res.json({ message: 'User and associated private files removed' });
});
