import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// One fixed layout, shared by both renderers (ADR-061). The payload is
// validated at the route boundary; this module only formats it for display.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const trim = (v) => (typeof v === 'string' ? v.trim() : '');

// 'YYYY-MM-DD' -> 'MMMM D, YYYY' (no Date parsing: timezones must not shift a day)
function formatDay(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trim(v));
  const month = m && MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : '';
}

// 'YYYY-MM' -> 'MMMM YYYY'
function formatMonth(v) {
  const m = /^(\d{4})-(\d{2})$/.exec(trim(v));
  const month = m && MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : '';
}

function normalizeResume(resume = {}) {
  const address = resume.address || {};
  const education = resume.education || {};
  const fullName = [resume.firstName, resume.middleName, resume.lastName, resume.suffix]
    .map(trim).filter(Boolean).join(' ') || 'Resume';

  const birthdate = formatDay(resume.birthdate);
  const nationality = trim(resume.nationality);

  return {
    fullName,
    contactLine: [trim(resume.email), trim(resume.phone)].filter(Boolean).join(' · '),
    addressLine: [address.street, address.barangay, address.cityMunicipality, address.provinceState, address.postalCode]
      .map(trim).filter(Boolean).join(', '),
    personalLine: [birthdate && `Birthdate: ${birthdate}`, nationality && `Nationality: ${nationality}`]
      .filter(Boolean).join(' · '),
    education: [
      [trim(education.level), trim(education.school)].filter(Boolean).join(' — '),
      [trim(education.field), trim(education.year)].filter(Boolean).join(' · '),
    ].filter(Boolean),
    skills: (Array.isArray(resume.skills) ? resume.skills : []).map(trim).filter(Boolean),
    experience: (Array.isArray(resume.experience) ? resume.experience : []).map((e) => {
      const start = formatMonth(e.startDate);
      const end = formatMonth(e.endDate) || (start ? 'Present' : '');
      return {
        heading: [trim(e.jobTitle), trim(e.company)].filter(Boolean).join(' — '),
        dates: [start, end].filter(Boolean).join('–'),
        description: trim(e.description),
      };
    }).filter((e) => e.heading || e.dates || e.description),
  };
}

export function renderResumePdf(resume) {
  const m = normalizeResume(resume);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 56, right: 56 },
    info: { Title: `${m.fullName} Resume` },
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.font('Helvetica-Bold').fontSize(18).text(m.fullName, { width });
  for (const line of [m.contactLine, m.addressLine, m.personalLine]) {
    if (line) doc.moveDown(0.25).font('Helvetica').fontSize(10).text(line, { width });
  }

  const section = (title, draw) => {
    doc.moveDown(1).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase(), { width });
    doc.moveDown(0.35).font('Helvetica').fontSize(10);
    draw();
  };

  if (m.education.length) {
    section('Education', () => {
      for (const line of m.education) doc.text(line, { width });
    });
  }

  if (m.experience.length) {
    section('Experience', () => {
      m.experience.forEach((e, i) => {
        if (i) doc.moveDown(0.5);
        if (e.heading) doc.font('Helvetica-Bold').text(e.heading, { width });
        if (e.dates) doc.font('Helvetica').fontSize(9).text(e.dates, { width });
        if (e.description) doc.font('Helvetica').fontSize(10).text(e.description, { width });
      });
    });
  }

  if (m.skills.length) {
    section('Skills', () => doc.text(m.skills.join(', '), { width }));
  }

  doc.end();
  return done;
}

const heading = (text) => new Paragraph({
  spacing: { before: 240, after: 80 },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 24 })],
});

const line = (text, { bold = false, size = 20 } = {}) => new Paragraph({
  spacing: { after: 60 },
  children: [new TextRun({ text, bold, size })],
});

export async function renderResumeDocx(resume) {
  const m = normalizeResume(resume);
  const children = [line(m.fullName, { bold: true, size: 36 })];

  for (const text of [m.contactLine, m.addressLine, m.personalLine]) {
    if (text) children.push(line(text));
  }

  if (m.education.length) {
    children.push(heading('Education'), ...m.education.map((text) => line(text)));
  }

  if (m.experience.length) {
    children.push(heading('Experience'));
    for (const e of m.experience) {
      if (e.heading) children.push(line(e.heading, { bold: true }));
      if (e.dates) children.push(line(e.dates, { size: 18 }));
      if (e.description) children.push(line(e.description));
    }
  }

  if (m.skills.length) {
    children.push(heading('Skills'), line(m.skills.join(', ')));
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
