import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FormSelect from "@/shared/components/FormSelect";
import useDialog from "@/shared/hooks/useDialog";
import { FIXED_MUNICIPALITY, FIXED_POSTAL_CODE, FIXED_PROVINCE, NATIONALITIES, SANTA_MARIA_BARANGAYS } from "@/shared/constants";
import { formatPhoneDisplay, normalizePhone, withPrefix } from "@/shared/utils/phone";
import { generateResume } from "@/shared/services/documents";
import { EDUCATION_LEVELS } from "./jobSeekerRegistration";

const EMPTY_EXPERIENCE = { jobTitle: "", company: "", startDate: "", endDate: "", description: "" };
const MAX_EXPERIENCE = 10;

// Inline paper field: reads as resume text until hovered or focused.
const FIELD =
  "h-9 w-auto min-w-0 rounded-none border-0 border-b border-transparent bg-transparent px-1 text-sm text-[#111111] shadow-none outline-none transition-colors hover:border-dashed hover:border-muted-foreground/40 focus:border-solid focus:border-primary focus:bg-accent focus:ring-0 focus-visible:border-primary focus-visible:ring-0 disabled:pointer-events-none disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100";
const NAME = `${FIELD} min-w-24 text-center text-4xl font-normal tracking-tight text-[#111111] field-sizing-content`;
const HEADING = "border-b border-[#D9D9D9] pb-1.5 text-xs font-normal uppercase tracking-[0.3em] text-[#444440]";
const DOT = "text-muted-foreground/60";

const text = (value) => String(value ?? "").trim();

// Builds the frozen POST /api/resumes/generate payload from the live form.
function buildResume(form, education, experience) {
  return {
    firstName: text(form.firstName),
    middleName: text(form.middleName),
    lastName: text(form.lastName),
    suffix: text(form.suffix),
    email: text(form.email),
    phone: normalizePhone(form.mobileNumber),
    birthdate: form.birthdate || "",
    nationality: text(form.nationality),
    address: {
      street: text(form.streetAddress),
      barangay: text(form.barangayDistrict),
      cityMunicipality: FIXED_MUNICIPALITY,
      provinceState: FIXED_PROVINCE,
      postalCode: text(form.postalCode),
    },
    education: education.level || education.school
      ? {
          level: text(education.level),
          school: text(education.school),
          field: text(education.field),
          year: education.studying ? "" : text(education.year),
        }
      : null,
    skills: form.skills.map(text).filter(Boolean),
    experience: experience
      .map((entry) => ({
        jobTitle: text(entry.jobTitle),
        company: text(entry.company),
        startDate: entry.startDate ? entry.startDate.slice(0, 7) : "",
        endDate: entry.endDate ? entry.endDate.slice(0, 7) : "",
        description: text(entry.description),
      }))
      .filter((entry) => Object.values(entry).some(Boolean)),
  };
}

