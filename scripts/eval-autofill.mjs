// Eval harness for resume auto-fill accuracy.
//
// Scans sample_pdf/golden/** for PDF/DOCX fixtures, extracts their text with
// the same pdfjs-legacy + joinPdfItems path proven in the old test_samples.mjs,
// maps the text through mapResumeText (heuristic mode), and scores the result
// against a sibling <basename>.expected.json. Prints a per-field accuracy table
// plus the machine-readable report; always exits 0 (advisory tool).
import { register } from "node:module";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import fs from "node:fs";
import path from "node:path";

// resumeAutofill.js imports "./phone" without an extension, which Node ESM
// will not resolve. Register a resolve hook that appends ".js" to extensionless
// relative specifiers, then import the mapper dynamically so the hook applies.
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.(?:js|mjs|cjs|json|node)$/.test(specifier)) {
    return nextResolve(specifier + '.js', context);
  }
  return nextResolve(specifier, context);
}
`)}`,
);

const { mapResumeText } = await import("../src/shared/utils/resumeAutofill.js");

// Configure pdfjs worker for Node.
pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.min.mjs";

const GOLDEN_DIR = path.resolve("sample_pdf", "golden");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);
const MODE = args.mode === "llm" ? "llm" : "heuristic";
const BASE = (args.base || "http://localhost:4000").replace(/\/$/, "");
const FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "email",
  "mobileNumber",
  "birthdate",
  "houseNumberUnit",
  "streetAddress",
  "subdivisionBuilding",
  "barangayDistrict",
  "cityMunicipality",
  "provinceState",
  "postalCode",
  "skills",
  "education.level",
  "education.school",
  "education.field",
  "education.year",
];

function expectedValue(expected, key) {
  if (key === "skills") return expected.skills || [];
  if (key.startsWith("education.")) return (expected.education || {})[key.slice("education.".length)] ?? "";
  return (expected.fields || {})[key] ?? "";
}

function gotValue(got, key) {
  if (key === "skills") return got.skills || [];
  if (key.startsWith("education.")) return (got.education || {})[key.slice("education.".length)] ?? "";
  return got[key] ?? "";
}

// Normalized exact-match: trim + collapse whitespace runs + case-fold.
function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function scalarPass(expected, got) {
  return normalize(expected) === normalize(got);
}

// Token-set F1: |expected ∩ got| / |expected ∪ got|. Empty/empty is a 1.0.
function skillsF1(expected, got) {
  const e = new Set((Array.isArray(expected) ? expected : []).map(normalize));
  const g = new Set((Array.isArray(got) ? got : []).map(normalize));
  if (e.size === 0 && g.size === 0) return 1;
  let inter = 0;
  for (const token of e) if (g.has(token)) inter++;
  const union = e.size + g.size - inter;
  return union === 0 ? 1 : inter / union;
}

async function extractText(filePath, ext) {
  const buffer = fs.readFileSync(filePath);
  if (ext === "pdf") {
    const uint8 = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Replicate joinPdfItems line rebuilding.
      let out = "";
      let line = "";
      let lastY = null;
      for (const it of content.items) {
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
      text += out;
    }
    return text;
  }
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value || "";
}

function printTable(report) {
  const rows = Object.entries(report.perFieldAccuracy);
  const width = Math.max(8, ...rows.map(([f]) => f.length));
  const fmt = (n) => String(n).padStart(7);
  console.log(`\n${"field".padEnd(width)}  ${"correct"}  ${"filled"}  ${"total"}  accuracy`);
  console.log(`${"-".repeat(width)}  -------  -------  -------  --------`);
  for (const [field, acc] of rows) {
    const pct = acc.filled === 0 ? "—" : `${((acc.correct / acc.filled) * 100).toFixed(1)}%`;
    console.log(`${field.padEnd(width)}  ${fmt(acc.correct)}  ${fmt(acc.filled)}  ${fmt(acc.total)}  ${pct}`);
  }
}

async function main() {
  const report = {
    mode: MODE,
    perFieldAccuracy: Object.fromEntries(FIELDS.map((f) => [f, { correct: 0, filled: 0, total: 0 }])),
    files: [],
  };

  let entries = [];
  if (fs.existsSync(GOLDEN_DIR)) {
    entries = fs.readdirSync(GOLDEN_DIR);
  } else {
    console.log(`golden dir missing: ${GOLDEN_DIR}`);
  }
  const sources = entries
    .filter((f) => f.endsWith(".pdf") || f.endsWith(".docx"))
    .sort();

  let failed = 0;
  let needsServerCount = 0;
  for (const file of sources) {
    const ext = file.endsWith(".pdf") ? "pdf" : "docx";
    const base = file.slice(0, -(ext.length + 1));
    const expectedPath = path.join(GOLDEN_DIR, `${base}.expected.json`);

    if (!fs.existsSync(expectedPath)) {
      report.files.push({ file, failed: true, error: "missing expected.json" });
      failed++;
      continue;
    }
    let expected;
    try {
      expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
    } catch (e) {
      report.files.push({ file, failed: true, error: `unreadable expected.json: ${e.message}` });
      failed++;
      continue;
    }

    let text;
    try {
      text = await extractText(path.join(GOLDEN_DIR, file), ext);
    } catch (e) {
      report.files.push({ file, failed: true, error: e.message });
      failed++;
      continue;
    }

    let got;
    let needsServer = false;
    if (MODE === "llm") {
      try {
        const res = await fetch(`${BASE}/api/ai/resume-extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) needsServer = true;
        else {
          const body = await res.json();
          if (body && body.fields) got = body.fields;
          else needsServer = true;
        }
      } catch {
        needsServer = true;
      }
    }
    if (needsServer) {
      report.files.push({ file, needsServer: true, error: "needs-server: endpoint unreachable or returned non-OK" });
      needsServerCount++;
      continue;
    }
    if (!got) got = mapResumeText(text);

    const fields = {};
    for (const field of FIELDS) {
      report.perFieldAccuracy[field].total++;
      const exp = expectedValue(expected, field);
      const g = gotValue(got, field);
      if (field === "skills") {
        const pass = skillsF1(exp, g);
        fields[field] = { expected: exp, got: g, pass };
        if (exp.length > 0) {
          report.perFieldAccuracy[field].filled++;
          if (pass === 1) report.perFieldAccuracy[field].correct++;
        }
      } else {
        const pass = scalarPass(exp, g);
        fields[field] = { expected: exp, got: g, pass };
        if (typeof exp === "string" && exp.trim() !== "") {
          report.perFieldAccuracy[field].filled++;
          if (pass) report.perFieldAccuracy[field].correct++;
        }
      }
    }
    report.files.push({ file, fields });
  }

  const scored = report.files.filter((f) => !f.failed && !f.needsServer).length;
  console.log(`mode: ${report.mode}`);
  console.log(`files: ${scored} scored, ${failed} failed, ${needsServerCount} needs-server`);
  printTable(report);
  console.log();
  console.log(JSON.stringify(report, null, 2));
}

try {
  await main();
} catch (e) {
  // Advisory tool: report the problem and stay green for callers.
  console.error(`eval:autofill failed: ${e.message}`);
}
