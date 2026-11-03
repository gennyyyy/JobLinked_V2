import { useState } from "react";
import { mapResumeText } from "@/shared/utils/resumeAutofill";
import { MAX_PDF_SIZE, MAX_RESUME_SIZE } from "./jobSeekerRegistration";

export function useResumeAutofill({ setForm, setEducation }) {
  const [autofillStatus, setAutofillStatus] = useState("");

  // Resume -> form autofill. PDF/DOCX only; anything else stays blank and the
  // user fills it in. Non-empty mapped values merge in, so hand-typed fields
  // the resume didn't cover are preserved.
  async function handleResumeChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setAutofillStatus("Couldn't read this format — upload a PDF or DOCX to autofill.");
      return;
    }
    if (ext === "pdf" && file.size > MAX_PDF_SIZE) {
      setAutofillStatus("PDF files must be 2 MB or smaller.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      setAutofillStatus("DOCX files must be 5 MB or smaller.");
      return;
    }
    setAutofillStatus("Reading your resume…");
    try {
      // pdfjs + mammoth are ~850 kB: load them only when a resume is picked.
      const { extractResumeText } = await import("@/shared/lib/resumeText");
      const mapped = mapResumeText(await extractResumeText(file));
      const skills = Array.isArray(mapped.skills) ? mapped.skills : [];
      const filled = {};
      for (const [key, value] of Object.entries(mapped)) {
        if (key === "skills" || key === "education") continue;
        if (String(value || "").trim()) {
          filled[key] = value;
        }
      }
      const edu = Object.fromEntries(
        Object.entries(mapped.education || {}).filter(([, v]) => String(v || "").trim()),
      );
      setForm((prev) => {
        const merged = {};
        for (const [key, value] of Object.entries(filled)) {
          const pv = prev[key];
          const prevSet = Array.isArray(pv) ? pv.length > 0 : String(pv || "").trim() !== "";
          if (!prevSet) merged[key] = value;
        }
        return {
          ...prev,
          ...merged,
          ...(skills.length
            ? {
              skills: (() => {
                const combined = String(prev.skills || "").split(",").map((s) => s.trim()).filter(Boolean);
                for (const s of skills) {
                  if (!combined.some((t) => t.toLowerCase() === s.toLowerCase())) combined.push(s);
                }
                return combined.join(", ");
              })(),
            }
            : {}),
        };
      });
      if (Object.keys(edu).length) {
        setEducation((prev) => {
          const kept = {};
          for (const [k, v] of Object.entries(edu)) {
            if (!String(prev[k] || "").trim()) kept[k] = v;
          }
          return Object.keys(kept).length ? { ...prev, ...kept } : prev;
        });
      }
      const count = Object.keys(filled).length + (skills.length ? 1 : 0);
      setAutofillStatus(
        count
          ? `Filled ${count} field${count === 1 ? "" : "s"}${skills.length ? ` · ${skills.length} skills found` : ""}${Object.keys(edu).length ? " · highest education added" : ""}.`
          : "Couldn't find any details to fill in — enter them manually.",
      );
    } catch (err) {
      setAutofillStatus(err?.message || "Couldn't read this resume — enter your details manually.");
    }
  }

  return { autofillStatus, handleResumeChange };
}
