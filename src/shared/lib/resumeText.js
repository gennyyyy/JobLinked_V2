import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Client-only resume text extraction. No network, no token — runs on the
// picked File via arrayBuffer. Throws "couldn't read this format" for
// anything that isn't PDF or DOCX.
export async function extractResumeText(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const buf = await file.arrayBuffer();
  if (ext === "pdf") return extractPdf(buf);
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value || "";
  }
  throw new Error("Couldn't read this format — upload a PDF or DOCX to autofill.");
}

// pdfjs hands back one item per text run, not per line — space-joining them
// collapses the whole page into one giant line. Rebuild visual lines:
// same-baseline items space-join, hasEOL or a Y jump (transform[5])
// starts a new line. Pure + exported for tests; DOCX path untouched.
export function joinPdfItems(items) {
  let out = "";
  let line = "";
  let lastY = null;
  for (const it of items || []) {
    const y = Array.isArray(it.transform) ? it.transform[5] : null;
    if (line && typeof y === "number" && typeof lastY === "number" && Math.abs(y - lastY) > 2) {
      out += `${line}\n`;
      line = "";
    }
    if (typeof y === "number") lastY = y;
    if (!it.str) {
      if (it.hasEOL && line) {
        out += `${line}\n`;
        line = "";
      }
      continue;
    }
    line += (line ? " " : "") + it.str;
    if (it.hasEOL) {
      out += `${line}\n`;
      line = "";
    }
  }
  if (line) out += `${line}\n`;
  return out;
}

async function extractPdf(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    out += joinPdfItems(content.items);
  }
  return out;
}
