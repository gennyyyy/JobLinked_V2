import { useState, useEffect } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile } from "../../shared/services/auth";
import { listResumes, uploadResume, setActiveResume, deleteResume, validateFile, signedUrl } from "../../shared/services/documents";
import { listEducation, addEducation, removeEducation, listExperience, addExperience, removeExperience, listEmployment } from "../../shared/services/seekers";
import { mapResumeText } from "../../shared/utils/resumeAutofill";
import { EMPLOYMENT_STATUSES, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import { formatFullAddress } from "../../shared/utils/address";
import { buildFullName } from "../../shared/utils/names";
import { titleCase } from "../../shared/utils/titleCase";
import LoadingScreen from "../../shared/components/LoadingScreen";
import ChangePassword from "../../shared/components/ChangePassword";
import { TagInput, splitTags } from "../../shared/components/TagInput";
import { PageHeader, InlineError } from "../../shared/components/dashboard";

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
      <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">View<span className="sr-only"> (opens in new tab)</span></a>
      <a href={url} download={resume.file_name} className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">Download</a>
    </>
  );
}

// Read-only row for employments synced automatically from hiring activity
// (employment_history, maintained by DB trigger). Never editable here.
function SyncedEmployment({ job }) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
      <div>
        <p className="text-sm font-medium text-gray-900">{job.position}</p>
        <p className="text-xs text-gray-500 mt-0.5">{job.employer_name} · {job.start_date || "Start"} – {job.is_current ? "Present" : (job.end_date || "Ended")}</p>
      </div>
      <span className={`shrink-0 font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${job.is_current ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-100 border-gray-200 text-gray-500"}`}>
        {job.is_current ? "Current" : "Past"}
      </span>
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

  if (loading) return <LoadingScreen />;
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
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="MUNICIPAL CANDIDATE PROFILE"
        title="My Account & Resume"
        subtitle="Your credentials, contact information, and skill tags seen by Santa Maria employers"
      />

      <div className="bg-white border border-primary rounded-lg p-6 md:p-9">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-xl text-dark-blue shadow-[0_4px_16px_rgba(0,117,162,0.15)]">
              {(form.firstName[0] || "J").toUpperCase()}{(form.lastName[0] || "S").toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{titleCase(fullName)}</h2>
              <p className="font-mono text-xs text-gray-500 mt-0.5">Accredited Job Seeker · {user?.email}</p>
            </div>
          </div>

          {!editing && (
            <button onClick={() => setEditing(true)} className="min-h-[40px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:border-primary/40 transition-colors self-start sm:self-center">
              Edit Profile
            </button>
          )}
        </div>

        {saved && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            Profile information has been successfully updated.
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p id="profile-completion-label" className="font-mono text-[11px] tracking-widest text-gray-500 uppercase">Profile Completion</p>
            <span className="font-mono text-sm font-bold text-primary">{completion}%</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="profile-completion-label"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${completion}% complete`}
            className="h-2 rounded-full bg-gray-100 overflow-hidden"
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <section className="p-5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Personal Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="profile-firstName" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">First Name</label>
                    <input id="profile-firstName" value={form.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label htmlFor="profile-middleName" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Middle Name <span className="text-gray-500 font-normal">(optional)</span></label>
                    <input id="profile-middleName" value={form.middleName} onChange={(e) => handleChange("middleName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label htmlFor="profile-lastName" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Last Name</label>
                    <input id="profile-lastName" value={form.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label htmlFor="profile-suffix" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Suffix <span className="text-gray-500 font-normal">(optional)</span></label>
                    <input id="profile-suffix" value={form.suffix} onChange={(e) => handleChange("suffix", e.target.value)} placeholder="Jr., Sr., III" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label htmlFor="profile-phone" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Contact Mobile</label>
                    <input id="profile-phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="0917 123 4567" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label htmlFor="profile-birthdate" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Date of Birth</label>
                    <input id="profile-birthdate" type="date" value={form.birthdate} onChange={(e) => handleChange("birthdate", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[['block', 'Block', 'e.g. 4'], ['lot', 'Lot', 'e.g. 12'], ['streetAddress', 'Street Address', 'e.g. Norzagaray-Santa Maria Road'], ['subdivisionBuilding', 'Subdivision / Village / Building Name', 'Subdivision name'], ['cityMunicipality', 'City / Municipality', 'e.g. Santa Maria'], ['provinceState', 'Province / State', 'e.g. Bulacan'], ['postalCode', 'Postal Code', 'e.g. 3022']].map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label htmlFor={`profile-${field}`} className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">{label}</label>
                      <input id={`profile-${field}`} value={form[field]} onChange={(e) => handleChange(field, e.target.value)} placeholder={placeholder} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <label htmlFor="barangayDistrict" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Barangay / District</label>
                  <select
                    id="barangayDistrict"
                    value={form.barangayDistrict}
                    onChange={(e) => handleChange("barangayDistrict", e.target.value)}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
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
                    <label htmlFor="profile-employmentStatus" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Employment Status</label>
                    <select id="profile-employmentStatus" value={form.employmentStatus} onChange={(e) => handleChange("employmentStatus", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all">
                      <option value="">Select status</option>
                      {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="profile-preferredPosition" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Preferred Jobs <span className="text-gray-500 font-normal">(tags)</span></label>
                    <TagInput id="profile-preferredPosition" value={form.preferredPosition} onChange={(v) => handleChange("preferredPosition", v)} placeholder="e.g. Call Center Agent — Enter to add" />
                  </div>
                  <div>
                    <label htmlFor="profile-preferredLocation" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Preferred Locations <span className="text-gray-500 font-normal">(tags)</span></label>
                    <TagInput id="profile-preferredLocation" value={form.preferredLocation} onChange={(v) => handleChange("preferredLocation", v)} placeholder="e.g. Santa Maria — Enter to add" />
                  </div>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 xl:auto-rows-fr gap-6 items-stretch">
                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Skills</p>
                  <label htmlFor="profile-skills" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Skills &amp; Competencies <span className="text-gray-500 font-normal">(tags)</span></label>
                  <TagInput id="profile-skills" value={form.skills} onChange={(v) => handleChange("skills", v)} placeholder="e.g. Data Entry — Enter to add" className="flex-1" />
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Experience</p>
                  <div className="space-y-4">
                    {employments.length > 0 && (
                      <div className="space-y-3">
                        <p className="font-mono text-[11px] tracking-widest text-gray-500 uppercase">Synced Employment <span className="text-gray-500 font-normal">(from hiring activity)</span></p>
                        {employments.map((job) => <SyncedEmployment key={job.id} job={job} />)}
                      </div>
                    )}
                    {experience.map((exp) => (
                      <div key={exp.id} className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{exp.position}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{exp.company} · {exp.start_date || "Start"} – {exp.end_date || "Present"}</p>
                          {exp.description && <p className="text-xs text-gray-500 mt-1">{exp.description}</p>}
                        </div>
                        <button type="button" onClick={() => handleRemoveExperience(exp.id)} className="text-gray-500 hover:text-primary text-xs">Remove</button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input aria-label="Company name" value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} placeholder="Company name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                      <input aria-label="Job title" value={newExp.position} onChange={(e) => setNewExp({ ...newExp, position: e.target.value })} placeholder="Job title" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                        <div>
                          <label htmlFor="profile-exp-start" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Start Date</label>
                          <input id="profile-exp-start" type="date" value={newExp.start_date} onChange={(e) => setNewExp({ ...newExp, start_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all" />
                        </div>
                        <div>
                          <label htmlFor="profile-exp-end" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">End Date <span className="text-gray-500 font-normal">(blank = present)</span></label>
                          <input id="profile-exp-end" type="date" value={newExp.end_date} onChange={(e) => setNewExp({ ...newExp, end_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all" />
                        </div>
                      </div>
                    </div>
                    <input aria-label="Description of responsibilities" value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} placeholder="Brief description of responsibilities" className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                    <button type="button" onClick={handleAddExperience} disabled={addingExp} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98] transition-colors disabled:opacity-60">{addingExp ? "Adding…" : "Add Experience"}</button>
                    {expError && <p role="alert" className="text-xs text-danger">{expError}</p>}
                  </div>
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Education</p>
                  <div className="space-y-4">
                    {education.map((edu) => (
                      <div key={edu.id} className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{titleCase(edu.school)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{titleCase(edu.level)}{edu.field ? ` · ${titleCase(edu.field)}` : ""}{edu.end_year ? ` · ${edu.end_year}` : " · Present"}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveEducation(edu.id)} className="text-gray-500 hover:text-primary text-xs">Remove</button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select aria-label="Education level" value={newEdu.level} onChange={(e) => setNewEdu({ ...newEdu, level: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all">
                        <option value="">Education level</option>
                        {["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"].map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <input aria-label="School name" value={newEdu.school} onChange={(e) => setNewEdu({ ...newEdu, school: e.target.value })} placeholder="School name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                      <div className="flex gap-2">
                        <input aria-label="Course / field of study" value={newEdu.field} onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })} placeholder="Course / field" className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all" />
                        <input aria-label="Graduation year" value={newEdu.end_year} onChange={(e) => setNewEdu({ ...newEdu, end_year: e.target.value })} placeholder="Year" inputMode="numeric" disabled={newEdu.studying} className="w-20 px-3 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-50" />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
                        <input type="checkbox" checked={newEdu.studying} onChange={(e) => setNewEdu({ ...newEdu, studying: e.target.checked })} className="accent-primary" />
                        Currently studying here <span className="text-gray-500">(blank = Present)</span>
                      </label>
                    </div>
                    <button type="button" onClick={handleAddEducation} disabled={addingEdu} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98] transition-colors disabled:opacity-60">{addingEdu ? "Adding…" : "Add Education"}</button>
                    {eduError && <p role="alert" className="text-xs text-danger">{eduError}</p>}
                  </div>
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Resume</p>
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col justify-center items-center p-5 rounded-xl bg-gray-50 border border-dashed border-gray-300">
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="resume-upload" />
                      {resumes.length > 0 ? (
                        <div className="space-y-3 w-full">
                          {resumes.map((resume) => (
                            <div key={resume.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200">
                              <div>
                                <p className="text-sm text-gray-900">{resume.file_name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}</p>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <ResumeLinks resume={resume} />
                            {!resume.is_active && (
                                  <button type="button" onClick={() => handleSetActiveResume(resume.id)} className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">Set Active</button>
                                )}
                                <label htmlFor="resume-upload" className="cursor-pointer px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">Replace</label>
                                <button type="button" onClick={() => { setPendingDelete(resume); setShowDeleteConfirm(true); }} className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/5 transition-colors">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <label htmlFor="resume-upload" className="cursor-pointer text-sm text-gray-500 hover:text-primary transition-colors flex flex-col items-center justify-center py-6 w-full h-full text-center">
                          <span>Click to upload resume (PDF, DOC, or DOCX)</span>
                          <span className="mt-2 text-xs text-gray-500">PDF up to 2 MB; DOC or DOCX up to 5 MB.</span>
                        </label>
                      )}
                      {uploadError && <p role="alert" className="mt-2 text-xs text-danger text-center">{uploadError}</p>}
                      {resumeStatus && <p role="status" aria-live="polite" className="mt-2 text-xs text-gray-500 text-center">{resumeStatus}</p>}
                    </div>
                  </div>
                </section>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button type="submit" disabled={saving} className="min-h-[42px] px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
                {saving ? "Saving…" : "Save Profile"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-[42px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="p-5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Personal Info</p>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Email Address</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{user?.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Mobile Contact</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{form.phone || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Barangay Address</dt>
                    <dd className="mt-1 text-xs text-gray-700">{formatFullAddress({ lot: form.lot ? `Lot ${form.lot}` : "", block: form.block ? `Blk. ${form.block}` : "", house_number_unit: form.houseNumberUnit, street_address: form.streetAddress, subdivision_building: form.subdivisionBuilding, barangay_district: form.barangayDistrict }) || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Date of Birth</dt>
                    <dd className="mt-1 text-xs text-gray-700">
                      {form.birthdate
                        ? new Date(form.birthdate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Employment Status</dt>
                    <dd className="mt-1 text-xs text-gray-700">{form.employmentStatus || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Preferred Jobs</dt>
                    <dd className="mt-1.5">
                      {splitTags(form.preferredPosition).length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {splitTags(form.preferredPosition).map((tag) => (
                            <span key={tag} className="font-mono text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">{tag}</span>
                          ))}
                        </span>
                      ) : <span className="text-xs text-gray-700">Not set</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-500">Preferred Locations</dt>
                    <dd className="mt-1.5">
                      {splitTags(form.preferredLocation).length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {splitTags(form.preferredLocation).map((tag) => (
                            <span key={tag} className="font-mono text-xs px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">{tag}</span>
                          ))}
                        </span>
                      ) : <span className="text-xs text-gray-700">Not set</span>}
                    </dd>
                  </div>
                </dl>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 xl:auto-rows-fr gap-6 items-stretch">
                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Skills</p>
                  {skills.length ? (
                    <div className="flex flex-wrap gap-2 content-start flex-1">
                      {skills.map((skill) => (
                        <span key={skill} className="font-mono text-xs px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary h-fit">{titleCase(skill)}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 py-2">No skills specified yet.</p>
                  )}
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Experience</p>
                  <div className="space-y-3">
                    {employments.length > 0 && (
                      <div className="space-y-3">
                        <p className="font-mono text-[11px] tracking-widest text-gray-500 uppercase">Synced Employment</p>
                        {employments.map((job) => <SyncedEmployment key={job.id} job={job} />)}
                      </div>
                    )}
                    {employments.length > 0 && experience.length > 0 && (
                      <p className="font-mono text-[11px] tracking-widest text-gray-500 uppercase pt-2">Added Manually</p>
                    )}
                    {experience.length ? experience.map((exp) => (
                      <div key={exp.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{exp.position}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{exp.company} · {exp.start_date || "Start"} – {exp.end_date || "Present"}</p>
                        {exp.description && <p className="text-xs text-gray-500 mt-1">{exp.description}</p>}
                      </div>
                    )) : (employments.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No experience added yet.</p>)}
                  </div>
                </section>
                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Education</p>
                  <div className="space-y-3">
                    {education.length ? education.map((edu) => (
                      <div key={edu.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{titleCase(edu.school)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{titleCase(edu.level)}{edu.field ? ` · ${titleCase(edu.field)}` : ""}{edu.end_year ? ` · ${edu.end_year}` : " · Present"}</p>
                      </div>
                    )) : <p className="text-xs text-gray-500 text-center py-4">No education added yet.</p>}
                  </div>
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200 text-center flex flex-col">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4 text-left">Resume</p>
                  <div className="flex-1 flex flex-col justify-center items-center">
                    {resumes.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-900">{activeResume.file_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{resumes.length} resume{resumes.length > 1 ? "s" : ""} on file</p>
                        <div className="mt-3 flex justify-center gap-2">
                          <ResumeLinks resume={activeResume} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-4">No resume uploaded yet.</p>
                    )}
                  </div>
                </section>
            </div>
          </div>
        )}
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
            <label className="flex items-start gap-2.5 mb-6 text-sm text-gray-700 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={autofillOverwrite}
                onChange={(e) => setAutofillOverwrite(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>Replace existing values (fill fields that already have data)</span>
            </label>
          </ConfirmationModal>
        )}
      </div>
      <ChangePassword />
    </div>
  );
}

export default Profile;
