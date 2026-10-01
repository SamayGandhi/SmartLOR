import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const maxSize = (Number(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;
const allowedDocs = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const documentFilter = (req, file, cb) => {
  if (allowedDocs.has(file.mimetype) && /\.(pdf|jpe?g|png)$/i.test(file.originalname)) cb(null, true);
  else cb(new Error('Documents must be PDF, JPG or PNG files'));
};

export const uploadRequestDocs = multer({ storage, limits: { fileSize: maxSize }, fileFilter: documentFilter }).fields([
  { name: 'identityProof', maxCount: 1 }, { name: 'enrollmentProof', maxCount: 1 },
  { name: 'academicProof', maxCount: 1 }, { name: 'purposeProof', maxCount: 1 },
]);

export const uploadProfessorVerificationDocs = multer({ storage, limits: { fileSize: maxSize }, fileFilter: documentFilter }).fields([
  { name: 'governmentId', maxCount: 1 }, { name: 'facultyId', maxCount: 1 },
  { name: 'appointmentLetter', maxCount: 1 }, { name: 'qualification', maxCount: 1 },
  { name: 'experience', maxCount: 1 }, { name: 'cv', maxCount: 1 },
]);

export const uploadPdf = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for the final signed LOR'));
  },
});
