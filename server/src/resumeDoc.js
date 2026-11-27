import PDFDocument from 'pdfkit';
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx';

// One fixed layout, shared by both renderers (ADR-061). The payload is
// validated at the route boundary; this module only formats it for display.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Brand tokens from src/index.css (--navy/dark-blue, --muted-foreground,
// --border, --foreground). docx takes hex without the leading '#'.
const DARK_BLUE = '#12325B';
const MUTED = '#475569';
const RULE = '#E4EAF1';
const BODY = '#0F172A';
const DOC = {
  darkBlue: DARK_BLUE.slice(1),
  muted: MUTED.slice(1),
  rule: RULE.slice(1),
  body: BODY.slice(1),
};

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
        dates: [start, end].filter(Boolean).join(' – '),
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
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  const centered = (text, { bold = false, size = 10, color = MUTED, gap = 0 } = {}) => {
    if (gap) doc.moveDown(gap);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
      .text(text, { width, align: 'center' });
  };

  centered(m.fullName, { bold: true, size: 20, color: DARK_BLUE });
  if (m.contactLine) centered(m.contactLine, { gap: 0.6 });
  if (m.addressLine) centered(m.addressLine, { gap: 0.2 });
  if (m.personalLine) centered(m.personalLine, { gap: 0.2 });

  const section = (title, draw) => {
    // Keep a heading with its first lines instead of orphaning it at a page edge.
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();
    doc.moveDown(1.4).font('Helvetica-Bold').fontSize(11).fillColor(DARK_BLUE)
      .text(title.toUpperCase(), { width });
    const ruleY = doc.y + 3;
    doc.moveTo(left, ruleY).lineTo(left + width, ruleY).lineWidth(0.75).strokeColor(RULE).stroke();
    doc.y = ruleY + 8;
    doc.font('Helvetica').fontSize(10).fillColor(BODY);
    draw();
  };

  if (m.education.length) {
    section('Education', () => {
      m.education.forEach((text) => doc.text(text, { width }));
    });
  }

  if (m.experience.length) {
    section('Experience', () => {
      m.experience.forEach((e, i) => {
        if (i) doc.moveDown(1);
        if (e.heading) doc.font('Helvetica-Bold').fontSize(10).fillColor(BODY).text(e.heading, { width });
        if (e.dates) doc.moveDown(0.2).font('Helvetica').fontSize(9).fillColor(MUTED).text(e.dates, { width });
        if (e.description) doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor(BODY).text(e.description, { width });
      });
    });
  }

  if (m.skills.length) {
    section('Skills', () => doc.text(m.skills.join(', '), { width }));
  }

  doc.end();
  return done;
}

const paragraph = (text, { bold = false, size = 20, color = DOC.body, align = AlignmentType.LEFT, after = 40 } = {}) => new Paragraph({
  alignment: align,
  spacing: { after },
  children: [new TextRun({ text, bold, size, color })],
});

const heading = (text) => new Paragraph({
  spacing: { before: 240, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: DOC.rule } },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: DOC.darkBlue })],
});

export async function renderResumeDocx(resume) {
  const m = normalizeResume(resume);
  const children = [paragraph(m.fullName, {
    bold: true, size: 40, color: DOC.darkBlue, align: AlignmentType.CENTER, after: 60,
  })];

  for (const text of [m.contactLine, m.addressLine, m.personalLine]) {
    if (text) children.push(paragraph(text, { color: DOC.muted, align: AlignmentType.CENTER, after: 20 }));
  }

  if (m.education.length) {
    children.push(heading('Education'), ...m.education.map((text) => paragraph(text)));
  }

  if (m.experience.length) {
    children.push(heading('Experience'));
    for (const e of m.experience) {
      if (e.heading) children.push(paragraph(e.heading, { bold: true }));
      if (e.dates) children.push(paragraph(e.dates, { size: 18, color: DOC.muted, after: 30 }));
      if (e.description) children.push(paragraph(e.description, { after: 160 }));
    }
  }

  if (m.skills.length) {
    children.push(heading('Skills'), paragraph(m.skills.join(', ')));
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
