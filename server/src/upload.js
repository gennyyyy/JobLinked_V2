import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { err } from './util.js';

// DOC/PDF/images. webp is avatar/logo-only (the seeker photo input accepts it).
const DISK_EXTS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 2 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

// Deterministic root: a relative UPLOAD_DIR resolves against the server package
// (server/), never process.cwd(). Starting the API from the repo root, a
// service manager, or `npm --prefix server` must all use the same folder —
// otherwise files "disappear" after a restart (file-storage audit F7).
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configured = process.env.UPLOAD_DIR || 'uploads';
export const uploadDir = path.isAbsolute(configured) ? configured : path.resolve(SERVER_ROOT, configured);
fs.mkdirSync(uploadDir, { recursive: true });

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

const extOf = (name) => (path.extname(String(name || '')).slice(1) || '').toLowerCase();

// Magic-byte check. Extensions are a client claim; the first bytes are not
// (file-storage audit F6: `MZ…` bytes named .pdf used to be accepted/served).
const beginsWith = (buf, sig) => sig.every((byte, i) => buf[i] === byte);
const ASCII = (buf, from, to) => buf.subarray(from, to).toString('latin1');

export function matchesSignature(buffer, ext) {
  const b = buffer || Buffer.alloc(0);
  switch (String(ext || '').toLowerCase()) {
    case 'pdf': return ASCII(b, 0, 5) === '%PDF-';
    case 'png': return beginsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpg':
    case 'jpeg': return beginsWith(b, [0xff, 0xd8, 0xff]);
    case 'docx': return (beginsWith(b, [0x50, 0x4b, 0x03, 0x04]) || beginsWith(b, [0x50, 0x4b, 0x05, 0x06])) && b.toString('latin1').includes('[Content_Types].xml');
    case 'doc': return beginsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'webp': return ASCII(b, 0, 4) === 'RIFF' && ASCII(b, 8, 12) === 'WEBP';
    default: return false;
  }
}

export const mimeForExt = (ext) => {
  switch (String(ext || '').toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
};

function readHead(filePath, bytes = 16) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

const unlinkQuiet = (p) => { try { fs.unlinkSync(p); } catch { /* already gone */ } };

// Disk uploads (resumes, accreditation documents): bucket is fixed per route,
// single file field 'file'.
export const uploadSingle = (bucket) => (req, res, next) => {
  req.uploadBucket = bucket;
  multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter: (_req, file, cb) => {
    if (!DISK_EXTS.includes(extOf(file.originalname))) return cb(new Error('Only PDF, DOC, DOCX, PNG, or JPG files are allowed.'));
    cb(null, true);
  } }).single('file')(req, res, (e) => {
    if (e) return err(res, 400, 'BAD_REQUEST', e.message);
    if (!req.file) return err(res, 400, 'BAD_REQUEST', 'No file uploaded');
    const ext = extOf(req.file.originalname);
    const headBytes = ext === 'docx' ? req.file.size : 16;
    if (!matchesSignature(readHead(req.file.path, headBytes), ext)) {
      unlinkQuiet(req.file.path);
      return err(res, 400, 'BAD_REQUEST', 'File content does not match its extension.');
    }
    if (ext === 'pdf' && req.file.size > MAX_PDF_SIZE) {
      unlinkQuiet(req.file.path);
      return err(res, 400, 'BAD_REQUEST', 'PDF files must be 2 MB or smaller.');
    }
    next();
  });
};

// In-memory image upload (avatars / company logos). The bytes go straight into
// Postgres via profile_images, so no temp file exists to clean up.
export const uploadImage = () => (req, res, next) => {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE }, fileFilter: (_req, file, cb) => {
    if (!IMAGE_EXTS.includes(extOf(file.originalname))) return cb(new Error('Only PNG, JPG, or WEBP images are allowed.'));
    cb(null, true);
  } }).single('file')(req, res, (e) => {
    if (e) return err(res, 400, 'BAD_REQUEST', e.message);
    if (!req.file) return err(res, 400, 'BAD_REQUEST', 'No image uploaded');
    const ext = extOf(req.file.originalname);
    if (!matchesSignature(req.file.buffer, ext)) {
      return err(res, 400, 'BAD_REQUEST', 'Image content does not match its extension.');
    }
    req.imageExt = ext;
    next();
  });
};

// Relative DB path: resumes/<userId>/<uuid>-<name>
export const relPath = (bucket, userId, filename) => `${bucket}/${userId}/${filename}`;
