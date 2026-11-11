import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Briefcase, Send, X } from "lucide-react";
import { JOB_TAGS, JOB_BENEFITS, JOB_EDUCATION_LEVELS, JOB_EXPERIENCE_PRESETS, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import useDialog from "../../shared/hooks/useDialog";
import { TextField, SelectField } from "../../shared/components/design";
import { EXPERIENCE_OPTIONS, applyEducation, applyExperience, parseEducation, parseExperience } from "./jobPostFields";
import { getFeeTerms } from "../../shared/services/feeFilter";
import { findFeeMatches } from "../../shared/utils/feeTerms";

export default function JobPostFormDialog({ form, setForm, setErrors, errors, saving, editingId, confirmDiscard, onRequestClose, onSave }) {
  // Barangay listbox (drops down only; native select flips up when scrolled)
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [barangayQuery, setBarangayQuery] = useState("");
  const barangayRef = useRef(null);
  const filteredBarangays = SANTA_MARIA_BARANGAYS.filter((b) =>
    b.toLowerCase().includes(barangayQuery.trim().toLowerCase())
  );

  // "Custom…" selected in the work-experience dropdown (stored line stays the source of truth)
  const [experienceCustom, setExperienceCustom] = useState(false);
  const [feeTerms, setFeeTerms] = useState(null);
  useEffect(() => {
    let active = true;
    getFeeTerms().then((t) => { if (active) setFeeTerms(t); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const feeTermsList = feeTerms ? [...(feeTerms.block || []), ...(feeTerms.hold || [])] : [];
  const feeMatches = findFeeMatches(form.description || '', feeTermsList);
  const experienceYears = parseExperience(form.requirements);
  const experienceIsCustom = experienceCustom || (experienceYears !== "" && !JOB_EXPERIENCE_PRESETS.includes(Number(experienceYears)));

  // Escape / Tab-trap / focus-return for the form modal (shared useDialog).
  // Escape inside the form goes through the discard guard so typing isn't lost,
  // and the barangay dropdown owns Escape while it is up — its own keydown
  // listener closes just the dropdown first.
  const formPanelRef = useDialog(() => { if (!confirmDiscard && !barangayOpen) onRequestClose(); });

  // Close barangay listbox on outside click / Escape
  useEffect(() => {
    if (!barangayOpen) return;
    function onPointerDown(e) {
      if (barangayRef.current && !barangayRef.current.contains(e.target)) setBarangayOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setBarangayOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [barangayOpen]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div
        ref={formPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-form-title"
        className="my-8 max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl md:p-6"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="soft-icon">
              <Briefcase />
            </span>
            <div>
              <p className="eyebrow">{editingId ? "Update vacancy" : "New recruitment bulletin"}</p>
              <h2 id="job-form-title" className="mt-1 text-xl font-semibold tracking-[-.02em] text-navy">
                {editingId ? "Edit Job Vacancy" : "Post a Municipal Vacancy"}
              </h2>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onRequestClose} aria-label="Close form">
            <X />
          </Button>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          <TextField
            id="job-title"
            label={<>Job Title <span aria-hidden="true" className="text-destructive">*</span></>}
            value={form.title}
            onChange={(e) => {
              setForm({ ...form, title: e.target.value });
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            placeholder="e.g. Administrative Officer, Welder, Accountant..."
            error={errors.title}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="job-office"
              label={<>Department / Office <span className="font-normal text-muted-foreground">(optional)</span></>}
              value={form.office}
              onChange={(e) => setForm({ ...form, office: e.target.value })}
              placeholder="e.g. Main Plant, Warehouse 1, Accounting"
            />
            <SelectField
              id="job-employment-type"
              label={<>Employment Type <span aria-hidden="true" className="text-destructive">*</span></>}
              value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
              options={["Full-time", "Part-time", "Contractual", "Job Order", "Seasonal", "Internship"]}
            />
            <SelectField
              id="job-work-arrangement"
              label={<>Work Arrangement <span aria-hidden="true" className="text-destructive">*</span></>}
              value={form.work_arrangement}
              onChange={(e) => setForm({ ...form, work_arrangement: e.target.value })}
              options={["On-site", "Remote / Work from home", "Hybrid"]}
            />
            <TextField
              id="job-vacancies"
              type="number"
              min="1"
              label={<>Number of Vacancies <span aria-hidden="true" className="text-destructive">*</span></>}
              value={form.vacancies}
              onChange={(e) => {
                setForm({ ...form, vacancies: e.target.value });
                if (errors.vacancies) setErrors((prev) => ({ ...prev, vacancies: undefined }));
              }}
              error={errors.vacancies}
            />
          </div>

          {/* Barangay Location */}
          <div>
            <Label id="job-location-label" className="text-sm font-medium">
              Barangay Location <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            {/* ponytail: custom listbox only because native select direction is browser-controlled; revert to native if requirement lifts. */}
            <div ref={barangayRef} className="relative mt-2">
              <Button
                type="button"
                variant="outline"
                aria-haspopup="listbox"
                aria-expanded={barangayOpen}
                aria-labelledby="job-location-label job-location-value"
                aria-invalid={Boolean(errors.location)}
                onClick={() => setBarangayOpen((v) => !v)}
                className="w-full justify-between font-normal"
              >
                <span id="job-location-value" className={form.location ? "" : "text-muted-foreground"}>
                  {form.location || "Select barangay"}
                </span>
                <span aria-hidden="true" className="text-xs text-muted-foreground">▾</span>
              </Button>
              {barangayOpen && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-xl border bg-card shadow-xl">
                  <Input
                    type="text"
                    aria-label="Search barangay"
                    value={barangayQuery}
                    onChange={(e) => setBarangayQuery(e.target.value)}
                    autoFocus
                    placeholder="Search barangay..."
                    className="rounded-b-none border-0 border-b"
                  />
                  {filteredBarangays.length === 0 ? (
                    <p className="px-4 py-2.5 text-xs text-muted-foreground">No barangays match</p>
                  ) : (
                    <ul role="listbox" aria-label="Barangay location" className="max-h-56 overflow-y-auto">
                      {filteredBarangays.map((b) => (
                        <li
                          key={b}
                          role="option"
                          aria-selected={form.location === b}
                          tabIndex={0}
                          onClick={() => {
                            setForm({ ...form, location: b });
                            if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                            setBarangayOpen(false);
                            setBarangayQuery("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setForm({ ...form, location: b });
                              if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                              setBarangayOpen(false);
                              setBarangayQuery("");
                            }
                          }}
                          className={`cursor-pointer px-4 py-2.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none ${
                            form.location === b ? "bg-muted font-semibold" : ""
                          }`}
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {errors.location && <p role="alert" className="mt-1 text-xs text-destructive">{errors.location}</p>}
          </div>

          {/* Salary Range */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="job-salary-min"
              type="number"
              min="0"
              step="500"
              label={<>Minimum Salary (₱) <span className="font-normal text-muted-foreground">(optional)</span></>}
              value={form.salary_min}
              onChange={(e) => {
                setForm({ ...form, salary_min: e.target.value });
                if (errors.salary_min || errors.salary_max) {
                  setErrors((prev) => ({ ...prev, salary_min: undefined, salary_max: undefined }));
                }
              }}
              placeholder="e.g. 18000"
              error={errors.salary_min}
            />
            <TextField
              id="job-salary-max"
              type="number"
              min="0"
              step="500"
              label={<>Maximum Salary (₱) <span className="font-normal text-muted-foreground">(optional)</span></>}
              value={form.salary_max}
              onChange={(e) => {
                setForm({ ...form, salary_max: e.target.value });
                if (errors.salary_max) setErrors((prev) => ({ ...prev, salary_max: undefined }));
              }}
              placeholder="e.g. 25000"
              error={errors.salary_max}
            />
          </div>

          <TextField
            id="job-deadline"
            type="date"
            label={<>Application Deadline <span className="font-normal text-muted-foreground">(optional)</span></>}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />

          <TextField
            id="job-description"
            multiline
            rows={4}
            label={<>Job Description &amp; Responsibilities <span aria-hidden="true" className="text-destructive">*</span></>}
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
            }}
            placeholder="Outline key duties, scope of work, day-to-day responsibilities, and team role..."
            error={errors.description}
          />
          {feeMatches.length > 0 && (
            <p className="text-xs text-amber-700 mt-1">PESO review: {feeMatches.join(', ')}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="job-education-requirement"
              label={<>Education Requirement <span className="font-normal text-muted-foreground">(optional)</span></>}
              placeholder="Select education requirement"
              value={parseEducation(form.requirements)}
              onChange={(e) => setForm({ ...form, requirements: applyEducation(form.requirements, e.target.value) })}
              options={JOB_EDUCATION_LEVELS}
            />

            <div>
              <SelectField
                id="job-experience-required"
                label={<>Work Experience Required <span className="font-normal text-muted-foreground">(years, optional)</span></>}
                placeholder="Select experience"
                value={experienceIsCustom ? "custom" : experienceYears}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") {
                    setExperienceCustom(true);
                    setForm({ ...form, requirements: applyExperience(form.requirements, "") });
                  } else {
                    setExperienceCustom(false);
                    setForm({ ...form, requirements: applyExperience(form.requirements, v) });
                  }
                }}
                options={EXPERIENCE_OPTIONS}
              />
              {experienceIsCustom && (
                <div className="mt-3">
                  <TextField
                    id="job-experience-custom"
                    type="number"
                    min="0"
                    step="1"
                    label="Number of years of experience required"
                    value={experienceYears}
                    onChange={(e) => setForm({ ...form, requirements: applyExperience(form.requirements, e.target.value) })}
                    placeholder="Enter number of years"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Benefits & Perks */}
          <div role="group" aria-labelledby="job-benefits-label">
            <p id="job-benefits-label" className="mb-2 text-sm font-medium">
              Benefits &amp; Perks <span className="font-normal text-muted-foreground">(optional, click to toggle)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {/* ponytail: custom benefit lines are preserved but only known chips are shown; render extras as chips if PESO starts using them. */}
              {JOB_BENEFITS.map((benefit) => {
                const selected = form.benefits.includes(benefit);
                return (
                  <Button
                    key={benefit}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        benefits: selected
                          ? f.benefits.filter((b) => b !== benefit)
                          : [...f.benefits, benefit],
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-medium ${
                      selected
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {benefit}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Job Tags */}
          <div role="group" aria-labelledby="job-tags-label">
            <p id="job-tags-label" className="mb-2 text-sm font-medium">
              Tags <span className="font-normal text-muted-foreground">(optional, click to toggle)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {JOB_TAGS.map((tag) => {
                const selected = form.tags.includes(tag);
                return (
                  <Button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tags: selected ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-medium ${
                      selected
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
          </div>

          <TextField
            id="job-instructions"
            multiline
            rows={2}
            label={<>Application Instructions <span className="font-normal text-muted-foreground">(optional)</span></>}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="e.g. Please bring an updated resume, 2x2 photo, and NBI clearance. Walk-ins accepted Mon-Fri 9AM-3PM..."
          />
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col items-center justify-end gap-3 border-t pt-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={onRequestClose} disabled={saving} className="w-full text-xs sm:w-auto">
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => onSave("draft")}
            disabled={saving}
            className="w-full text-xs sm:w-auto"
          >
            {saving ? "Saving..." : editingId ? "Save Changes as Draft" : "Save as Draft"}
          </Button>

          <Button
            type="button"
            onClick={() => onSave("published")}
            disabled={saving}
            className="w-full gap-1.5 text-xs sm:w-auto"
          >
            <Send className="size-3.5" />
            <span>{saving ? "Publishing..." : "Publish Job"}</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
