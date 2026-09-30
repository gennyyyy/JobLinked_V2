import { useState, useEffect } from "react";
import useAuth from "../../hooks/useAuth";
import { updateProfile } from "../../services/auth";
import { listResumes, uploadResume, setActiveResume, deleteResume, validateFile } from "../../services/documents";
import { supabase } from "../../lib/supabase";
import { EMPLOYMENT_STATUSES } from "../../constants";
import ConfirmationModal from "../../components/ConfirmationModal";
import { formatFullAddress } from "../../utils/address";
import LoadingScreen from "../../components/LoadingScreen";
import ChangePassword from "../../components/ChangePassword";

function Profile() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", suffix: "", phone: "", houseNumberUnit: "", streetAddress: "", subdivisionBuilding: "", barangayDistrict: "", cityMunicipality: "", provinceState: "", postalCode: "", country: "Philippines", birthdate: "", skills: "", employmentStatus: "", preferredPosition: "", preferredLocation: "" });
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [newEdu, setNewEdu] = useState({ level: "", school: "", field: "", end_year: "" });
  const [newExp, setNewExp] = useState({ company: "", position: "", start_date: "", end_date: "", description: "" });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("education").select("*").eq("seeker_id", user.id),
      supabase.from("work_experience").select("*").eq("seeker_id", user.id),
      listResumes(user.id),
    ])
      .then(([edu, exp, resumeList]) => {
        setEducation(edu.data || []);
        setExperience(exp.data || []);
        setResumes(resumeList);
        setForm({
          firstName: user.first_name || "",
          middleName: user.middle_name || "",
          lastName: user.last_name || "",
          suffix: user.suffix || "",
          phone: user.phone || "",
          houseNumberUnit: user.house_number_unit || "",
          streetAddress: user.street_address || "",
          subdivisionBuilding: user.subdivision_building || "",
          barangayDistrict: user.barangay_district || "",
          cityMunicipality: user.city_municipality || "",
          provinceState: user.province_state || "",
          postalCode: user.postal_code || "",
          country: user.country || "Philippines",
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
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const fullName = [form.firstName, form.middleName, form.lastName, form.suffix].filter(Boolean).join(" ").trim() || user?.full_name || "Job Seeker";
  const skills = (form.skills || "").split(",").map((s) => s.trim()).filter(Boolean);

  const completion = Math.round(([
    form.firstName && form.lastName, form.phone, form.barangayDistrict,
    form.cityMunicipality, education.length, skills.length, resumes.length,
  ].filter(Boolean).length / 7) * 100);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddEducation(e) {
    e.preventDefault();
    if (!newEdu.school || !newEdu.level) return;
    const { data, error: err } = await supabase.from("education").insert({ seeker_id: user.id, ...newEdu, end_year: newEdu.end_year ? Number(newEdu.end_year) : null }).select().maybeSingle();
    if (err) { setError(err.message); return; }
    setEducation([...education, data]);
    setNewEdu({ level: "", school: "", field: "", end_year: "" });
  }

  async function handleRemoveEducation(id) {
    await supabase.from("education").delete().eq("id", id);
    setEducation(education.filter((e) => e.id !== id));
  }

  async function handleAddExperience(e) {
    e.preventDefault();
    if (!newExp.company || !newExp.position) return;
    const { data, error: err } = await supabase.from("work_experience").insert({ seeker_id: user.id, ...newExp }).select().maybeSingle();
    if (err) { setError(err.message); return; }
    setExperience([...experience, data]);
    setNewExp({ company: "", position: "", start_date: "", end_date: "", description: "" });
  }

  async function handleRemoveExperience(id) {
    await supabase.from("work_experience").delete().eq("id", id);
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
        house_number_unit: form.houseNumberUnit,
        street_address: form.streetAddress,
        subdivision_building: form.subdivisionBuilding,
        barangay_district: form.barangayDistrict,
        city_municipality: form.cityMunicipality,
        province_state: form.provinceState,
        postal_code: form.postalCode,
        country: form.country,
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

  const tabs = [
    { id: "info", label: "Personal Info" },
    { id: "education", label: "Education" },
    { id: "experience", label: "Experience" },
    { id: "resume", label: "Resume" },
  ];

  return (
    <div className="w-full animate-fade-in space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">MUNICIPAL CANDIDATE PROFILE</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">My Account & Resume</h1>
        <p className="mt-2 text-sm text-gray-500">Your credentials, contact information, and skill tags seen by Santa Maria employers</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0057B8]/15 border border-[#0057B8]/30 flex items-center justify-center font-bold text-xl text-[#0057B8] shadow-[0_4px_16px_rgba(0,117,162,0.15)]">
              {form.firstName[0] || "J"}{form.lastName[0] || "S"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
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
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium animate-fade-in">
            Profile information has been successfully updated.
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <p className="font-mono text-[11px] tracking-widest text-gray-500 uppercase">Profile Completion</p>
            <span className="font-mono text-sm font-bold text-primary">{completion}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id ? "text-[#0057B8] border-[#0057B8]" : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5 animate-fade-in">
            {activeTab === "info" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
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
                <div className="grid grid-cols-1 gap-4">
                  {[["houseNumberUnit", "House / Building / Unit No.", "e.g. Unit 402"], ["streetAddress", "Street Address & Lot / Block", "Street address"], ["subdivisionBuilding", "Subdivision / Village / Building Name", "Subdivision name"], ["barangayDistrict", "Barangay / District", "Barangay"], ["cityMunicipality", "City / Municipality", "e.g. Santa Maria"], ["provinceState", "Province / State", "e.g. Bulacan"], ["postalCode", "Postal / ZIP Code", "e.g. 3022"], ["country", "Country", "Philippines"]].map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">{label}</label>
                      <input value={form[field]} onChange={(e) => handleChange(field, e.target.value)} placeholder={placeholder} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Employment Status</label>
                    <select value={form.employmentStatus} onChange={(e) => handleChange("employmentStatus", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all">
                      <option value="">Select status</option>
                      {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Preferred Position</label>
                    <input value={form.preferredPosition} onChange={(e) => handleChange("preferredPosition", e.target.value)} placeholder="e.g. Call Center Agent" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Preferred Location</label>
                    <input value={form.preferredLocation} onChange={(e) => handleChange("preferredLocation", e.target.value)} placeholder="e.g. Santa Maria" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Skills & Competencies <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                  <input value={form.skills} onChange={(e) => handleChange("skills", e.target.value)} placeholder="Data Entry, Customer Relations, Bookkeeping" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                </div>
              </>
            )}

            {activeTab === "education" && (
              <div className="space-y-4">
                {education.map((edu) => (
                  <div key={edu.id} className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{edu.school}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{edu.level}{edu.field ? ` · ${edu.field}` : ""}{edu.end_year ? ` · ${edu.end_year}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveEducation(edu.id)} className="text-gray-400 hover:text-primary text-xs">Remove</button>
                  </div>
                ))}
                <div className="grid grid-cols-1 gap-3">
                  <select value={newEdu.level} onChange={(e) => setNewEdu({ ...newEdu, level: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all">
                    <option value="">Education level</option>
                    {["Elementary", "High School", "Senior High School", "Vocational", "College", "Post-Graduate"].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input value={newEdu.school} onChange={(e) => setNewEdu({ ...newEdu, school: e.target.value })} placeholder="School name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <div className="flex gap-2">
                    <input value={newEdu.field} onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })} placeholder="Course / field" className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                    <input value={newEdu.end_year} onChange={(e) => setNewEdu({ ...newEdu, end_year: e.target.value })} placeholder="Year" inputMode="numeric" className="w-20 px-3 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  </div>
                </div>
                <button type="button" onClick={handleAddEducation} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98] transition-colors">Add Education</button>
              </div>
            )}

            {activeTab === "experience" && (
              <div className="space-y-4">
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
                <div className="grid grid-cols-1 gap-3">
                  <input value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} placeholder="Company name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input value={newExp.position} onChange={(e) => setNewExp({ ...newExp, position: e.target.value })} placeholder="Job title" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input type="date" value={newExp.start_date} onChange={(e) => setNewExp({ ...newExp, start_date: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all" />
                  <input type="date" value={newExp.end_date} onChange={(e) => setNewExp({ ...newExp, end_date: e.target.value })} className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all" />
                </div>
                <input value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} placeholder="Brief description of responsibilities" className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                <button type="button" onClick={handleAddExperience} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98] transition-colors">Add Experience</button>
              </div>
            )}

            {activeTab === "resume" && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-gray-50 border border-dashed border-gray-300">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="resume-upload" />
                  {resumes.length > 0 ? (
                    <div className="space-y-3">
                      {resumes.map((resume) => (
                        <div key={resume.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200">
                          <div>
                            <p className="text-sm text-gray-900">{resume.file_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {resume.is_active ? (
                              <span className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg">Active</span>
                            ) : (
                              <button type="button" onClick={() => handleSetActiveResume(resume.id)} className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">Set Active</button>
                            )}
                            <label htmlFor="resume-upload" className="cursor-pointer px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">Replace</label>
                            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/5 transition-colors">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <label htmlFor="resume-upload" className="cursor-pointer text-sm text-gray-500 hover:text-primary transition-colors">
                      Click to upload resume (PDF, DOC, DOCX)
                    </label>
                  )}
                  {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-3">
              <button type="submit" disabled={saving} className="min-h-[42px] px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-60">
                {saving ? "Saving…" : "Save Profile"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-[42px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            {activeTab === "info" && (
              <>
                <dl className="grid grid-cols-1 gap-5 text-sm p-5 rounded-xl bg-gray-50 border border-gray-200">
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
                    <dd className="mt-1 text-xs text-gray-700">{formatFullAddress(form) || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Date of Birth</dt>
                    <dd className="mt-1 text-xs text-gray-700">{form.birthdate || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Employment Status</dt>
                    <dd className="mt-1 text-xs text-gray-700">{form.employmentStatus || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Job Preferences</dt>
                    <dd className="mt-1 text-xs text-gray-700">{[form.preferredPosition, form.preferredLocation && `in ${form.preferredLocation}`].filter(Boolean).join(" ") || "Not set"}</dd>
                  </div>
                </dl>
                <section>
                  <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Skills & Capabilities</h3>
                  {skills.length ? (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span key={skill} className="font-mono text-xs px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">{skill}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No skills specified yet.</p>
                  )}
                </section>
              </>
            )}

            {activeTab === "education" && (
              <div className="space-y-3">
                {education.length ? education.map((edu) => (
                  <div key={edu.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{edu.school}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{edu.level}{edu.field ? ` · ${edu.field}` : ""}{edu.end_year ? ` · ${edu.end_year}` : ""}</p>
                  </div>
                )) : <p className="text-xs text-gray-400">No education added yet.</p>}
              </div>
            )}

            {activeTab === "experience" && (
              <div className="space-y-3">
                {experience.length ? experience.map((exp) => (
                  <div key={exp.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{exp.position}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{exp.company} · {exp.start_date || "Start"} – {exp.end_date || "Present"}</p>
                    {exp.description && <p className="text-xs text-gray-400 mt-1">{exp.description}</p>}
                  </div>
                )) : <p className="text-xs text-gray-400">No experience added yet.</p>}
              </div>
            )}

            {activeTab === "resume" && (
              <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 text-center">
                {resumes.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-900">{resumes.find((r) => r.is_active)?.file_name || resumes[0].file_name}</p>
                    <p className="text-xs text-gray-400 mt-1">{resumes.length} resume{resumes.length > 1 ? "s" : ""} on file</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No resume uploaded yet.</p>
                )}
              </div>
            )}
          </div>
        )}
        {showDeleteConfirm && resumes.length > 0 && (
          <ConfirmationModal
            message="Are you sure you want to delete this resume?"
            onConfirm={() => handleDeleteResume(resumes.find((r) => r.is_active) || resumes[0])}
            onCancel={() => setShowDeleteConfirm(false)}
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
