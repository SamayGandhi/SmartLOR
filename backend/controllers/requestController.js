import asyncHandler from 'express-async-handler';
import Request from '../models/Request.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateLorPdf, PDF_TEMPLATE_VERSION } from '../utils/generateLorPdf.js';
import { createNotification } from './notificationController.js';

const populateRequest = (query) => query
  .populate('student', 'name email department college university studentId course semester graduationYear phone designation')
  .populate('professor', 'name email department designation college university bio')
  .populate('verification.verifiedBy', 'name email role');

const filePathFor = (storedName) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', storedName);
const safeDelete = (storedName) => { if (!storedName) return; const p = filePathFor(storedName); if (fs.existsSync(p)) fs.unlinkSync(p); };

export const createRequest = asyncHandler(async (req, res) => {
  const { professorId, purpose, message, deadline, targetInstitution, targetProgram, recipientName, recipientEmail, recipientAddress, consent, disclosureAcknowledged } = req.body;
  if (!professorId || !purpose || !message || !deadline || !targetInstitution || !targetProgram) { res.status(400); throw new Error('Purpose, target institution, target program, message, professor and deadline are required'); }
  if (consent !== 'true' || disclosureAcknowledged !== 'true') { res.status(400); throw new Error('You must provide the required data-processing consent and disclosure acknowledgement'); }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime()) || date <= new Date()) { res.status(400); throw new Error('Deadline must be a valid future date'); }
  const professor = await User.findOne({ _id: professorId, role: 'professor' });
  if (!professor) { res.status(404); throw new Error('Professor not found'); }
  if (professor.professorVerification?.status !== 'verified') { res.status(403); throw new Error('This professor is not currently verified for LOR requests'); }
  const files = req.files || {};
  const requiredDocs = [
    ['identityProof', 'identity'], ['enrollmentProof', 'enrollment'], ['academicProof', 'academic'], ['purposeProof', 'purpose'],
  ];
  const missing = requiredDocs.filter(([field]) => !files[field]?.[0]).map(([, type]) => type);
  if (missing.length) { Object.values(files).flat().forEach(f => safeDelete(f.filename)); res.status(400); throw new Error(`Required verification document(s) missing: ${missing.join(', ')}`); }
  const existing = await Request.findOne({ student: req.user._id, professor: professorId, status: 'pending' });
  if (existing) { Object.values(files).flat().forEach(f => safeDelete(f.filename)); res.status(409); throw new Error('You already have a pending request with this professor'); }
  const documents = requiredDocs.map(([field, type]) => ({ type, originalName: files[field][0].originalname, storedName: files[field][0].filename, mimeType: files[field][0].mimetype }));
  const request = await Request.create({
    student: req.user._id, professor: professorId, purpose, message, deadline: date, targetInstitution, targetProgram,
    recipientName, recipientEmail, recipientAddress, documents, consent: true, consentAt: new Date(), disclosureAcknowledged: true,
  });
  await createNotification({
    recipient: professor._id, actor: req.user._id, request: request._id, type: 'request_received',
    title: 'New LOR request received',
    message: `${req.user.name} sent you a recommendation request for ${targetInstitution}. Review the submitted documents before responding.`,
    link: '/requests',
  });
  await createNotification({
    recipient: req.user._id, actor: req.user._id, request: request._id, type: 'system',
    title: 'Request sent successfully',
    message: `Your LOR request was sent to ${professor.name}. You will be notified when it is reviewed.`,
    link: '/my-requests',
  });
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map(admin => createNotification({
    recipient: admin._id, actor: req.user._id, request: request._id, type: 'request_received',
    title: 'New LOR request', message: `${req.user.name} submitted a recommendation request to ${professor.name}.`, link: '/admin/requests',
  })));
  res.status(201).json({ request: await populateRequest(Request.findById(request._id)), message: 'Request submitted successfully. The professor has been notified.' });
});

export const getMyRequests = asyncHandler(async (req, res) => {
  const now = new Date();
  const reviewedCutoff = new Date(now.getTime() - 7 * 86400000);
  const filter = {
    student: req.user._id,
    $or: [
      { status: 'pending' },
      { status: { $in: ['approved', 'rejected'] }, requestExpiresAt: { $gt: now } },
      { status: { $in: ['approved', 'rejected'] }, requestExpiresAt: null, reviewedAt: { $gt: reviewedCutoff } },
      { status: { $in: ['approved', 'rejected'] }, requestExpiresAt: null, reviewedAt: null, createdAt: { $gt: reviewedCutoff } },
    ],
  };
  res.json(await populateRequest(Request.find(filter).sort({ createdAt: -1 })));
});

