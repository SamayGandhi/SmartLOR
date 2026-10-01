import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  type: { type: String, enum: ['identity', 'enrollment', 'academic', 'purpose'], required: true },
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  mimeType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const requestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 2500 },
  deadline: { type: Date, required: true },
  targetInstitution: { type: String, required: true, trim: true, maxlength: 180 },
  targetProgram: { type: String, required: true, trim: true, maxlength: 180 },
  recipientName: { type: String, trim: true, maxlength: 120, default: '' },
  recipientEmail: { type: String, trim: true, lowercase: true, maxlength: 180, default: '' },
  recipientAddress: { type: String, trim: true, maxlength: 500, default: '' },
  relationship: { type: String, trim: true, maxlength: 180, default: '' },
  relationshipDuration: { type: String, trim: true, maxlength: 80, default: '' },
  verification: {
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  documents: { type: [documentSchema], default: [] },
  studentChangePending: { type: Boolean, default: false, index: true },
  studentChangeAt: { type: Date, default: null },
  consent: { type: Boolean, required: true, default: false },
  consentAt: { type: Date, default: null },
  disclosureAcknowledged: { type: Boolean, required: true, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  responseMessage: { type: String, trim: true, maxlength: 1000, default: '' },
  recommendationText: { type: String, trim: true, maxlength: 6000, default: '' },
  comparisonGroup: { type: String, trim: true, maxlength: 160, default: '' },
  comparisonCount: { type: Number, min: 0, max: 100000, default: null },
  assessmentLevel: { type: String, enum: ['', 'top-1', 'top-5', 'top-10', 'top-25', 'above-average', 'no-basis'], default: '' },
  recommendationStrength: { type: String, enum: ['', 'strongly-recommend', 'recommend', 'recommend-with-reservations'], default: '' },
  strengths: { type: String, trim: true, maxlength: 1800, default: '' },
  evidence: { type: String, trim: true, maxlength: 1800, default: '' },
  constructiveFeedback: { type: String, trim: true, maxlength: 1400, default: '' },
  additionalRemarks: { type: String, trim: true, maxlength: 1400, default: '' },
  letterLanguage: { type: String, trim: true, maxlength: 60, default: 'English' },
  draftFileUrl: { type: String, default: '' },
  draftFileName: { type: String, default: '' },
  draftGeneratedAt: { type: Date, default: null },
  pdfTemplateVersion: { type: Number, default: 0 },
  lorFileUrl: { type: String, default: '' },
  lorFileName: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  requestExpiresAt: { type: Date, default: null, index: true },
  lorExpiresAt: { type: Date, default: null, index: true },
}, { timestamps: true });

requestSchema.index({ student: 1, createdAt: -1 });
requestSchema.index({ professor: 1, status: 1, createdAt: -1 });
requestSchema.index({ 'verification.status': 1, createdAt: -1 });

export default mongoose.model('Request', requestSchema);
