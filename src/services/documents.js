import { supabase } from '../lib/supabase';
import { logAudit } from './audit';
import { notify, notifyAdmins } from './notifications';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];

export function validateFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Only PDF, DOC, DOCX, PNG, or JPG files are allowed.';
  if (file.size > MAX_FILE_SIZE) return 'File must be 5 MB or smaller.';
  return null;
}

export async function uploadResume(userId, file) {
  const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('resumes').upload(path, file, { upsert: false });
  if (error) throw error;
  const { error: dbError } = await supabase.from('resumes').insert({ seeker_id: userId, file_path: path, file_name: file.name });
  if (dbError) throw dbError;
  await logAudit('resume.upload', 'resumes', path);
  return path;
}

export async function uploadDocument(userId, docType, file, companyId, accreditationId = null) {
  const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: dbError } = await supabase
    .from('employer_documents')
    .insert({ company_id: companyId, accreditation_id: accreditationId, doc_type: docType, file_path: path, file_name: file.name })
    .select()
    .maybeSingle();
  if (dbError) throw dbError;
  await logAudit('document.upload', 'employer_documents', data.id, { doc_type: docType });
  const { data: company } = await supabase.from('employers').select('company_name').eq('id', companyId).maybeSingle();
  await notifyAdmins({
    type: 'document',
    title: 'New document for review',
    message: `${company?.company_name || 'An employer'} uploaded ${String(docType).replace(/_/g, ' ')} for PESO verification.`,
    link: '/super-admin/accreditation',
  });
  return data;
}

export async function listResumes(seekerId) {
  const { data, error } = await supabase.from('resumes').select('*').eq('seeker_id', seekerId).order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function setActiveResume(seekerId, resumeId) {
  await supabase.from('resumes').update({ is_active: false }).eq('seeker_id', seekerId);
  const { data, error } = await supabase.from('resumes').update({ is_active: true }).eq('id', resumeId).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteResume(resumeId, filePath) {
  const { error } = await supabase.from('resumes').delete().eq('id', resumeId);
  if (error) throw error;
  await supabase.storage.from('resumes').remove([filePath]);
}

export async function listCompanyDocuments(companyId) {
  const { data, error } = await supabase
    .from('employer_documents')
    .select('*, reviewed_by:super_admins (full_name)')
    .eq('company_id', companyId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateDocumentStatus(id, status, remarks = null) {
  const { data, error } = await supabase
    .from('employer_documents')
    .update({ status, remarks, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, employers (id, company_name)')
    .maybeSingle();
  if (error) throw error;
  await logAudit(`document.${status}`, 'employer_documents', id);
  if (['verified', 'rejected'].includes(status) && data?.employers?.id) {
    await notify({
      userId: data.employers.id,
      type: 'document',
      title: `Document ${status}`,
      message: `Your ${String(data.doc_type).replace(/_/g, ' ')} for ${data.employers.company_name} was ${status}.${remarks ? ` PESO remarks: ${remarks}` : ''}`,
      link: '/employer/accreditation',
    });
  }
  return data;
}

export async function listAccreditations(companyId) {
  const { data, error } = await supabase
    .from('employer_accreditations')
    .select('*, decided_by:super_admins (full_name)')
    .eq('company_id', companyId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ponytail: client-side latest-row scan O(n), server GROUP BY / view if employers > ~10k
export function latestAccByCompany(accs) {
  const latest = {};
  (accs || []).forEach((a) => { if (!(a.company_id in latest)) latest[a.company_id] = a; });
  return latest;
}

export async function createAccreditation(companyId) {
  const { data, error } = await supabase
    .from('employer_accreditations')
    .insert({ company_id: companyId, status: 'pending' })
    .select()
    .maybeSingle();
  if (error) throw error;

  // Keep employers.accreditation_status in sync with the accreditation record
  await supabase.from('employers').update({ accreditation_status: 'pending' }).eq('id', companyId);

  await logAudit('accreditation.submit', 'employer_accreditations', data.id);
  await notifyAdmins({
    type: 'accreditation',
    title: 'Accreditation awaiting review',
    message: 'A new employer accreditation application is waiting for PESO review.',
    link: '/super-admin/accreditation',
  });
  return data;
}

export async function updateAccreditation(id, patch) {
  const { data, error } = await supabase
    .from('employer_accreditations')
    .update({ ...patch, ...(['approved', 'rejected', 'revoked'].includes(patch.status) ? { decided_at: new Date().toISOString() } : {}) })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;

  // Keep employers.accreditation_status in sync whenever the accreditation status changes
  if (patch.status && data?.company_id) {
    await supabase.from('employers').update({ accreditation_status: patch.status }).eq('id', data.company_id);
  }

  await logAudit(`accreditation.${patch.status}`, 'employer_accreditations', id);
  if (['approved', 'rejected', 'resubmission', 'revoked'].includes(patch.status)) {
    const { data: company } = await supabase.from('employers').select('id, company_name').eq('id', data.company_id).maybeSingle();
    if (company?.id) {
      await notify({
        userId: company.id,
        type: 'accreditation',
        title: `Accreditation ${patch.status}`,
        message: `Your accreditation for ${company.company_name} has been ${patch.status}.${patch.remarks ? ` PESO remarks: ${patch.remarks}` : ''}`,
        link: '/employer/accreditation',
      });
    }
  }
  return data;
}

export async function signedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  void logAudit('document.view', bucket, path);
  return data.signedUrl;
}
