import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { err } from './util.js';

const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 2 * 1024 * 1024;

export const uploadDir = process.env.UPLOAD_DIR && path.isAbsolute(process.env.UPLOAD_DIR)
  ? process.env.UPLOAD_DIR
  : path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, req.uploadBucket, req.user.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${randomUUID()}-${safe}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = (path.extname(file.originalname).slice(1) || '').toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) return cb(new Error('Only PDF, DOC, DOCX, PNG, or JPG files are allowed.'));
  cb(null, true);
};

// bucket is fixed per-route ('resumes' | 'documents'); single file field 'file'.
export const uploadSingle = (bucket) => (req, res, next) => {
  req.uploadBucket = bucket;
  multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter }).single('file')(req, res, (e) => {
    if (e) return err(res, 400, 'BAD_REQUEST', e.message);
    if (!req.file) return err(res, 400, 'BAD_REQUEST', 'No file uploaded');
    const ext = (path.extname(req.file.originalname).slice(1) || '').toLowerCase();
    if (ext === 'pdf' && req.file.size > MAX_PDF_SIZE) {
      fs.unlink(req.file.path, () => {});
      return err(res, 400, 'BAD_REQUEST', 'PDF files must be 2 MB or smaller.');
    }
    next();
  });
};

// Relative DB path: resumes/<userId>/<uuid>-<name>
export const relPath = (bucket, userId, filename) => `${bucket}/${userId}/${filename}`;
