import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const verificationDocumentSchema = new mongoose.Schema({
  type: { type: String, enum: ['governmentId', 'facultyId', 'appointmentLetter', 'qualification', 'experience', 'cv'], required: true },
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const professorVerificationSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  note: { type: String, trim: true, maxlength: 1200, default: '' },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  documents: { type: [verificationDocumentSchema], default: [] },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['student', 'professor', 'admin'], default: 'student', index: true },
  department: { type: String, trim: true, maxlength: 120, default: '' },
  designation: { type: String, trim: true, maxlength: 120, default: '' },
  college: { type: String, trim: true, maxlength: 180, default: '' },
  university: { type: String, trim: true, maxlength: 180, default: '' },
  studentId: { type: String, trim: true, maxlength: 80, default: '' },
  course: { type: String, trim: true, maxlength: 150, default: '' },
  semester: { type: String, trim: true, maxlength: 30, default: '' },
  graduationYear: { type: Number, min: 2000, max: 2100, default: null },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  bio: { type: String, trim: true, maxlength: 700, default: '' },
  professorVerification: { type: professorVerificationSchema, default: undefined },
  lastLoginAt: { type: Date, default: null },
  lastActivityAt: { type: Date, default: null },
  sessionVersion: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre('validate', function () {
  if (this.role === 'professor' && !this.professorVerification) this.professorVerification = {};
});

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

export default mongoose.model('User', userSchema);
