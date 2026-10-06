import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import { mapResumeText } from './src/shared/utils/resumeAutofill.js';
import fs from 'node:fs';
import path from 'node:path';

// Configure pdfjs worker for Node
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';

const dir = './sample_pdf';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

const results = [];

for (const file of files) {
  const filePath = path.join(dir, file);
  const ext = file.endsWith('.pdf') ? 'pdf' : 'docx';
  const buffer = fs.readFileSync(filePath);

  try {
    let text = '';
    if (ext === 'pdf') {
      const uint8 = new Uint8Array(buffer);
      const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Replicate joinPdfItems logic
        let out = '';
        let line = '';
        let lastY = null;
        for (const it of content.items) {
          const y = Array.isArray(it.transform) ? it.transform[5] : null;
          if (line && typeof y === 'number' && typeof lastY === 'number' && Math.abs(y - lastY) > 2) {
            out += `${line}\n`;
            line = '';
          }
          if (typeof y === 'number') lastY = y;
          if (!it.str) {
            if (it.hasEOL && line) {
              out += `${line}\n`;
              line = '';
            }
            continue;
          }
          line += (line ? ' ' : '') + it.str;
          if (it.hasEOL) {
            out += `${line}\n`;
            line = '';
          }
        }
        if (line) out += `${line}\n`;
        text += out;
      }
    } else {
      const { value } = await mammoth.extractRawText({ path: filePath });
      text = value || '';
    }

    const mapped = mapResumeText(text);
    results.push({ file, ext, textLength: text.length, textPreview: text.slice(0, 500), mapped });
  } catch (e) {
    results.push({ file, ext, error: e.message, stack: e.stack?.split('\n').slice(0, 3).join('\n') });
  }
}

console.log(JSON.stringify(results, null, 2));
