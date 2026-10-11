import { useState, useEffect } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { updateProfile } from "../../shared/services/auth";
import { listResumes, uploadResume, setActiveResume, deleteResume, validateFile, signedUrl } from "../../shared/services/documents";
import { listEducation, addEducation, removeEducation, listExperience, addExperience, removeExperience, listEmployment } from "../../shared/services/seekers";
import { EMPLOYMENT_STATUSES } from "../../shared/constants";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import { formatFullAddress } from "../../shared/utils/address";
import LoadingScreen from "../../shared/components/LoadingScreen";
import ChangePassword from "../../shared/components/ChangePassword";
import { TagInput, splitTags } from "../../shared/components/TagInput";
import { PageHeader } from "../../shared/components/dashboard";

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
      <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">View</a>
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

function Profile() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", suffix: "", phone: "", lot: "", block: "", houseNumberUnit: "", streetAddress: "", subdivisionBuilding: "", barangayDistrict: "", birthdate: "", skills: "", employmentStatus: "", preferredPosition: "", preferredLocation: "" });
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [uploadError, setUploadError] = useState("");
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
          firstName: user.first_name || "",
          middleName: user.middle_name || "",
          lastName: user.last_name || "",
          suffix: user.suffix || "",
          phone: user.phone || "",
          lot: user.lot || "",
          block: user.block || "",
          houseNumberUnit: user.house_number_unit || "",
          streetAddress: user.street_address || "",
          subdivisionBuilding: user.subdivision_building || "",
          barangayDistrict: user.barangay_district || "",
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
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  const fullName = [form.firstName, form.middleName, form.lastName, form.suffix].filter(Boolean).join(" ").trim() || user?.full_name || "Job Seeker";
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
            <div className="w-16 h-16 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-xl text-accent shadow-[0_4px_16px_rgba(0,117,162,0.15)]">
              {(form.firstName[0] || "J").toUpperCase()}{(form.lastName[0] || "S").toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 uppercase">{fullName}</h2>
              <p className="font-mono text-xs text-gray-400 mt-0.5">Accredited Job Seeker · {user?.email}</p>
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
            <p className="font-mono text-[11px] tracking-widest text-gray-500 uppercase">Profile Completion</p>
            <span className="font-mono text-sm font-bold text-primary">{completion}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <section className="p-5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Personal Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">First Name</label>
                    <input value={form.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Middle Name <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input value={form.middleName} onChange={(e) => handleChange("middleName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Last Name</label>
                    <input value={form.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Suffix <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input value={form.suffix} onChange={(e) => handleChange("suffix", e.target.value)} placeholder="Jr., Sr., III" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Contact Mobile</label>
                    <input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="0917 123 4567" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Date of Birth</label>
                    <input type="date" value={form.birthdate} onChange={(e) => handleChange("birthdate", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[['block', 'Block', 'e.g. 4'], ['lot', 'Lot', 'e.g. 12'], ['streetAddress', 'Street Address', 'e.g. Norzagaray-Santa Maria Road'], ['subdivisionBuilding', 'Subdivision / Village / Building Name', 'Subdivision name'], ['barangayDistrict', 'Barangay / District', 'Barangay']].map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">{label}</label>
                      <input value={form[field]} onChange={(e) => handleChange(field, e.target.value)} placeholder={placeholder} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Employment Status</label>
                    <select value={form.employmentStatus} onChange={(e) => handleChange("employmentStatus", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all">
                      <option value="">Select status</option>
                      {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Preferred Jobs <span className="text-gray-400 font-normal">(tags)</span></label>
                    <TagInput value={form.preferredPosition} onChange={(v) => handleChange("preferredPosition", v)} placeholder="e.g. Call Center Agent — Enter to add" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Preferred Locations <span className="text-gray-400 font-normal">(tags)</span></label>
                    <TagInput value={form.preferredLocation} onChange={(v) => handleChange("preferredLocation", v)} placeholder="e.g. Santa Maria — Enter to add" />
                  </div>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 xl:auto-rows-fr gap-6 items-stretch">
                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Skills</p>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Skills & Competencies <span className="text-gray-400 font-normal">(tags)</span></label>
                  <TagInput value={form.skills} onChange={(v) => handleChange("skills", v)} placeholder="e.g. Data Entry — Enter to add" className="flex-1" />
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Experience</p>
                  <div className="space-y-4">
                    {employments.length > 0 && (
                      <div className="space-y-3">
                        <p className="font-mono text-[11px] tracking-widest text-gray-500 uppercase">Synced Employment <span className="text-gray-400 font-normal">(from hiring activity)</span></p>
                        {employments.map((job) => <SyncedEmployment key={job.id} job={job} />)}
                      </div>
                    )}
                    {experience.map((exp) => (
                      <div key={exp.id} className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{exp.position}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{exp.company} · {exp.start_date || "Start"} – {exp.end_date || "Present"}</p>
                          {exp.description && <p className="text-xs text-gray-400 mt-1">{exp.description}</p>}
                        </div>
                        <button type="button" onClick={() => handleRemoveExperience(exp.id)} className="text-gray-400 hover:text-primary text-xs">Remove</button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} placeholder="Company name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                      <input value={newExp.position} onChange={(e) => setNewExp({ ...newExp, position: e.target.value })} placeholder="Job title" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                        <div>
                          <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Start Date</label>
                          <input type="date" value={newExp.start_date} onChange={(e) => setNewExp({ ...newExp, start_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all" />
                        </div>
                        <div>
                          <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">End Date <span className="text-gray-400 font-normal">(blank = present)</span></label>
                          <input type="date" value={newExp.end_date} onChange={(e) => setNewExp({ ...newExp, end_date: e.target.value })} className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all" />
                        </div>
                      </div>
                    </div>
                    <input value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} placeholder="Brief description of responsibilities" className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                    <button type="button" onClick={handleAddExperience} disabled={addingExp} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98] transition-colors disabled:opacity-60">{addingExp ? "Adding…" : "Add Experience"}</button>
                    {expError && <p className="text-xs text-danger">{expError}</p>}
                  </div>
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Education</p>
                  <div className="space-y-4">
                    {education.map((edu) => (
                      <div key={edu.id} className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900 uppercase">{edu.school}</p>
                          <p className="text-xs text-gray-500 mt-0.5 uppercase">{edu.level}{edu.field ? ` · ${edu.field}` : ""}{edu.end_year ? ` · ${edu.end_year}` : " · Present"}</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveEducation(edu.id)} className="text-gray-400 hover:text-primary text-xs">Remove</button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select value={newEdu.level} onChange={(e) => setNewEdu({ ...newEdu, level: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all">
                        <option value="">Education level</option>
                        {["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"].map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <input value={newEdu.school} onChange={(e) => setNewEdu({ ...newEdu, school: e.target.value })} placeholder="School name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                      <div className="flex gap-2">
                        <input value={newEdu.field} onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })} placeholder="Course / field" className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                        <input value={newEdu.end_year} onChange={(e) => setNewEdu({ ...newEdu, end_year: e.target.value })} placeholder="Year" inputMode="numeric" disabled={newEdu.studying} className="w-20 px-3 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all disabled:opacity-50" />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
                        <input type="checkbox" checked={newEdu.studying} onChange={(e) => setNewEdu({ ...newEdu, studying: e.target.checked })} className="accent-primary" />
                        Currently studying here <span className="text-gray-400">(blank = Present)</span>
                      </label>
                    </div>
                    <button type="button" onClick={handleAddEducation} disabled={addingEdu} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98] transition-colors disabled:opacity-60">{addingEdu ? "Adding…" : "Add Education"}</button>
                    {eduError && <p className="text-xs text-danger">{eduError}</p>}
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
                                <p className="text-xs text-gray-400 mt-0.5">Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}</p>
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
                          <span className="mt-2 text-xs text-gray-400">PDF up to 2 MB; DOC or DOCX up to 5 MB.</span>
                        </label>
                      )}
                      {uploadError && <p className="mt-2 text-xs text-red-500 text-center">{uploadError}</p>}
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
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Email Address</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{user?.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Mobile Contact</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{form.phone || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Barangay Address</dt>
                    <dd className="mt-1 text-xs text-gray-700">{formatFullAddress({ lot: form.lot ? `Lot ${form.lot}` : "", block: form.block ? `Blk. ${form.block}` : "", house_number_unit: form.houseNumberUnit, street_address: form.streetAddress, subdivision_building: form.subdivisionBuilding, barangay_district: form.barangayDistrict }) || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Date of Birth</dt>
                    <dd className="mt-1 text-xs text-gray-700">
                      {form.birthdate
                        ? new Date(form.birthdate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Employment Status</dt>
                    <dd className="mt-1 text-xs text-gray-700">{form.employmentStatus || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Preferred Jobs</dt>
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
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Preferred Locations</dt>
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
                        <span key={skill} className="font-mono text-xs px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary uppercase h-fit">{skill}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">No skills specified yet.</p>
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
                        {exp.description && <p className="text-xs text-gray-400 mt-1">{exp.description}</p>}
                      </div>
                    )) : (employments.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No experience added yet.</p>)}
                  </div>
                </section>
                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4">Education</p>
                  <div className="space-y-3">
                    {education.length ? education.map((edu) => (
                      <div key={edu.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <p className="text-sm font-medium text-gray-900 uppercase">{edu.school}</p>
                        <p className="text-xs text-gray-500 mt-0.5 uppercase">{edu.level}{edu.field ? ` · ${edu.field}` : ""}{edu.end_year ? ` · ${edu.end_year}` : " · Present"}</p>
                      </div>
                    )) : <p className="text-xs text-gray-400 text-center py-4">No education added yet.</p>}
                  </div>
                </section>

                <section className="h-full p-5 rounded-xl bg-gray-50 border border-gray-200 text-center flex flex-col">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-4 text-left">Resume</p>
                  <div className="flex-1 flex flex-col justify-center items-center">
                    {resumes.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-900">{activeResume.file_name}</p>
                        <p className="text-xs text-gray-400 mt-1">{resumes.length} resume{resumes.length > 1 ? "s" : ""} on file</p>
                        <div className="mt-3 flex justify-center gap-2">
                          <ResumeLinks resume={activeResume} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">No resume uploaded yet.</p>
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
      </div>
      <ChangePassword />
    </div>
  );
}

export default Profile;
