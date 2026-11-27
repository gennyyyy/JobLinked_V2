import { Router } from 'express';
import { ah, err } from '../util.js';
import { renderResumeDocx, renderResumePdf } from '../resumeDoc.js';

// ADR-061: unauthenticated, stateless renderer. The caps below ARE the
// security boundary — there is no session and no schema behind this route.
const MAX = {
  name: 100,
  email: 200,
  phone: 30,
  nationality: 100,
  address: 200,
  education: 200,
  skill: 60,
  jobTitle: 120,
  company: 120,
  description: 2000,
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

// '' for absent, the string when valid, null when the client sent junk.
function text(v, max) {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' && v.length <= max ? v : null;
}

function date(v, re, max) {
  if (v === undefined || v === null || v === '') return '';
  return typeof v === 'string' && v.length <= max && re.test(v) ? v : null;
}

function object(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function list(v, max) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) && v.length <= max ? v : null;
}

function validateResume(body) {
  const top = object(body);
  if (!top || (top.format !== 'pdf' && top.format !== 'docx')) return null;
  const r = object(top.resume);
  if (!r) return null;

  const person = {
    firstName: text(r.firstName, MAX.name),
    middleName: text(r.middleName, MAX.name),
    lastName: text(r.lastName, MAX.name),
    suffix: text(r.suffix, MAX.name),
    email: text(r.email, MAX.email),
    phone: text(r.phone, MAX.phone),
    birthdate: date(r.birthdate, DAY, 10),
    nationality: text(r.nationality, MAX.nationality),
  };
  if (Object.values(person).includes(null)) return null;

  const a = r.address === undefined || r.address === null ? {} : object(r.address);
  if (!a) return null;
  const address = {
    street: text(a.street, MAX.address),
    barangay: text(a.barangay, MAX.address),
    cityMunicipality: text(a.cityMunicipality, MAX.address),
    provinceState: text(a.provinceState, MAX.address),
    postalCode: text(a.postalCode, MAX.address),
  };
  if (Object.values(address).includes(null)) return null;

  let education = null;
  if (r.education !== undefined && r.education !== null) {
    const e = object(r.education);
    if (!e) return null;
    education = {
      level: text(e.level, MAX.education),
      school: text(e.school, MAX.education),
      field: text(e.field, MAX.education),
      year: text(e.year, MAX.education),
    };
    if (Object.values(education).includes(null)) return null;
  }

  const skills = list(r.skills, 20);
  if (!skills || skills.some((s) => typeof s !== 'string' || s.length > MAX.skill)) return null;

  const rawExperience = list(r.experience, 10);
  if (!rawExperience) return null;
  const experience = [];
  for (const item of rawExperience) {
    const e = object(item);
    if (!e) return null;
    const entry = {
      jobTitle: text(e.jobTitle, MAX.jobTitle),
      company: text(e.company, MAX.company),
      startDate: date(e.startDate, MONTH, 7),
      endDate: date(e.endDate, MONTH, 7),
      description: text(e.description, MAX.description),
    };
    if (Object.values(entry).includes(null)) return null;
    experience.push(entry);
  }

  return { format: top.format, resume: { ...person, address, education, skills, experience } };
}

function sanitize(resume) {
  return [resume.firstName, resume.middleName, resume.lastName, resume.suffix]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'Resume';
}

const router = Router();

router.post('/resumes/generate', ah(async (req, res) => {
  const parsed = validateResume(req.body);
  if (!parsed) return err(res, 400, 'VALIDATION_ERROR', 'Invalid resume data.');

  const isPdf = parsed.format === 'pdf';
  const fileName = `${sanitize(parsed.resume)}-Resume.${isPdf ? 'pdf' : 'docx'}`;
  const buffer = isPdf ? await renderResumePdf(parsed.resume) : await renderResumeDocx(parsed.resume);

  res.setHeader('Content-Type', isPdf
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.send(buffer);
}));

export default router;