export const getProfessorRequests = asyncHandler(async (req, res) => {
  // The faculty inbox intentionally contains only actionable pending requests.
  // Approved/rejected work is handled in the separate recommendation workspace.
  const filter = { professor: req.user._id, status: 'pending', 'documents.3': { $exists: true }, $or: [{ studentChangePending: false }, { studentChangePending: { $exists: false } }] };
  const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const studentIds = [];
  if (req.query.college) studentIds.push(...await User.find({ role: 'student', college: { $regex: escapeRegex(req.query.college), $options: 'i' } }).distinct('_id'));
  if (req.query.university) studentIds.push(...await User.find({ role: 'student', university: { $regex: escapeRegex(req.query.university), $options: 'i' } }).distinct('_id'));
  if (req.query.college || req.query.university) {
    filter.student = { $in: [...new Map(studentIds.map(id => [String(id), id])).values()] };
  }
  res.json(await populateRequest(Request.find(filter).sort({ createdAt: -1 })));
});

export const getProfessorActiveRequest = asyncHandler(async (req, res) => {
  const now = new Date();
  const requests = await Request.find({
    professor: req.user._id,
    status: 'approved',
    completedAt: null,
    $or: [
      { requestExpiresAt: { $gt: now } },
      { requestExpiresAt: null },
    ],
  }).sort({ approvedAt: -1, reviewedAt: -1, createdAt: -1 });
  res.json(await populateRequest(Request.find({ _id: { $in: requests.map(r => r._id) } }).sort({ approvedAt: -1, reviewedAt: -1, createdAt: -1 })));
});

export const deletePendingRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  const isParticipant = [request.student.toString(), request.professor.toString()].includes(req.user._id.toString());
  if (req.user.role !== 'admin' && !isParticipant) { res.status(403); throw new Error('Not authorized to delete this request'); }
  if (request.status !== 'pending') { res.status(409); throw new Error('Only pending requests can be manually deleted'); }

  const notifyTargets = [];
  if (req.user._id.toString() === request.student.toString()) notifyTargets.push({ recipient: request.professor, title: 'LOR request withdrawn', message: 'The student withdrew the pending recommendation request.', link: '/requests' });
  else if (req.user._id.toString() === request.professor.toString()) notifyTargets.push({ recipient: request.student, title: 'LOR request removed', message: 'The professor removed the pending recommendation request from the workflow.', link: '/my-requests' });
  else {
    notifyTargets.push({ recipient: request.student, title: 'Pending LOR request removed', message: 'An administrator removed this pending recommendation request.', link: '/my-requests' });
    notifyTargets.push({ recipient: request.professor, title: 'Pending LOR request removed', message: 'An administrator removed this pending recommendation request.', link: '/requests' });
  }
  await Promise.all(notifyTargets.map(n => createNotification({ ...n, actor: req.user._id, request: null, type: 'system' })));

  for (const doc of request.documents || []) safeDelete(doc.storedName);
  safeDelete(path.basename(request.draftFileUrl || ''));
  safeDelete(path.basename(request.lorFileUrl || ''));
  await Notification.deleteMany({ request: request._id });
  await Request.deleteOne({ _id: request._id });
  res.json({ message: 'Pending request and its uploaded files were deleted successfully.' });
});


