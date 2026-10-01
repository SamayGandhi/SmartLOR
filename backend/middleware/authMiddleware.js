import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) { res.status(401); throw new Error('Authentication required'); }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error('User not found');
    if ((req.user.sessionVersion || 0) !== (decoded.sessionVersion || 0)) throw new Error('Session has been invalidated');
    const idleMinutes = Math.max(Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30, 5);
    if (req.user.lastActivityAt && Date.now() - req.user.lastActivityAt.getTime() > idleMinutes * 60 * 1000) {
      req.user.sessionVersion = (req.user.sessionVersion || 0) + 1;
      await req.user.save();
      throw new Error('Session expired due to inactivity');
    }
    req.user.lastActivityAt = new Date();
    await req.user.save();
    next();
  } catch {
    res.status(401); throw new Error('Invalid or expired authentication token');
  }
});

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission for this action' });
  next();
};

export const requireVerifiedProfessor = (req, res, next) => {
  if (req.user.role !== 'professor') return res.status(403).json({ message: 'Professor access required' });
  const status = req.user.professorVerification?.status || 'pending';
  if (status !== 'verified') return res.status(403).json({ message: status === 'rejected' ? 'Professor verification was rejected. Contact an administrator.' : 'Professor verification is pending admin review.' });
  next();
};
