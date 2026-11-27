import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FormSelect from "@/shared/components/FormSelect";
import useDialog from "@/shared/hooks/useDialog";
import { FIXED_MUNICIPALITY, FIXED_PROVINCE, NATIONALITIES } from "@/shared/constants";
import { formatPhoneDisplay, normalizePhone, withPrefix } from "@/shared/utils/phone";
import { generateResume } from "@/shared/services/documents";
import { EDUCATION_LEVELS } from "./jobSeekerRegistration";

const EMPTY_EXPERIENCE = { jobTitle: "", company: "", startDate: "", endDate: "", description: "" };
const MAX_EXPERIENCE = 10;
const INPUT = "form-field";
const LABEL = "block font-mono text-xs tracking-wider text-muted-foreground uppercase mb-1.5";
const SECTION = "font-mono text-xs tracking-[0.2em] text-primary uppercase font-semibold";

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
        startDate: entry.startDate || "",
        endDate: entry.endDate || "",
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
        className="modal-panel flex max-h-[85vh] w-full max-w-2xl flex-col"
      >
        <h2 id="create-resume-title" className="text-base font-bold text-dark-blue">
          Create a Resume
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">
          Anything you type here also fills the registration form underneath.
        </p>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <section aria-labelledby="create-resume-personal">
            <h3 id="create-resume-personal" className={SECTION}>Personal Details</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="resume-firstName" className={LABEL}>First Name</Label>
                <Input id="resume-firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-middleName" className={LABEL}>Middle Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="resume-middleName" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-lastName" className={LABEL}>Last Name</Label>
                <Input id="resume-lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-suffix" className={LABEL}>Suffix <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="resume-suffix" value={form.suffix} onChange={(e) => set("suffix", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-email" className={LABEL}>Email Address</Label>
                <Input id="resume-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-mobileNumber" className={LABEL}>Mobile Number</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">+63</span>
                  <Input
                    id="resume-mobileNumber"
                    type="tel"
                    inputMode="numeric"
                    placeholder="917 123 4567"
                    value={formatPhoneDisplay(form.mobileNumber)}
                    onChange={(e) => set("mobileNumber", withPrefix(e.target.value))}
                    onBlur={() => set("mobileNumber", normalizePhone(form.mobileNumber))}
                    className={`${INPUT} pl-12`}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="resume-birthdate" className={LABEL}>Birthday</Label>
                <Input id="resume-birthdate" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-nationality" className={LABEL}>Nationality</Label>
                <FormSelect id="resume-nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} className={INPUT}>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </FormSelect>
              </div>
            </div>
          </section>

          <section aria-labelledby="create-resume-address">
            <h3 id="create-resume-address" className={SECTION}>Address</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="resume-streetAddress" className={LABEL}>Street Address</Label>
                <Input id="resume-streetAddress" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-barangayDistrict" className={LABEL}>Barangay / District</Label>
                <Input id="resume-barangayDistrict" value={form.barangayDistrict} onChange={(e) => set("barangayDistrict", e.target.value)} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-cityMunicipality" className={LABEL}>City / Municipality</Label>
                <Input id="resume-cityMunicipality" value={FIXED_MUNICIPALITY} disabled readOnly className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-provinceState" className={LABEL}>Province / State</Label>
                <Input id="resume-provinceState" value={FIXED_PROVINCE} disabled readOnly className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-postalCode" className={LABEL}>Postal Code <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="resume-postalCode" inputMode="numeric" maxLength={4} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={INPUT} />
              </div>
            </div>
          </section>

          <section aria-labelledby="create-resume-education">
            <h3 id="create-resume-education" className={SECTION}>Education</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="resume-education-level" className={LABEL}>Education Level</Label>
                <FormSelect id="resume-education-level" value={education.level} onChange={(e) => setEducation({ ...education, level: e.target.value })} className={INPUT}>
                  <option value="">Select level</option>
                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </FormSelect>
              </div>
              <div>
                <Label htmlFor="resume-education-school" className={LABEL}>School Name</Label>
                <Input id="resume-education-school" placeholder="School name" value={education.school} onChange={(e) => setEducation({ ...education, school: e.target.value })} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-education-field" className={LABEL}>Course / Field <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="resume-education-field" placeholder="Course / field" value={education.field} onChange={(e) => setEducation({ ...education, field: e.target.value })} className={INPUT} />
              </div>
              <div>
                <Label htmlFor="resume-education-year" className={LABEL}>Graduation Year</Label>
                <Input id="resume-education-year" inputMode="numeric" placeholder="e.g. 2024" disabled={education.studying} value={education.year} onChange={(e) => setEducation({ ...education, year: e.target.value })} className={INPUT} />
              </div>
            </div>
            <Label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input type="checkbox" checked={education.studying} onChange={(e) => setEducation({ ...education, studying: e.target.checked })} className="size-4 shrink-0 accent-primary" />
              Currently studying here
            </Label>
          </section>

          <section aria-labelledby="create-resume-skills">
            <h3 id="create-resume-skills" className={SECTION}>Skills</h3>
            <div className="mt-3">
              <Label htmlFor="resume-skills" className={LABEL}>Skills</Label>
              <Input
                id="resume-skills"
                placeholder="e.g. Welding, Data Entry, Communication"
                value={form.skills.join(", ")}
                onChange={(e) => set("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                className={INPUT}
              />
              <p className="mt-1 text-xs text-muted-foreground">Separate skills with commas.</p>
            </div>
          </section>

          <section aria-labelledby="create-resume-experience">
            <div className="flex items-center justify-between gap-3">
              <h3 id="create-resume-experience" className={SECTION}>Work Experience <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional)</span></h3>
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
              <p className="mt-3 text-xs text-muted-foreground">No work experience added yet.</p>
            )}
            <div className="mt-3 space-y-4">
              {experience.map((entry, index) => (
                <fieldset key={index} className="rounded-xl border border-border p-4">
                  <legend className="px-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">Experience {index + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`resume-exp-${index}-jobTitle`} className={LABEL}>Job Title</Label>
                      <Input id={`resume-exp-${index}-jobTitle`} value={entry.jobTitle} onChange={(e) => setEntry(index, "jobTitle", e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <Label htmlFor={`resume-exp-${index}-company`} className={LABEL}>Company</Label>
                      <Input id={`resume-exp-${index}-company`} value={entry.company} onChange={(e) => setEntry(index, "company", e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <Label htmlFor={`resume-exp-${index}-startDate`} className={LABEL}>Start Date</Label>
                      <Input id={`resume-exp-${index}-startDate`} type="month" value={entry.startDate} onChange={(e) => setEntry(index, "startDate", e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <Label htmlFor={`resume-exp-${index}-endDate`} className={LABEL}>End Date <span className="font-normal text-muted-foreground">(blank = present)</span></Label>
                      <Input id={`resume-exp-${index}-endDate`} type="month" value={entry.endDate} onChange={(e) => setEntry(index, "endDate", e.target.value)} className={INPUT} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor={`resume-exp-${index}-description`} className={LABEL}>Description</Label>
                      <textarea
                        id={`resume-exp-${index}-description`}
                        rows={3}
                        value={entry.description}
                        onChange={(e) => setEntry(index, "description", e.target.value)}
                        className="form-field h-auto min-h-24 w-full py-2"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
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
