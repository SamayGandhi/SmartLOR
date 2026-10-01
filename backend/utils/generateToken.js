import jwt from 'jsonwebtoken';

const generateToken = (user) => jwt.sign(
  { id: user._id.toString(), role: user.role, sessionVersion: user.sessionVersion || 0 },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
);

export default generateToken;
