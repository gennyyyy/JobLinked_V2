import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import useAuth from "@/shared/hooks/useAuth";
import { updateProfile } from "@/shared/services/auth";
import { listResumes, uploadResume, setActiveResume, deleteResume, validateFile, signedUrl } from "@/shared/services/documents";
import { listEducation, addEducation, removeEducation, listExperience, addExperience, removeExperience, listEmployment } from "@/shared/services/seekers";
import { mapResumeText } from "@/shared/utils/resumeAutofill";
import { EMPLOYMENT_STATUSES, SANTA_MARIA_BARANGAYS } from "@/shared/constants";
import ConfirmationModal from "@/shared/components/ConfirmationModal";
import { formatFullAddress } from "@/shared/utils/address";
import { buildFullName } from "@/shared/utils/names";
import { titleCase } from "@/shared/utils/titleCase";
import { PageSkeleton } from '@/shared/components/Skeletons'
import ChangePassword from "@/shared/components/ChangePassword";
import { TagInput, splitTags } from "@/shared/components/TagInput";
import { InlineError } from "@/shared/components/dashboard";
import { PageHeading, Panel } from "@/shared/components/design";

// Per-resume View (new tab) + Download links. The API streams the file, so
// resolve it to a blob URL via the existing signedUrl service (same shape as before).
function ResumeLinks({ resume }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    let objectUrl = "";
    signedUrl("resumes", resume.file_path)
      .then((u) => {
        if (live) { objectUrl = u; setUrl(u); }
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [resume.file_path]);
  if (!url) return null;
  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">View<span className="sr-only"> (opens in new tab)</span></a>
      <a href={url} download={resume.file_name} className="inline-flex items-center rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">Download</a>
    </>
  );
}

// Read-only row for employments synced automatically from hiring activity
// (employment_history, maintained by DB trigger). Never editable here.
function SyncedEmployment({ job }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-success/20 bg-success-soft p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">{job.position}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{job.employer_name} · {job.start_date || "Start"} – {job.is_current ? "Present" : (job.end_date || "Ended")}</p>
      </div>
      <Badge variant="secondary" className={job.is_current ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}>
        {job.is_current ? "Current" : "Past"}
      </Badge>
    </div>
  );
}

// Mapped resume keys -> Profile form keys. email/cityMunicipality/
// provinceState/postalCode have no Profile field and are dropped.
const RESUME_FIELD_MAP = {
  firstName: "firstName",
  middleName: "middleName",
  lastName: "lastName",
  birthdate: "birthdate",
  houseNumberUnit: "houseNumberUnit",
  streetAddress: "streetAddress",
  subdivisionBuilding: "subdivisionBuilding",
  barangayDistrict: "barangayDistrict",
  mobileNumber: "phone",
};

// Form keys that hold a person's name: initial form state and resume-derived
// values both start Title Case (no live transform, so typing is never fought).
const NAME_FIELDS = new Set(["firstName", "middleName", "lastName", "suffix"]);

// Resume text -> a confirmation payload, or null when nothing usable was found.
// Education is offered whenever the resume has one; whether it replaces the
// seeker's saved rows is the opt-in checkbox's call (educationCount drives the
// "deletes your N saved education entries" warning).
function buildPendingAutofill(mapped, educationCount) {
  const fields = {};
  for (const [src, dest] of Object.entries(RESUME_FIELD_MAP)) {
    if (String(mapped[src] || "").trim()) fields[dest] = mapped[src];
  }
  const skills = (Array.isArray(mapped.skills) ? mapped.skills : []).filter((s) => String(s || "").trim());
  const edu = mapped.education || {};
  const education = String(edu.level || "").trim() && String(edu.school || "").trim()
    ? { level: edu.level, school: edu.school, field: edu.field, year: edu.year }
    : null;
  if (!Object.keys(fields).length && !skills.length && !education) return null;

  const parts = [];
  if (Object.keys(fields).length) parts.push("contact details");
  if (skills.length) parts.push(`${skills.length} skill${skills.length === 1 ? "" : "s"}`);
  if (education) parts.push("an education entry");
  const found = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  const replaces = education && educationCount > 0
    ? ` Replacing deletes your ${educationCount} saved education ${educationCount === 1 ? "entry" : "entries"}.`
    : "";
  return {
    fields,
    skills,
    education,
    message: `We found ${found} in your resume. Apply them to your profile? Blank fields only — anything you've typed is kept.${replaces}`,
  };
}

