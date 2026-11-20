import { useState } from "react";
import { getReferenceValues } from "@/shared/services/reference";
import { mapResumeText, matchSkills } from "@/shared/utils/resumeAutofill";
import { MAX_PDF_SIZE, MAX_RESUME_SIZE } from "./jobSeekerRegistration";

const FIELD_LABELS = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  email: "Email",
  mobileNumber: "Mobile number",
  birthdate: "Birthdate",
  houseNumberUnit: "House/Unit",
  streetAddress: "Street address",
  subdivisionBuilding: "Subdivision/Building",
  barangayDistrict: "Barangay/District",
  cityMunicipality: "City/Municipality",
  provinceState: "Province/State",
  postalCode: "Postal code",
  skills: "Skills",
  education: "Education",
};

export function useResumeAutofill({ form, setForm, setEducation }) {
  const [autofillStatus, setAutofillStatus] = useState("");
  const [unrecognizedSkills, setUnrecognizedSkills] = useState([]);
  const [touched, setTouched] = useState([]);
  async function handleResumeChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setTouched([]);
      setAutofillStatus("Couldn't read this format — upload a PDF or DOCX to autofill.");
      return;
    }
    if (ext === "pdf" && file.size > MAX_PDF_SIZE) {
      setTouched([]);
      setAutofillStatus("PDF files must be 2 MB or smaller.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      setTouched([]);
      setAutofillStatus("DOCX files must be 5 MB or smaller.");
      return;
    }
    setAutofillStatus("Reading your resume…");
    try {
      const { extractResumeText } = await import("@/shared/lib/resumeText");
      const text = await extractResumeText(file);
      const mapped = mapResumeText(text);

      const skills = Array.isArray(mapped.skills) ? mapped.skills : [];

      // The signup picker only accepts listed vocabulary skills. Select the
      // ones the vocabulary knows; name the rest so nothing is lost silently.
      let matchedSkills = [];
      if (skills.length) {
        const vocabulary = await getReferenceValues("skill").catch(() => []);
        const result = matchSkills(skills, vocabulary);
        matchedSkills = result.matched;
        setUnrecognizedSkills(result.unrecognized);
      } else {
        setUnrecognizedSkills([]);
      }

      const filled = {};
      const touchedKeys = [];
      for (const [key, value] of Object.entries(mapped)) {
        if (key === "skills" || key === "education") continue;
        if (!String(value || "").trim()) continue;
        const pv = form?.[key];
        const prevSet = Array.isArray(pv) ? pv.length > 0 : String(pv || "").trim() !== "";
        if (!prevSet) {
          filled[key] = value;
          touchedKeys.push(key);
        }
      }

      const asList = (value) => (Array.isArray(value)
        ? [...value]
        : String(value || "").split(",").map((s) => s.trim()).filter(Boolean));
      const prevSkills = asList(form?.skills);
      const skillsAdded = matchedSkills.some(
        (s) => !prevSkills.some((t) => t.toLowerCase() === s.toLowerCase()),
      );

      const edu = Object.fromEntries(
        Object.entries(mapped.education || {}).filter(([, v]) => String(v || "").trim()),
      );
      let eduAdded = false;
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
          ...(matchedSkills.length
            ? {
                skills: (() => {
                  const current = asList(prev.skills);
                  for (const s of matchedSkills) {
                    if (!current.some((t) => t.toLowerCase() === s.toLowerCase())) current.push(s);
                  }
                  return current;
                })(),
              }
            : {}),
        };
      });

      if (Object.keys(edu).length) {
        setEducation((prev) => {
          const kept = {};
          for (const [k, v] of Object.entries(edu)) {
            if (!String(prev[k] || "").trim()) {
              kept[k] = v;
              eduAdded = true;
            }
          }
          return Object.keys(kept).length ? { ...prev, ...kept } : prev;
        });
      }

      if (matchedSkills.length && skillsAdded) touchedKeys.push("skills");
      if (eduAdded) touchedKeys.push("education");

      setTouched(touchedKeys);
      if (touchedKeys.length) {
        const labels = touchedKeys.map((k) => FIELD_LABELS[k]).join(", ");
        setAutofillStatus(`Autofill done — please check: ${labels}.`);
      } else {
        setAutofillStatus("Couldn't find any details to fill in — enter them manually.");
      }
    } catch (err) {
      setTouched([]);
      setAutofillStatus(err?.message || "Couldn't read this resume — enter them manually.");
    }
  }

  return { autofillStatus, unrecognizedSkills, touched, handleResumeChange };
}