export const updateStudentRequestDocuments = asyncHandler(async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, student: req.user._id, status: 'pending' });
  if (!request) { res.status(404); throw new Error('Pending request not found'); }

  const files = req.files || {};
  const requiredDocs = [
    ['identityProof', 'identity'], ['enrollmentProof', 'enrollment'],
    ['academicProof', 'academic'], ['purposeProof', 'purpose'],
  ];
  const missing = requiredDocs.filter(([field]) => !files[field]?.[0]).map(([, type]) => type);
  if (missing.length) {
    Object.values(files).flat().forEach(f => safeDelete(f.filename));
    res.status(400); throw new Error(`All four supporting documents are required: ${missing.join(', ')}`);
  }

  for (const doc of request.documents || []) safeDelete(doc.storedName);
  request.documents = requiredDocs.map(([field, type]) => ({
    type,
    originalName: files[field][0].originalname,
    storedName: files[field][0].filename,
    mimeType: files[field][0].mimetype,
  }));
  request.studentChangePending = false;
  request.studentChangeAt = null;
  request.verification.status = 'pending';
  request.verification.note = '';
  request.verification.verifiedAt = null;
  request.verification.verifiedBy = null;
  await request.save();

  await createNotification({
    recipient: request.professor, actor: req.user._id, request: request._id, type: 'request_received',
    title: 'Updated LOR request received',
    message: `${req.user.name} updated profile information and re-submitted the required supporting documents. Please review the updated request.`,
    link: '/requests',
  });
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map(admin => createNotification({
    recipient: admin._id, actor: req.user._id, request: request._id, type: 'system',
    title: 'Student LOR request updated',
    message: `${req.user.name} re-submitted supporting documents after a profile change.`,
    link: '/admin/requests',
  })));

  res.json({
    request: await populateRequest(Request.findById(request._id)),
    message: 'Supporting documents updated. The professor has been notified to review the request again.',
  });
});

export const getRequestById = asyncHandler(async (req, res) => {
  const request = await populateRequest(Request.findById(req.params.id));
  if (!request) { res.status(404); throw new Error('Request not found'); }
  const allowed = req.user.role === 'admin' || [request.student._id.toString(), request.professor._id.toString()].includes(req.user._id.toString());
  if (!allowed) { res.status(403); throw new Error('Not authorized'); }
  res.json(request);
});

export const updateVerification = asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;
  if (!['verified', 'rejected'].includes(status)) { res.status(400); throw new Error('Verification status must be verified or rejected'); }
  const request = await Request.findOne({ _id: req.params.id, professor: req.user._id });
  if (!request) { res.status(404); throw new Error('Request not found'); }
  if (!request.documents || request.documents.length < 4) { res.status(400); throw new Error('All required verification documents must be present before verification'); }
  request.verification.status = status;
  request.verification.note = note.trim();
  request.verification.verifiedAt = new Date();
  request.verification.verifiedBy = req.user._id;
  await request.save();
  await createNotification({
    recipient: request.student, actor: req.user._id, request: request._id,
    type: 'verification_updated', title: status === 'verified' ? 'Documents verified' : 'Document verification needs attention',
    message: status === 'verified' ? 'Your supporting documents were verified. Your professor can now review the LOR request.' : `The professor rejected document verification.${note.trim() ? ` Note: ${note.trim()}` : ''}`,
    link: '/my-requests',
  });
  res.json({ request: await populateRequest(Request.findById(request._id)), message: status === 'verified' ? 'Documents verified successfully.' : 'Document verification marked for correction.' });
});

export const updateRequestStatus = asyncHandler(async (req, res) => {
  const { status, responseMessage = '' } = req.body;
  if (!['approved', 'rejected'].includes(status)) { res.status(400); throw new Error('Status must be approved or rejected'); }
  const request = await Request.findOne({ _id: req.params.id, professor: req.user._id });
  if (!request) { res.status(404); throw new Error('Request not found'); }
  if (request.status !== 'pending') { res.status(409); throw new Error('This request has already been reviewed'); }
  if (status === 'approved' && request.verification.status !== 'verified') { res.status(409); throw new Error('Verify all submitted documents before approving this LOR request'); }
  request.status = status;
  request.responseMessage = responseMessage.trim();
  request.reviewedAt = new Date();
  const retentionDays = Math.min(Math.max(Number(process.env.APPROVED_REQUEST_RETENTION_DAYS) || 7, 1), 7);
  if (status === 'approved') request.approvedAt = new Date();
  request.requestExpiresAt = new Date(Date.now() + retentionDays * 86400000);
  await request.save();
  await createNotification({
    recipient: request.student, actor: req.user._id, request: request._id,
    type: status === 'approved' ? 'request_approved' : 'request_rejected',
    title: status === 'approved' ? 'LOR request approved' : 'LOR request declined',
    message: status === 'approved' ? 'Your request was approved. The professor can now prepare and issue the final recommendation PDF.' : `Your professor declined the request.${responseMessage.trim() ? ` Note: ${responseMessage.trim()}` : ''}`,
    link: '/my-requests',
  });
  res.json({ request: await populateRequest(Request.findById(request._id)), message: status === 'approved' ? 'Request approved successfully.' : 'Request rejected.' });
});

