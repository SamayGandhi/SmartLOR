import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Request from '../models/Request.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
const filePathFor = (storedName) => path.join(uploadsDir, path.basename(storedName || ''));
const deleteFile = (storedName) => {
  if (!storedName) return;
  const file = filePathFor(storedName);
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (error) { console.error('SmartLOR cleanup file error:', error.message); }
};

export const runCleanup = async () => {
  const now = new Date();
  const approvedRetentionDays = Math.min(Math.max(Number(process.env.APPROVED_REQUEST_RETENTION_DAYS) || 7, 1), 7);
  const pdfRetentionDays = Math.min(Math.max(Number(process.env.LOR_PDF_RETENTION_DAYS) || 7, 1), 7);
  const requestDocumentRetentionDays = Math.min(Math.max(Number(process.env.REQUEST_DOCUMENT_RETENTION_DAYS) || 7, 1), 7);
  const professorDocumentRetentionDays = Math.min(Math.max(Number(process.env.PROFESSOR_VERIFICATION_RETENTION_DAYS) || 7, 1), 7);
  let deletedRequests = 0;
  let deletedFiles = 0;
  let deletedProfessorDocs = 0;
  let deletedNotifications = 0;

  // Supporting request documents (PDF/JPG/PNG) are private working evidence and are
  // removed after the configured short retention period even when the parent request is
  // still pending. The request itself remains until a participant manually deletes it
  // or it reaches the reviewed-request retention window.
  const requestDocumentCutoff = new Date(now.getTime() - requestDocumentRetentionDays * 86400000);
  const requestsWithOldDocs = await Request.find({ 'documents.0': { $exists: true } }).select('documents createdAt');
  for (const request of requestsWithOldDocs) {
    const keep = [];
    let changed = false;
    for (const doc of request.documents || []) {
      const uploadedAt = doc.uploadedAt || request.createdAt;
      if (uploadedAt && uploadedAt <= requestDocumentCutoff) {
        deleteFile(doc.storedName);
        deletedFiles += 1;
        changed = true;
      } else keep.push(doc);
    }
    if (changed) { request.documents = keep; await request.save(); }
  }

  // Final LOR PDFs and generated drafts are short-lived. They are cleaned independently
  // so a draft is not accidentally retained just because a final PDF was never uploaded.
  const pdfCutoff = new Date(now.getTime() - pdfRetentionDays * 86400000);
  const expiringFiles = await Request.find({
    $or: [
      { lorExpiresAt: { $lte: now, $ne: null } },
      { draftGeneratedAt: { $lte: pdfCutoff, $ne: null } },
    ],
  }).select('lorFileUrl draftFileUrl lorExpiresAt draftGeneratedAt');
  for (const request of expiringFiles) {
    let changed = false;
    if (request.lorFileUrl && request.lorExpiresAt && request.lorExpiresAt <= now) {
      deleteFile(request.lorFileUrl); deletedFiles += 1;
      request.lorFileUrl = ''; request.lorFileName = ''; request.lorExpiresAt = null; changed = true;
    }
    if (request.draftFileUrl && request.draftGeneratedAt && request.draftGeneratedAt <= pdfCutoff) {
      deleteFile(request.draftFileUrl); deletedFiles += 1;
      request.draftFileUrl = ''; request.draftFileName = ''; request.draftGeneratedAt = null; changed = true;
    }
    if (changed) await request.save();
  }

  // Pending requests stay indefinitely until a participant/admin manually deletes them.
  // Reviewed requests are retained for at most seven days from review/approval. This is
  // independent from PDF generation time so a late draft upload cannot extend the
  // request lifetime. All files belonging to an expired reviewed request are removed
  // together with the request record.
  const requestRetentionDays = Math.min(Math.max(Number(process.env.REQUEST_RETENTION_DAYS) || approvedRetentionDays, 1), 7);
  const requestCutoff = new Date(now.getTime() - requestRetentionDays * 86400000);
  const oldReviewedRequests = await Request.find({
    status: { $in: ['approved', 'rejected'] },
    $or: [
      { requestExpiresAt: { $lte: now, $ne: null } },
      { requestExpiresAt: null, reviewedAt: { $lte: requestCutoff, $ne: null } },
      { requestExpiresAt: null, reviewedAt: null, createdAt: { $lte: requestCutoff } },
    ],
  }).select('documents draftFileUrl lorFileUrl status');
  for (const request of oldReviewedRequests) {
    for (const doc of request.documents || []) { deleteFile(doc.storedName); deletedFiles += 1; }
    if (request.draftFileUrl) { deleteFile(path.basename(request.draftFileUrl)); deletedFiles += 1; }
    if (request.lorFileUrl) { deleteFile(path.basename(request.lorFileUrl)); deletedFiles += 1; }
    await Request.deleteOne({ _id: request._id });
    await Notification.deleteMany({ request: request._id });
    deletedRequests += 1;
  }

  // Remove stale read notifications to keep the notification collection bounded.
  const notificationCutoff = new Date(now.getTime() - (Number(process.env.NOTIFICATION_RETENTION_DAYS) || 90) * 86400000);
  const notificationResult = await Notification.deleteMany({ readAt: { $ne: null, $lte: notificationCutoff } });
  deletedNotifications = notificationResult.deletedCount || 0;

  // Professor verification uploads are also short-lived, including pending packages.
  // The verification status remains in MongoDB, but the underlying identity images/PDFs
  // are removed after seven days and must be re-uploaded if still needed.
  const professorDocCutoff = new Date(now.getTime() - professorDocumentRetentionDays * 86400000);
  const professors = await User.find({
    role: 'professor',
    'professorVerification.documents.0': { $exists: true },
  }).select('professorVerification createdAt');
  for (const professor of professors) {
    const docs = professor.professorVerification?.documents || [];
    if (!docs.length) continue;
    const remainingDocs = [];
    for (const doc of docs) {
      const uploadedAt = doc.uploadedAt || professor.professorVerification?.reviewedAt || professor.createdAt;
      if (uploadedAt && uploadedAt <= professorDocCutoff) {
        deleteFile(doc.storedName);
        deletedProfessorDocs += 1;
      } else {
        remainingDocs.push(doc);
      }
    }
    if (remainingDocs.length !== docs.length) {
      professor.professorVerification.documents = remainingDocs;
      await professor.save();
    }
  }

  return { deletedRequests, deletedFiles, deletedProfessorDocs, deletedNotifications, ranAt: now.toISOString(), approvedRetentionDays, requestRetentionDays, requestDocumentRetentionDays, pdfRetentionDays, professorDocumentRetentionDays };
};

export const startCleanupScheduler = () => {
  const intervalHours = Math.max(Number(process.env.CLEANUP_INTERVAL_HOURS) || 1, 1);
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const execute = () => runCleanup().then(result => {
    if (result.deletedRequests || result.deletedFiles || result.deletedProfessorDocs || result.deletedNotifications) console.log('SmartLOR cleanup:', result);
  }).catch(error => console.error('SmartLOR cleanup failed:', error));
  execute();
  return setInterval(execute, intervalMs);
};
