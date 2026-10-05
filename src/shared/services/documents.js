import { api } from '../lib/api';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];

export function validateFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Only PDF, DOC, DOCX, PNG, or JPG files are allowed.';
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'Invalid file type.';
  if (file.size > MAX_FILE_SIZE) return 'File must be 5 MB or smaller.';
  return null;
}

export function makeDocPath(userId, fileName) {
  return `${userId}/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export async function uploadResume(userId, file) {
  void userId; // path is server-owned now; identity comes from the token
  const form = new FormData();
  form.append('file', file);
  const { path } = await api.post('files/resumes', form);
  return path;
}

export async function uploadDocument(userId, docType, file, companyId, accreditationId = null) {
  void userId;
  void companyId;
  const form = new FormData();
  form.append('file', file);
  form.append('doc_type', docType);
  if (accreditationId) form.append('accreditation_id', accreditationId);
  return api.post('documents', form);
}

export async function listResumes(seekerId) {
  void seekerId;
  return api.get('files/resumes/mine');
}

export async function setActiveResume(seekerId, resumeId) {
  void seekerId;
  return api.post(`files/resumes/${resumeId}/activate`);
}

export async function deleteResume(resumeId, filePath) {
  void filePath; // server deletes the DB row + disk file together
  return api.del(`files/resumes/${resumeId}`);
}

export async function listCompanyDocuments(companyId) {
  return api.get(`documents/company/${companyId}`);
}

export async function updateDocumentStatus(id, status, remarks = null) {
  return api.patch(`documents/${id}`, { status, remarks });
}

export async function listAccreditations(companyId) {
  return api.get(`accreditations/company/${companyId}`);
}

// ponytail: client-side latest-row scan O(n), server GROUP BY / view if employers > ~10k
export function latestAccByCompany(accs) {
  const latest = {};
  (accs || []).forEach((a) => { if (!(a.company_id in latest)) latest[a.company_id] = a; });
  return latest;
}

export async function createAccreditation(companyId) {
  return api.post('accreditations', { company_id: companyId });
}

export async function updateAccreditation(id, patch) {
  return api.patch(`accreditations/${id}`, patch);
}

// Replaces signedUrl: the API streams the file (auth + ownership checked
// server-side), so fetch it as a blob and hand the page an object URL —
// same string-in/window.open-out shape as before.
export async function signedUrl(bucket, path, expiresIn) {
  void expiresIn; // no expiry concept on same-transaction blob URLs
  const rel = String(path || '').replace(new RegExp(`^${bucket}/`), '');
  return URL.createObjectURL(await api.blob(`files/${bucket}/${rel}`));
}