export const generateDraft = asyncHandler(async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, professor: req.user._id }).populate('student', 'name email college university course department');
  if (!request) { res.status(404); throw new Error('Request not found'); }
  if (request.status !== 'approved') { res.status(400); throw new Error('Approve the request before generating the LOR draft'); }
  const { recommendationText, relationship, relationshipDuration, comparisonGroup, comparisonCount, assessmentLevel, recommendationStrength, strengths, evidence, constructiveFeedback, additionalRemarks, letterLanguage } = req.body;
  if (!recommendationText?.trim() || !relationship?.trim() || !recommendationStrength?.trim() || !strengths?.trim() || !evidence?.trim()) { res.status(400); throw new Error('Relationship, recommendation strength, observed strengths, specific evidence and recommendation narrative are required'); }
  const recommendationWords = recommendationText.trim().split(/\s+/).filter(Boolean).length;
  if (recommendationWords > 750) { res.status(400); throw new Error(`Recommendation narrative is ${recommendationWords} words. Please keep it to 750 words or fewer.`); }
  const totalLetterWords = [recommendationText, strengths, evidence, constructiveFeedback, additionalRemarks].filter(Boolean).join(' ').trim().split(/\s+/).filter(Boolean).length;
  if (totalLetterWords > 1500) { res.status(400); throw new Error(`The complete recommendation content is ${totalLetterWords} words. Please keep the combined letter content to 1,500 words or fewer.`); }
  request.recommendationText = recommendationText.trim();
  request.relationship = relationship.trim();
  request.relationshipDuration = relationshipDuration?.trim() || '';
  request.comparisonGroup = comparisonGroup?.trim() || '';
  request.comparisonCount = comparisonCount ? Number(comparisonCount) : null;
  request.assessmentLevel = assessmentLevel || '';
  request.recommendationStrength = recommendationStrength || '';
  request.strengths = strengths?.trim() || '';
  request.evidence = evidence?.trim() || '';
  request.constructiveFeedback = constructiveFeedback?.trim() || '';
  request.additionalRemarks = additionalRemarks?.trim() || '';
  request.letterLanguage = letterLanguage?.trim() || 'English';
  const professor = await User.findById(req.user._id);
  const generated = await generateLorPdf({ request, student: request.student, professor });
  if (request.draftFileUrl) safeDelete(path.basename(request.draftFileUrl));
  request.draftFileUrl = `/uploads/${generated.filename}`;
  request.draftFileName = `SmartLOR-Draft-${request.student.name.replace(/\s+/g, '-')}.pdf`;
  request.draftGeneratedAt = new Date();
  request.pdfTemplateVersion = PDF_TEMPLATE_VERSION;
  await request.save();
  res.json(await populateRequest(Request.findById(request._id)));
});

export const uploadLOR = asyncHandler(async (req, res) => {
  const request = await Request.findOne({ _id: req.params.id, professor: req.user._id });
  if (!request) { res.status(404); throw new Error('Request not found'); }
  if (request.status !== 'approved') { res.status(400); throw new Error('Only approved requests can receive a final signed LOR'); }
  if (!req.file) { res.status(400); throw new Error('Please select the final signed PDF'); }
  if (request.lorFileUrl) safeDelete(path.basename(request.lorFileUrl));
  request.lorFileUrl = `/uploads/${req.file.filename}`;
  request.lorFileName = req.file.originalname;
  request.completedAt = new Date();
  const pdfRetentionDays = Math.min(Math.max(Number(process.env.LOR_PDF_RETENTION_DAYS) || 7, 1), 7);
  const pdfCutoff = new Date(Date.now() + pdfRetentionDays * 86400000);
  // The final signed PDF is retained for seven days from upload. Keep the reviewed
  // request record alive for the same window so the download cannot disappear early.
  request.lorExpiresAt = pdfCutoff;
  request.requestExpiresAt = pdfCutoff;
  await request.save();
  await createNotification({
    recipient: request.student, actor: req.user._id, request: request._id, type: 'lor_ready',
    title: 'Your final LOR is ready',
    message: `The signed recommendation PDF is ready to download and is stored temporarily until ${request.lorExpiresAt.toLocaleDateString('en-IN')}. Download and save it securely.`,
    link: '/my-requests',
  });
  res.json({ request: await populateRequest(Request.findById(request._id)), message: 'Final signed LOR uploaded. The student has been notified.' });
});

