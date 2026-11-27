# ADR-062: Purge the resume subsystem entirely

Date: 2026-11-28
Status: Accepted
Supersedes: ADR-045 (resume autofill accuracy), ADR-049 (one resume per account), ADR-061 (registration create-resume)

## Context

Every fact an employer needs to evaluate a candidate — contact, barangay, employment
status, preferences, skills, education, work experience — is already a structured
field on the job-seeker profile, and employers already read it (SeekerProfileCard,
applicant review modal, super-admin seeker detail). The uploaded resume file
duplicated that data in an opaque PDF/DOCX, plus the storage, security, backup, and
retention surface that comes with user-uploaded PII files. Product decision: the
resume upload is redundant; the profile is the single source.

## Decision

Remove the entire resume subsystem, not just its UI:

- **Surfaces**: profile "My resumes" tab (upload/view/download/delete/autofill),
  registration "Create a Resume" builder + modal + `/api/resumes/generate` +
  `resumeDoc.js` renderers, the apply-flow "Resume to attach" select, employer
  "View resume" actions (Applicants modal, SeekerProfileCard), super-admin resumes
  list + `GET /api/admin/seekers/:id/resumes`.
- **API**: `POST/DELETE/GET /files/resumes*`, `POST /api/resumes/generate`, resume
  embedding in the applicants list, `resume_id` handling in `POST /api/applications`.
- **Data**: migration drops `job_applications.resume_id` and the `public.resumes`
  table (its indexes drop with it); stored files are deleted from `UPLOAD_DIR/resumes/`
  by ops after deploy (irreversible, approved 2026-11-28).
- **Dead code**: `src/shared/lib/resumeText.js`, `src/shared/utils/resumeAutofill.js`,
  `api.postBlob`, the autofill eval harness and its npm script.

## Consequences

- Applications never carry an attachment; they already worked with `resume_id = null`
  (nullable since inception), so no application flow changes shape.
- Applying sends the profile only; employer evaluation happens against profile fields.
- Employer accreditation documents keep their disk-upload flow untouched (multer,
  `UPLOAD_DIR/documents`, `signedUrl('documents', …)`), as do profile images.
- Backup, restore, and retention-purge procedures lose their resume half.
- AI-assistant briefs and public copy no longer mention resumes.