function CreateResumeModal({ open, onClose, experience, setExperience, set, setEducation, form, education }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // The form is the single source of truth: every edit writes straight through.
  function close() {
    setError("");
    setBusy("");
    onClose?.();
  }

  const panelRef = useDialog(close, open);

  function setEntry(index, field, value) {
    setExperience((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }

  async function download(format) {
    setError("");
    setBusy(format);
    try {
      const file = await generateResume({ format, resume: buildResume(form, education, experience) });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `My-Resume.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Couldn't create your resume. Please try again.");
    } finally {
      setBusy("");
    }
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-overlay z-[9999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-resume-title"
        className="modal-panel flex max-h-[85vh] w-full max-w-2xl flex-col bg-white p-6 sm:p-8"
      >
        <h2 id="create-resume-title" className="text-sm font-semibold tracking-wide text-[#111111]">
          Create a Resume
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Anything you type here also fills the registration form underneath.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {/* The paper page: name, then contact / address / personal lines. */}
          <header className="pb-5 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-1">
              <Label htmlFor="resume-firstName" className="sr-only">First Name</Label>
              <Input id="resume-firstName" placeholder="First name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={NAME} />
              <Label htmlFor="resume-middleName" className="sr-only">Middle Name</Label>
              <Input id="resume-middleName" placeholder="Middle name" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={NAME} />
              <Label htmlFor="resume-lastName" className="sr-only">Last Name</Label>
              <Input id="resume-lastName" placeholder="Last name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={NAME} />
              <Label htmlFor="resume-suffix" className="sr-only">Suffix</Label>
              <Input id="resume-suffix" placeholder="Suffix" value={form.suffix} onChange={(e) => set("suffix", e.target.value)} className={`${NAME} min-w-16`} />
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1">
              <Label htmlFor="resume-email" className="sr-only">Email Address</Label>
              <Input id="resume-email" type="email" placeholder="Email address" value={form.email} onChange={(e) => set("email", e.target.value)} className={`${FIELD} w-52 text-center text-xs text-[#444440]`} />
              <span aria-hidden="true" className={DOT}>·</span>
              <Label htmlFor="resume-mobileNumber" className="sr-only">Mobile Number</Label>
              <span aria-hidden="true" className="select-none text-xs text-muted-foreground">+63</span>
              <Input
                id="resume-mobileNumber"
                type="tel"
                inputMode="numeric"
                placeholder="917 123 4567"
                value={formatPhoneDisplay(form.mobileNumber)}
                onChange={(e) => set("mobileNumber", withPrefix(e.target.value))}
                onBlur={() => set("mobileNumber", normalizePhone(form.mobileNumber))}
                className={`${FIELD} w-28 text-center text-xs text-[#444440]`}
              />
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-0.5 text-xs">
              <Label htmlFor="resume-streetAddress" className="sr-only">Street Address</Label>
              <Input id="resume-streetAddress" placeholder="Street address" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={`${FIELD} w-40 text-center text-xs text-[#444440]`} />
              <span aria-hidden="true" className={DOT}>,</span>
              <Label htmlFor="resume-barangayDistrict" className="sr-only">Barangay / District</Label>
              <div className="w-36 shrink-0">
                <FormSelect id="resume-barangayDistrict" value={form.barangayDistrict} onChange={(e) => set("barangayDistrict", e.target.value)} className={`${FIELD} w-full pr-7 text-center text-xs text-[#444440]`}>
                  <option value="">Select barangay</option>
                  {form.barangayDistrict && !SANTA_MARIA_BARANGAYS.includes(form.barangayDistrict) && (
                    <option value={form.barangayDistrict}>{form.barangayDistrict}</option>
                  )}
                  {SANTA_MARIA_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                </FormSelect>
              </div>
              <span aria-hidden="true" className={DOT}>,</span>
              <Label htmlFor="resume-cityMunicipality" className="sr-only">City / Municipality</Label>
              <Input id="resume-cityMunicipality" value={FIXED_MUNICIPALITY} disabled readOnly className={`${FIELD} w-24 text-center text-xs text-[#444440]`} />
              <span aria-hidden="true" className={DOT}>,</span>
              <Label htmlFor="resume-provinceState" className="sr-only">Province / State</Label>
              <Input id="resume-provinceState" value={FIXED_PROVINCE} disabled readOnly className={`${FIELD} w-20 text-center text-xs text-[#444440]`} />
              <span aria-hidden="true" className={DOT}>,</span>
              <Label htmlFor="resume-postalCode" className="sr-only">Postal Code</Label>
              <Input id="resume-postalCode" inputMode="numeric" maxLength={4} disabled value={FIXED_POSTAL_CODE} className={`${FIELD} w-16 text-center text-xs text-[#444440]`} />
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1">
              <Label htmlFor="resume-birthdate" className="sr-only">Birthday</Label>
              <Input id="resume-birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} className={`${FIELD} w-36 text-center text-xs text-[#444440]`} />
              <span aria-hidden="true" className={DOT}>·</span>
              <Label htmlFor="resume-nationality" className="sr-only">Nationality</Label>
              <div className="w-28 shrink-0">
                <FormSelect id="resume-nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={`${FIELD} w-full pr-7 text-center text-xs text-[#444440]`}>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </FormSelect>
              </div>
            </div>
          </header>

          <div className="space-y-5">
            <section aria-labelledby="create-resume-education">
              <h3 id="create-resume-education" className={`${HEADING} mb-4`}>Education</h3>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <div className="w-36 shrink-0">
                  <Label htmlFor="resume-education-level" className="sr-only">Education Level</Label>
                  <FormSelect id="resume-education-level" value={education.level} onChange={(e) => setEducation({ ...education, level: e.target.value })} className={`${FIELD} w-full pr-7`}>
                    <option value="">Select level</option>
                    {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </FormSelect>
                </div>
                <span aria-hidden="true" className={DOT}>—</span>
                <Label htmlFor="resume-education-school" className="sr-only">School Name</Label>
                <Input id="resume-education-school" placeholder="School name" value={education.school} onChange={(e) => setEducation({ ...education, school: e.target.value })} className={`${FIELD} w-52`} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Label htmlFor="resume-education-field" className="sr-only">Course / Field</Label>
                <Input id="resume-education-field" placeholder="Course / field" value={education.field} onChange={(e) => setEducation({ ...education, field: e.target.value })} className={`${FIELD} w-40`} />
                <span aria-hidden="true" className={DOT}>·</span>
                <Label htmlFor="resume-education-year" className="sr-only">Graduation Year</Label>
                <Input id="resume-education-year" inputMode="numeric" placeholder="e.g. 2024" disabled={education.studying} value={education.year} onChange={(e) => setEducation({ ...education, year: e.target.value })} className={`${FIELD} w-24`} />
                <Label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
                  <input type="checkbox" checked={education.studying} onChange={(e) => setEducation({ ...education, studying: e.target.checked })} className="size-3.5 shrink-0 accent-primary" />
                  Currently studying here
                </Label>
              </div>
            </section>

            <section aria-labelledby="create-resume-experience">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 id="create-resume-experience" className={`${HEADING} flex-1`}>Experience</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={experience.length >= MAX_EXPERIENCE}
                  onClick={() => setExperience((prev) => [...prev, { ...EMPTY_EXPERIENCE }])}
                >
                  Add experience
                </Button>
              </div>
              {experience.length === 0 && (
                <p className="mb-3 text-xs text-muted-foreground">No work experience added yet.</p>
              )}
              <div className="space-y-3">
                {experience.map((entry, index) => (
                  <fieldset key={index} className="border-b border-dashed border-border pb-3 last:border-0 last:pb-0">
                    <legend className="sr-only">Experience {index + 1}</legend>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <Label htmlFor={`resume-exp-${index}-jobTitle`} className="sr-only">Job Title</Label>
                      <Input id={`resume-exp-${index}-jobTitle`} placeholder="Job title" value={entry.jobTitle} onChange={(e) => setEntry(index, "jobTitle", e.target.value)} className={`${FIELD} w-44`} />
                      <span aria-hidden="true" className={DOT}>—</span>
                      <Label htmlFor={`resume-exp-${index}-company`} className="sr-only">Company</Label>
                      <Input id={`resume-exp-${index}-company`} placeholder="Company" value={entry.company} onChange={(e) => setEntry(index, "company", e.target.value)} className={`${FIELD} w-40`} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <Label htmlFor={`resume-exp-${index}-startDate`} className="sr-only">Start Date</Label>
                      <Input id={`resume-exp-${index}-startDate`} type="date" value={entry.startDate} onChange={(e) => setEntry(index, "startDate", e.target.value)} className={`${FIELD} w-32 text-xs text-[#444440]`} />
                      <span aria-hidden="true" className={DOT}>–</span>
                      <Label htmlFor={`resume-exp-${index}-endDate`} className="sr-only">End Date (blank = present)</Label>
                      <Input id={`resume-exp-${index}-endDate`} type="date" value={entry.endDate} onChange={(e) => setEntry(index, "endDate", e.target.value)} className={`${FIELD} w-32 text-xs text-[#444440]`} />
                      <span aria-hidden="true" className="text-[11px] text-muted-foreground">blank = present</span>
                    </div>
                    <Label htmlFor={`resume-exp-${index}-description`} className="sr-only">Description</Label>
                    <textarea
                      id={`resume-exp-${index}-description`}
                      rows={3}
                      placeholder="What did you do there?"
                      value={entry.description}
                      onChange={(e) => setEntry(index, "description", e.target.value)}
                      className={`${FIELD} mt-1 h-auto min-h-16 w-full resize-y py-1`}
                    />
                    <div className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-danger hover:text-danger"
                        onClick={() => setExperience((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>

            <section aria-labelledby="create-resume-skills">
              <h3 id="create-resume-skills" className={`${HEADING} mb-4`}>Skills</h3>
              <Label htmlFor="resume-skills" className="sr-only">Skills</Label>
              <Input
                id="resume-skills"
                placeholder="e.g. Welding, Data Entry, Communication"
                value={form.skills.join(", ")}
                onChange={(e) => set("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className={`${FIELD} w-full`}
              />
              <p className="mt-1 text-xs text-muted-foreground">Separate skills with commas.</p>
            </section>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
          {error && <p role="alert" className="text-xs font-medium text-danger sm:mr-auto">{error}</p>}
          <Button type="button" variant="outline" className="min-h-10" onClick={() => download("pdf")} disabled={!!busy}>
            {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
          </Button>
          <Button type="button" variant="outline" className="min-h-10" onClick={() => download("docx")} disabled={!!busy}>
            {busy === "docx" ? "Preparing DOCX…" : "Download DOCX"}
          </Button>
          <Button type="button" className="min-h-10" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CreateResumeModal;