const authorizeRequestFile = async (req, res) => {
  const request = await Request.findById(req.params.id).select('student professor documents draftFileUrl draftFileName lorFileUrl lorFileName lorExpiresAt');
  if (!request) { res.status(404); throw new Error('Request not found'); }
  const allowed = req.user.role === 'admin' || [request.student.toString(), request.professor.toString()].includes(req.user._id.toString());
  if (!allowed) { res.status(403); throw new Error('Not authorized to access this file'); }
  return request;
};

export const downloadLOR = asyncHandler(async (req, res) => {
  const request = await authorizeRequestFile(req, res);
  if (!request.lorFileUrl) { res.status(404); throw new Error('Final signed LOR PDF is not available yet'); }
  if (request.lorExpiresAt && request.lorExpiresAt <= new Date()) { res.status(410); throw new Error('This LOR PDF has expired from SmartLOR storage. Please contact the professor/institution if a replacement is required.'); }
  const storedName = path.basename(request.lorFileUrl);
  const filePath = filePathFor(storedName);
  if (!fs.existsSync(filePath)) { res.status(404); throw new Error('Stored LOR file is missing'); }
  if (req.query.inline === 'true') {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(request.lorFileName || 'recommendation-letter.pdf')}"`);
    return res.sendFile(filePath);
  }
  res.download(filePath, request.lorFileName || 'recommendation-letter.pdf');
});

export const downloadDraft = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id)
    .populate('student', 'name email college university course department')
    .populate('professor', 'name email department designation college university bio');
  if (!request) { res.status(404); throw new Error('Request not found'); }
  const allowed = req.user.role === 'admin' || [request.student?._id?.toString(), request.professor?._id?.toString()].includes(req.user._id.toString());
  if (!allowed) { res.status(403); throw new Error('Not authorized to access this file'); }
  if (request.status !== 'approved') { res.status(400); throw new Error('A draft PDF is available only after the request is approved'); }

  let filePath = request.draftFileUrl ? filePathFor(path.basename(request.draftFileUrl)) : '';
  // Older requests may still point at a PDF generated by a previous template. Rebuild
  // them once using the current SmartLOR structure so historical records are upgraded too.
  const needsTemplateUpgrade = request.pdfTemplateVersion !== PDF_TEMPLATE_VERSION;
  if (needsTemplateUpgrade || !filePath || !fs.existsSync(filePath)) {
    if (!request.recommendationText?.trim() || !request.relationship?.trim() || !request.recommendationStrength?.trim()) {
      res.status(404); throw new Error('This older request does not contain enough recommendation content to rebuild the current PDF template. Ask the professor to generate the PDF again.');
    }
    const generated = await generateLorPdf({ request, student: request.student, professor: request.professor });
    if (request.draftFileUrl) safeDelete(path.basename(request.draftFileUrl));
    request.draftFileUrl = `/uploads/${generated.filename}`;
    request.draftFileName = `SmartLOR-Draft-${request.student.name.replace(/\s+/g, '-')}.pdf`;
    request.draftGeneratedAt = new Date();
    request.pdfTemplateVersion = PDF_TEMPLATE_VERSION;
    await request.save();
    filePath = generated.filePath;
  }
  if (req.query.inline === 'true') {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(request.draftFileName || 'SmartLOR-Recommendation.pdf')}"`);
    return res.sendFile(filePath);
  }
  return res.download(filePath, request.draftFileName || 'SmartLOR-Recommendation.pdf');
});

export const downloadVerificationDocument = asyncHandler(async (req, res) => {
  const request = await authorizeRequestFile(req, res);
  const doc = request.documents.id(req.params.documentId);
  if (!doc) { res.status(404); throw new Error('Verification document not found'); }
  const filePath = filePathFor(doc.storedName);
  if (!fs.existsSync(filePath)) { res.status(404); throw new Error('Stored verification document is missing'); }
  if (req.query.inline === 'true') {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    return res.sendFile(filePath);
  }
  res.download(filePath, doc.originalName);
});

export const getAllRequests = asyncHandler(async (req, res) => res.json(await populateRequest(Request.find().sort({ createdAt: -1 }))));
