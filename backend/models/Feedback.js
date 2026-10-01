import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  role: { type: String, enum: ['student', 'professor'], required: true },
}, { timestamps: true });

export default mongoose.model('Feedback', feedbackSchema);
