import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', default: null, index: true },
  type: { type: String, enum: ['request_received','verification_updated','request_approved','request_rejected','lor_ready','professor_verified','professor_rejected','system'], default: 'system' },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  link: { type: String, default: '' },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1, readAt: 1 });

export default mongoose.model('Notification', notificationSchema);
