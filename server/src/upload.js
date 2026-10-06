import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const ALLOWED_EXTS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const uploadDir = process.env.UPLOAD_DIR?.startsWith('/')
  || process.env.UPLOAD_DIR?.match(/^[A-Za-z]:/)
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
    if (e) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: e.message } });
    if (!req.file) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded' } });
    next();
  });
};

// Relative DB path: resumes/<userId>/<uuid>-<name>
export const relPath = (bucket, userId, filename) => `${bucket}/${userId}/${filename}`;