function Profile() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", suffix: "", phone: "", lot: "", block: "", houseNumberUnit: "", streetAddress: "", subdivisionBuilding: "", barangayDistrict: "", cityMunicipality: "", provinceState: "", postalCode: "", birthdate: "", skills: "", employmentStatus: "", preferredPosition: "", preferredLocation: "" });
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [resumeStatus, setResumeStatus] = useState("");
  const [pendingAutofill, setPendingAutofill] = useState(null);
  const [autofillOverwrite, setAutofillOverwrite] = useState(false);
  const [newEdu, setNewEdu] = useState({ level: "", school: "", field: "", end_year: "", studying: false });
  const [newExp, setNewExp] = useState({ company: "", position: "", start_date: "", end_date: "", description: "" });
  const [eduError, setEduError] = useState("");
  const [expError, setExpError] = useState("");
  const [addingEdu, setAddingEdu] = useState(false);
  const [addingExp, setAddingExp] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listEducation(),
      listExperience(),
      // Never let a missing employment record break the page
      listEmployment().catch(() => []),
      listResumes(user.id),
    ])
      .then(([edu, exp, emp, resumeList]) => {
        setEducation(edu || []);
        setExperience(exp || []);
        setEmployments(emp || []);
        setResumes(resumeList);
        setForm({
          firstName: titleCase(user.first_name || ""),
          middleName: titleCase(user.middle_name || ""),
          lastName: titleCase(user.last_name || ""),
          suffix: titleCase(user.suffix || ""),
          phone: user.phone || "",
          lot: user.lot || "",
          block: user.block || "",
          houseNumberUnit: user.house_number_unit || "",
          streetAddress: user.street_address || "",
          subdivisionBuilding: user.subdivision_building || "",
          barangayDistrict: user.barangay_district || "",
          cityMunicipality: user.city_municipality || "",
          provinceState: user.province_state || "",
          postalCode: user.postal_code || "",
          birthdate: user.birthdate || "",
          skills: (user.skills || []).join(", "),
          employmentStatus: user.employment_status || "",
          preferredPosition: user.preferred_position || "",
          preferredLocation: user.preferred_location || "",
        });
      })
      .catch((err) => setError(err.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <PageSkeleton stats={0} panels={2} />;
  if (error) return <InlineError message={error} />;

  const fullName = buildFullName(form.firstName, form.middleName, form.lastName, form.suffix) || user?.full_name || "Job Seeker";
  const activeResume = resumes.find((r) => r.is_active) || resumes[0];
  const skills = (form.skills || "").split(",").map((s) => s.trim()).filter(Boolean);

  const completion = Math.round(([
    form.firstName && form.lastName, form.phone, form.barangayDistrict,
    education.length, skills.length, resumes.length,
  ].filter(Boolean).length / 6) * 100);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddEducation() {
    const level = newEdu.level.trim();
    const school = newEdu.school.trim();
    if (!level || !school) { setEduError("Please select a level and enter a school name."); return; }
    const endYear = newEdu.studying ? "" : newEdu.end_year.trim();
    if (endYear && !/^\d{4}$/.test(endYear)) { setEduError("Graduation year must be a 4-digit year."); return; }
    setEduError("");
    setAddingEdu(true);
    try {
      const data = await addEducation({
        level,
        school,
        field: newEdu.field.trim() || null,
        end_year: endYear ? Number(endYear) : null,
      });
      if (!data) throw new Error("Could not save education. Please try again.");
      setEducation([...education, data]);
      setNewEdu({ level: "", school: "", field: "", end_year: "", studying: false });
    } catch (err) {
      setEduError(err.message || "Failed to add education.");
    } finally {
      setAddingEdu(false);
    }
  }

  async function handleRemoveEducation(id) {
    await removeEducation(id);
    setEducation(education.filter((e) => e.id !== id));
  }

  async function handleAddExperience() {
    const company = newExp.company.trim();
    const position = newExp.position.trim();
    if (!company || !position) { setExpError("Please enter both a company name and a job title."); return; }
    setExpError("");
    setAddingExp(true);
    try {
      const data = await addExperience({
        company,
        position,
        start_date: newExp.start_date || null,
        end_date: newExp.end_date || null,
        description: newExp.description.trim() || null,
      });
      if (!data) throw new Error("Could not save experience. Please try again.");
      setExperience([...experience, data]);
      setNewExp({ company: "", position: "", start_date: "", end_date: "", description: "" });
    } catch (err) {
      setExpError(err.message || "Failed to add experience.");
    } finally {
      setAddingExp(false);
    }
  }

  async function handleRemoveExperience(id) {
    await removeExperience(id);
    setExperience(experience.filter((e) => e.id !== id));
  }

  async function handleResumeUpload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) { setUploadError(validationError); return; }
    setUploadError("");
    try {
      await uploadResume(user.id, file);
      const updated = await listResumes(user.id);
      setResumes(updated);
    } catch (err) {
      setUploadError(err.message || "Upload failed");
      return;
    }
    // PDF/DOCX only: offer to apply what the resume holds. Never blocks the
    // upload that already succeeded — an unreadable file just stays silent.
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "pdf" && ext !== "docx") return;
    setResumeStatus("Reading your resume…");
    try {
      // pdfjs + mammoth are ~850 kB: load them only when a resume is picked.
      const { extractResumeText } = await import("../../shared/lib/resumeText");
      const pending = buildPendingAutofill(mapResumeText(await extractResumeText(file)), education.length);
      if (pending) { setAutofillOverwrite(false); setPendingAutofill(pending); }
    } catch {
      // Couldn't read it — the upload stands, nothing to apply.
    } finally {
      setResumeStatus("");
    }
  }

  // Blank fields only, unless the user opted into overwrite. Skills append
  // (deduped, like TagInput), or replace the whole list when overwriting.
  async function applyPendingAutofill() {
    const pending = pendingAutofill;
    if (!pending) return;
    const overwrite = autofillOverwrite;
    const staleEduIds = overwrite ? education.map((e) => e.id) : [];
    setPendingAutofill(null);
    setAutofillOverwrite(false);
    setForm((prev) => {
      const merged = {};
      for (const [key, value] of Object.entries(pending.fields)) {
        if (overwrite || !String(prev[key] || "").trim()) merged[key] = NAME_FIELDS.has(key) ? titleCase(value) : value;
      }
      if (!pending.skills.length) return { ...prev, ...merged };
      const combined = overwrite ? [] : splitTags(prev.skills);
      for (const s of pending.skills) {
        if (!combined.some((t) => t.toLowerCase() === s.toLowerCase())) combined.push(s);
      }
      return { ...prev, ...merged, skills: combined.join(", ") };
    });
    setEditing(true);
    // INVARIANT: never delete an education row without a replacement first —
    // no pending education means nothing is ever removed.
    if (!pending.education) return;
    if (staleEduIds.length && !overwrite) return;
    try {
      // Insert first, then delete: a failed insert leaves every saved row alone.
      const row = await addEducation({
        level: pending.education.level,
        school: pending.education.school,
        field: pending.education.field || null,
        end_year: pending.education.year ? Number(pending.education.year) : null,
      });
      if (row) setEducation((prev) => [...prev, row]);
      for (const id of staleEduIds) {
        await removeEducation(id);
        setEducation((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      setEduError(err.message || "Could not add the education entry from your resume.");
    }
  }

  async function handleSetActiveResume(resumeId) {
    await setActiveResume(user.id, resumeId);
    setResumes(resumes.map((r) => ({ ...r, is_active: r.id === resumeId })));
  }

  async function handleDeleteResume(resume) {
    await deleteResume(resume.id, resume.file_path);
    setResumes(resumes.filter((r) => r.id !== resume.id));
    setShowDeleteConfirm(false);
    setPendingDelete(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const skillsArray = skills;
      const updatedProfile = await updateProfile(user.id, {
        first_name: form.firstName,
        middle_name: form.middleName,
        last_name: form.lastName,
        suffix: form.suffix,
        full_name: fullName,
        phone: form.phone,
        lot: form.lot,
        block: form.block,
        street_address: form.streetAddress,
        subdivision_building: form.subdivisionBuilding,
        barangay_district: form.barangayDistrict,
        city_municipality: form.cityMunicipality,
        province_state: form.provinceState,
        postal_code: form.postalCode,
        birthdate: form.birthdate || null,
        skills: skillsArray,
        employment_status: form.employmentStatus || null,
        preferred_position: form.preferredPosition || null,
        preferred_location: form.preferredLocation || null,
      });
      setForm((current) => ({ ...current, birthdate: updatedProfile.birthdate || "" }));
      await refreshUser(user);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-4 pb-12">
      <PageHeading
        eyebrow="Introduce yourself"
        title="Your story, your next step."
        description="Give local employers a clear picture of your experience and the skills you bring."
      />

      <section className="flex items-center gap-4 rounded-2xl bg-navy p-5 text-white shadow-md md:p-6">
        <div aria-label={`${(form.firstName[0] || "J").toUpperCase()}${(form.lastName[0] || "S").toUpperCase()} profile initials`} className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-white bg-card text-xl font-bold text-dark-blue shadow-md">
          {(form.firstName[0] || "J").toUpperCase()}{(form.lastName[0] || "S").toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-white">{titleCase(fullName)}</h2>
            <p className="mt-1 truncate text-[11px] text-white/70">Accredited Job Seeker · {user?.email}</p>
          </div>
          {!editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(true)} className="shrink-0 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Edit Profile
            </Button>
          )}
        </div>
      </section>

      <section className="surface">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p id="profile-completion-label" className="eyebrow">Profile completion</p>
          <span className="text-sm font-semibold text-primary">{completion}%</span>
        </div>
        <div role="progressbar" aria-labelledby="profile-completion-label" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${completion}% complete`} className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
        </div>
      </section>

      {saved && (
        <div role="status" className="rounded-xl border border-success/20 bg-success-soft p-4 text-xs font-medium text-success">
          Profile information has been successfully updated.
        </div>
      )}

        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Panel title="Personal &amp; contact details" description="Where employers can reach you, and where you live.">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="profile-firstName" className="mb-1.5 block text-xs font-medium text-foreground">First Name</Label>
                    <Input id="profile-firstName" value={form.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <Label htmlFor="profile-middleName" className="mb-1.5 block text-xs font-medium text-foreground">Middle Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="profile-middleName" value={form.middleName} onChange={(e) => handleChange("middleName", e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <Label htmlFor="profile-lastName" className="mb-1.5 block text-xs font-medium text-foreground">Last Name</Label>
                    <Input id="profile-lastName" value={form.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <Label htmlFor="profile-suffix" className="mb-1.5 block text-xs font-medium text-foreground">Suffix <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="profile-suffix" value={form.suffix} onChange={(e) => handleChange("suffix", e.target.value)} placeholder="Jr., Sr., III" className="w-full" />
                  </div>
                  <div>
                    <Label htmlFor="profile-phone" className="mb-1.5 block text-xs font-medium text-foreground">Contact Mobile</Label>
                    <Input id="profile-phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="0917 123 4567" className="w-full" />
                  </div>
                  <div>
                    <Label htmlFor="profile-birthdate" className="mb-1.5 block text-xs font-medium text-foreground">Date of Birth</Label>
                    <Input id="profile-birthdate" type="date" value={form.birthdate} onChange={(e) => handleChange("birthdate", e.target.value)} className="w-full" />
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[['block', 'Block', 'e.g. 4'], ['lot', 'Lot', 'e.g. 12'], ['streetAddress', 'Street Address', 'e.g. Norzagaray-Santa Maria Road'], ['subdivisionBuilding', 'Subdivision / Village / Building Name', 'Subdivision name'], ['cityMunicipality', 'City / Municipality', 'e.g. Santa Maria'], ['provinceState', 'Province / State', 'e.g. Bulacan'], ['postalCode', 'Postal Code', 'e.g. 3022']].map(([field, label, placeholder]) => (
                    <div key={field}>
                      <Label htmlFor={`profile-${field}`} className="mb-1.5 block text-xs font-medium text-foreground">{label}</Label>
                      <Input id={`profile-${field}`} value={form[field]} onChange={(e) => handleChange(field, e.target.value)} placeholder={placeholder} className="w-full" />
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Label htmlFor="barangayDistrict" className="mb-1.5 block text-xs font-medium text-foreground">Barangay / District</Label>
                  <select
                    id="barangayDistrict"
                    value={form.barangayDistrict}
                    onChange={(e) => handleChange("barangayDistrict", e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select barangay</option>
                    {form.barangayDistrict && !SANTA_MARIA_BARANGAYS.includes(form.barangayDistrict) && (
                      <option value={form.barangayDistrict}>{form.barangayDistrict}</option>
                    )}
                    {SANTA_MARIA_BARANGAYS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="profile-employmentStatus" className="mb-1.5 block text-xs font-medium text-foreground">Employment Status</Label>
                    <select id="profile-employmentStatus" value={form.employmentStatus} onChange={(e) => handleChange("employmentStatus", e.target.value)} className="form-select">
                      <option value="">Select status</option>
                      {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="profile-preferredPosition" className="mb-1.5 block text-xs font-medium text-foreground">Preferred Jobs <span className="text-muted-foreground font-normal">(tags)</span></Label>
                    <TagInput id="profile-preferredPosition" value={form.preferredPosition} onChange={(v) => handleChange("preferredPosition", v)} placeholder="e.g. Call Center Agent — Enter to add" />
                  </div>
                  <div>
                    <Label htmlFor="profile-preferredLocation" className="mb-1.5 block text-xs font-medium text-foreground">Preferred Locations <span className="text-muted-foreground font-normal">(tags)</span></Label>
                    <TagInput id="profile-preferredLocation" value={form.preferredLocation} onChange={(v) => handleChange("preferredLocation", v)} placeholder="e.g. Santa Maria — Enter to add" />
                  </div>
                </div>
            </Panel>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Panel title="Skills &amp; competencies" description="Add each skill as a separate tag.">
                  <Label htmlFor="profile-skills" className="mb-1.5 block text-xs font-medium text-foreground">Skills &amp; Competencies</Label>
                  <TagInput id="profile-skills" value={form.skills} onChange={(v) => handleChange("skills", v)} placeholder="e.g. Data Entry — Enter to add" />
                </Panel>

                <Panel title="Experience" description="Synced from hiring activity; add anything else by hand.">
                  <div className="space-y-4">
                    {employments.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Synced employment <span className="font-normal normal-case">(from hiring activity)</span></p>
                        {employments.map((job) => <SyncedEmployment key={job.id} job={job} />)}
                      </div>
                    )}
                    {experience.map((exp) => (
                      <div key={exp.id} className="flex items-start justify-between gap-3 rounded-xl border bg-muted/50 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy">{exp.position}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{exp.company} · {exp.start_date || "Start"} – {exp.end_date || "Present"}</p>
                          {exp.description && <p className="mt-1 text-xs leading-6 text-muted-foreground">{exp.description}</p>}
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveExperience(exp.id)} className="shrink-0 text-muted-foreground">Remove</Button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input aria-label="Company name" value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} placeholder="Company name" className="w-full" />
                      <Input aria-label="Job title" value={newExp.position} onChange={(e) => setNewExp({ ...newExp, position: e.target.value })} placeholder="Job title" className="w-full" />
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                        <div>
                          <Label htmlFor="profile-exp-start" className="mb-1.5 block text-xs font-medium text-foreground">Start Date</Label>
                          <Input id="profile-exp-start" type="date" value={newExp.start_date} onChange={(e) => setNewExp({ ...newExp, start_date: e.target.value })} className="w-full" />
                        </div>
                        <div>
                          <Label htmlFor="profile-exp-end" className="mb-1.5 block text-xs font-medium text-foreground">End Date <span className="text-muted-foreground font-normal">(blank = present)</span></Label>
                          <Input id="profile-exp-end" type="date" value={newExp.end_date} onChange={(e) => setNewExp({ ...newExp, end_date: e.target.value })} className="w-full" />
                        </div>
                      </div>
                    </div>
                    <Input aria-label="Description of responsibilities" value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} placeholder="Brief description of responsibilities" className="w-full" />
                    <Button type="button" onClick={handleAddExperience} disabled={addingExp} className="w-fit">{addingExp ? "Adding…" : "Add Experience"}</Button>
                    {expError && <p role="alert" className="text-xs text-danger">{expError}</p>}
                  </div>
                </Panel>

                <Panel title="Education" description="Schools, training, and vocational courses.">
                  <div className="space-y-4">
                    {education.map((edu) => (
                      <div key={edu.id} className="flex items-start justify-between gap-3 rounded-xl border bg-muted/50 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy">{titleCase(edu.school)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{titleCase(edu.level)}{edu.field ? ` · ${titleCase(edu.field)}` : ""}{edu.end_year ? ` · ${edu.end_year}` : " · Present"}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveEducation(edu.id)} className="shrink-0 text-muted-foreground">Remove</Button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select aria-label="Education level" value={newEdu.level} onChange={(e) => setNewEdu({ ...newEdu, level: e.target.value })} className="form-select">
                        <option value="">Education level</option>
                        {["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"].map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <Input aria-label="School name" value={newEdu.school} onChange={(e) => setNewEdu({ ...newEdu, school: e.target.value })} placeholder="School name" className="w-full" />
                      <div className="flex gap-2">
                        <Input aria-label="Course / field of study" value={newEdu.field} onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })} placeholder="Course / field" className="flex-1" />
                        <Input aria-label="Graduation year" value={newEdu.end_year} onChange={(e) => setNewEdu({ ...newEdu, end_year: e.target.value })} placeholder="Year" inputMode="numeric" disabled={newEdu.studying} className="w-20" />
                      </div>
                      <Label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                        <Input type="checkbox" checked={newEdu.studying} onChange={(e) => setNewEdu({ ...newEdu, studying: e.target.checked })} className="accent-primary" />
                        Currently studying here <span className="text-muted-foreground">(blank = Present)</span>
                      </Label>
                    </div>
                    <Button type="button" onClick={handleAddEducation} disabled={addingEdu} className="w-fit">{addingEdu ? "Adding…" : "Add Education"}</Button>
                    {eduError && <p role="alert" className="text-xs text-danger">{eduError}</p>}
                  </div>
                </Panel>

                <Panel title="Resume" description="PDF up to 2 MB; DOC or DOCX up to 5 MB.">
                  <div className="flex flex-col">
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-5">
                      <Input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="resume-upload" />
                      {resumes.length > 0 ? (
                        <div className="space-y-3 w-full">
                          {resumes.map((resume) => (
                            <div key={resume.id} className="flex flex-col justify-between gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-navy">{resume.file_name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <ResumeLinks resume={resume} />
                            {!resume.is_active && (
                                  <Button type="button" variant="outline" size="sm" onClick={() => handleSetActiveResume(resume.id)}>Set Active</Button>
                                )}
                                <Label htmlFor="resume-upload" className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">Replace</Label>
                                <Button type="button" variant="destructive" size="sm" onClick={() => { setPendingDelete(resume); setShowDeleteConfirm(true); }}>Delete</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Label htmlFor="resume-upload" className="flex h-full w-full cursor-pointer flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground transition-colors hover:text-primary">
                          <span>Click to upload resume (PDF, DOC, or DOCX)</span>
                          <span className="mt-2 text-xs text-muted-foreground">PDF up to 2 MB; DOC or DOCX up to 5 MB.</span>
                        </Label>
                      )}
                      {uploadError && <p role="alert" className="mt-2 text-center text-xs text-danger">{uploadError}</p>}
                      {resumeStatus && <p role="status" aria-live="polite" className="mt-2 text-center text-xs text-muted-foreground">{resumeStatus}</p>}
                    </div>
                  </div>
                </Panel>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Profile"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
            <Panel title="Personal info" description="What employers see first." className="xl:col-start-1 xl:row-start-1">
                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Email Address</dt>
                    <dd className="mt-1 text-xs font-medium text-navy">{user?.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Mobile Contact</dt>
                    <dd className="mt-1 text-xs font-medium text-navy">{form.phone || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Barangay Address</dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{formatFullAddress({ lot: form.lot ? `Lot ${form.lot}` : "", block: form.block ? `Blk. ${form.block}` : "", house_number_unit: form.houseNumberUnit, street_address: form.streetAddress, subdivision_building: form.subdivisionBuilding, barangay_district: form.barangayDistrict }) || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Date of Birth</dt>
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {form.birthdate
                        ? new Date(form.birthdate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Employment Status</dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{form.employmentStatus || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Preferred Jobs</dt>
                    <dd className="mt-1.5">
                      {splitTags(form.preferredPosition).length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {splitTags(form.preferredPosition).map((tag) => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                          ))}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Not set</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Preferred Locations</dt>
                    <dd className="mt-1.5">
                      {splitTags(form.preferredLocation).length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {splitTags(form.preferredLocation).map((tag) => (
                            <Badge key={tag} variant="secondary" className="bg-teal-soft text-teal">{tag}</Badge>
                          ))}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Not set</span>}
                    </dd>
                  </div>
                </dl>
            </Panel>

            <div className="flex flex-col gap-5 xl:contents">
                <Panel title="Skills" className="xl:col-start-1 xl:row-start-2">
                  {skills.length ? (
                    <div className="flex flex-wrap content-start gap-1.5">
                      {skills.map((skill) => (
                        <Badge key={skill} variant="secondary">{titleCase(skill)}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No skills specified yet.</p>
                  )}
                </Panel>

                <Panel title="Experience" className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
                  <div className="space-y-3">
                    {employments.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Synced employment</p>
                        {employments.map((job) => <SyncedEmployment key={job.id} job={job} />)}
                      </div>
                    )}
                    {employments.length > 0 && experience.length > 0 && (
                      <p className="pt-2 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Added manually</p>
                    )}
                    {experience.length ? experience.map((exp) => (
                      <div key={exp.id} className="rounded-xl border bg-muted/50 p-4">
                        <p className="text-sm font-medium text-navy">{exp.position}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{exp.company} · {exp.start_date || "Start"} – {exp.end_date || "Present"}</p>
                        {exp.description && <p className="text-xs text-muted-foreground mt-1">{exp.description}</p>}
                      </div>
                    )) : (employments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No experience added yet.</p>)}
                  </div>
                </Panel>
                <Panel title="Education" className="xl:col-start-1 xl:row-start-3">
                  <div className="space-y-3">
                    {education.length ? education.map((edu) => (
                      <div key={edu.id} className="rounded-xl border bg-muted/50 p-4">
                        <p className="text-sm font-medium text-navy">{titleCase(edu.school)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{titleCase(edu.level)}{edu.field ? ` · ${titleCase(edu.field)}` : ""}{edu.end_year ? ` · ${edu.end_year}` : " · Present"}</p>
                      </div>
                    )) : <p className="text-xs text-muted-foreground text-center py-4">No education added yet.</p>}
                  </div>
                </Panel>

                <Panel title="Resume" className="text-center xl:col-start-2 xl:row-start-3">
                  <div className="flex flex-col items-center justify-center">
                    {resumes.length > 0 ? (
                      <div>
                        <p className="truncate text-sm font-medium text-navy">{activeResume.file_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{resumes.length} resume{resumes.length > 1 ? "s" : ""} on file</p>
                        <div className="mt-3 flex justify-center gap-2">
                          <ResumeLinks resume={activeResume} />
                        </div>
                      </div>
                    ) : (
                      <p className="py-4 text-center text-xs text-muted-foreground">No resume uploaded yet.</p>
                    )}
                  </div>
                </Panel>
            </div>
            <div className="xl:col-start-1 xl:row-start-4"><ChangePassword /></div>
          </div>
        )}
        {editing && <div className="mt-4"><ChangePassword /></div>}
        {showDeleteConfirm && pendingDelete && (
          <ConfirmationModal
            message="Are you sure you want to delete this resume?"
            onConfirm={() => handleDeleteResume(pendingDelete)}
            onCancel={() => { setPendingDelete(null); setShowDeleteConfirm(false); }}
            confirmLabel="Delete"
            danger
          />
        )}
        {pendingAutofill && (
          <ConfirmationModal
            message={pendingAutofill.message}
            onConfirm={applyPendingAutofill}
            onCancel={() => { setPendingAutofill(null); setAutofillOverwrite(false); }}
            confirmLabel="Apply"
            cancelLabel="Not now"
          >
            <Label className="flex items-start gap-2.5 mb-6 text-sm text-muted-foreground select-none cursor-pointer">
              <Input
                type="checkbox"
                checked={autofillOverwrite}
                onChange={(e) => setAutofillOverwrite(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>Replace existing values (fill fields that already have data)</span>
            </Label>
          </ConfirmationModal>
        )}
    </div>
  );
}

export default Profile;
