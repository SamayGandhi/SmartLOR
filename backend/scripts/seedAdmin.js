import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();
await connectDB();
const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
const existing = await User.findOne({ email });
if (existing) {
  existing.role = 'admin';
  existing.password = password;
  await existing.save();
  console.log('Existing user promoted to admin and password updated.');
} else {
  await User.create({ name: 'SmartLOR Admin', email, password, role: 'admin', department: 'Administration', college: 'SmartLOR Administration', university: 'SmartLOR' });
  console.log('Admin created.');
}
process.exit(0);
