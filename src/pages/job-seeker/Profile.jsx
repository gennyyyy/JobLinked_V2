import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import { getAccountProfile, saveAccountProfile } from "../../utils/userStore";

function Profile() {
  const { user, login } = useAuth();
  const role = "job-seeker";
  const email = user?.email || "";

  const existing = getAccountProfile(role, email) || {};
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState({
    firstName: user?.name?.split(" ")[0] || "",
    lastName: user?.name?.split(" ").slice(1).join(" ") || "",
    phone: existing.phone || "",
    address: existing.address || "",
    birthdate: existing.birthdate || "",
    skills: (existing.skills || []).join(", "),
  });
  const [education, setEducation] = useState(existing.education || []);
  const [experience, setExperience] = useState(existing.experience || []);
  const [resume, setResume] = useState(existing.resume || null);
  const [newEdu, setNewEdu] = useState({ school: "", degree: "", year: "" });
  const [newExp, setNewExp] = useState({ company: "", role: "", startDate: "", endDate: "", description: "" });

  if (!email) {
    return (
      <div className="text-center py-16 text-gray-400">
        You must be logged in to view your profile.
      </div>
    );
  }

  const fullName = `${form.firstName} ${form.lastName}`.trim() || user?.name || "Job Seeker";
  const skills = (form.skills || "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddEducation(e) {
    e.preventDefault();
    if (!newEdu.school || !newEdu.degree) return;
    setEducation([...education, { ...newEdu, id: Date.now() }]);
    setNewEdu({ school: "", degree: "", year: "" });
  }

  function handleRemoveEducation(id) {
    setEducation(education.filter((e) => e.id !== id));
  }

  function handleAddExperience(e) {
    e.preventDefault();
    if (!newExp.company || !newExp.role) return;
    setExperience([...experience, { ...newExp, id: Date.now() }]);
    setNewExp({ company: "", role: "", startDate: "", endDate: "", description: "" });
  }

  function handleRemoveExperience(id) {
    setExperience(experience.filter((e) => e.id !== id));
  }

  function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setResume({ name: file.name, size: (file.size / 1024).toFixed(1) + " KB", date: new Date().toLocaleDateString() });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const name = `${form.firstName} ${form.lastName}`.trim();
    saveAccountProfile(role, email, {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      address: form.address,
      birthdate: form.birthdate,
      skills,
      education,
      experience,
      resume,
    });
    if (name && name !== user?.name) {
      login(role, { email, name });
    }
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const tabs = [
    { id: "info", label: "Personal Info" },
    { id: "education", label: "Education" },
    { id: "experience", label: "Experience" },
    { id: "resume", label: "Resume" },
  ];

  return (
    <div className="max-w-3xl animate-fade-in space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          MUNICIPAL CANDIDATE PROFILE
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          My Account & Resume
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Your credentials, contact information, and skill tags seen by Santa Maria employers
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-7 md:p-9 shadow-sm">
        {/* User Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0057B8]/15 border border-[#0057B8]/30 flex items-center justify-center font-bold text-xl text-[#0057B8] shadow-[0_4px_16px_rgba(0,117,162,0.15)]">
              {form.firstName[0] || "J"}{form.lastName[0] || "S"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
              <p className="font-mono text-xs text-gray-400 mt-0.5">
                Accredited Job Seeker · {email}
              </p>
            </div>
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="min-h-[40px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:border-primary/40 transition-colors self-start sm:self-center"
            >
              Edit Profile
            </button>
          )}
        </div>

        {saved && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium animate-fade-in">
            Profile information has been successfully updated.
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "text-[#0057B8] border-[#0057B8]"
                  : "text-gray-400 border-transparent hover:text-gray-600"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">First Name</label>
                    <input value={form.firstName} onChange={(e) => handleChange("firstName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Last Name</label>
                    <input value={form.lastName} onChange={(e) => handleChange("lastName", e.target.value)} className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
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
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Barangay & Residential Address</label>
                  <input value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="Poblacion, Santa Maria, Bulacan" className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all" />
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
                      <p className="text-xs text-gray-500 mt-0.5">{edu.degree}{edu.year ? ` · ${edu.year}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveEducation(edu.id)} className="text-gray-400 hover:text-primary text-xs">Remove</button>
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={newEdu.school} onChange={(e) => setNewEdu({ ...newEdu, school: e.target.value })} placeholder="School name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input value={newEdu.degree} onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })} placeholder="Degree / Course" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <div className="flex gap-2">
                    <input value={newEdu.year} onChange={(e) => setNewEdu({ ...newEdu, year: e.target.value })} placeholder="Year" className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                    <button type="button" onClick={handleAddEducation} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors">Add</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "experience" && (
              <div className="space-y-4">
                {experience.map((exp) => (
                  <div key={exp.id} className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{exp.role}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{exp.company} · {exp.startDate || "Start"} – {exp.endDate || "Present"}</p>
                      {exp.description && <p className="text-xs text-gray-400 mt-1">{exp.description}</p>}
                    </div>
                    <button type="button" onClick={() => handleRemoveExperience(exp.id)} className="text-gray-400 hover:text-primary text-xs">Remove</button>
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} placeholder="Company name" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input value={newExp.role} onChange={(e) => setNewExp({ ...newExp, role: e.target.value })} placeholder="Job title" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input value={newExp.startDate} onChange={(e) => setNewExp({ ...newExp, startDate: e.target.value })} placeholder="Start date" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                  <input value={newExp.endDate} onChange={(e) => setNewExp({ ...newExp, endDate: e.target.value })} placeholder="End date (or blank)" className="px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                </div>
                <input value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} placeholder="Brief description of responsibilities" className="w-full px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 transition-all" />
                <button type="button" onClick={handleAddExperience} className="px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors">Add Experience</button>
              </div>
            )}

            {activeTab === "resume" && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-gray-50 border border-dashed border-gray-300 text-center">
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="resume-upload" />
                  <label htmlFor="resume-upload" className="cursor-pointer text-sm text-gray-500 hover:text-primary transition-colors">
                    {resume ? `Current: ${resume.name} (${resume.size})` : "Click to upload resume (PDF, DOC, DOCX)"}
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-3">
              <button type="submit" className="min-h-[42px] px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-[#004a9e] transition-colors shadow-sm">
                Save Profile
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-[42px] px-5 rounded-xl border border-gray-300 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            {activeTab === "info" && (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm p-5 rounded-xl bg-gray-50 border border-gray-200">
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Email Address</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Mobile Contact</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{form.phone || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Barangay Address</dt>
                    <dd className="mt-1 text-xs text-gray-700">{form.address || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Date of Birth</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-700">{form.birthdate || "Not set"}</dd>
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
                    <p className="text-xs text-gray-500 mt-0.5">{edu.degree}{edu.year ? ` · ${edu.year}` : ""}</p>
                  </div>
                )) : <p className="text-xs text-gray-400">No education added yet.</p>}
              </div>
            )}

            {activeTab === "experience" && (
              <div className="space-y-3">
                {experience.length ? experience.map((exp) => (
                  <div key={exp.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{exp.role}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{exp.company} · {exp.startDate || "Start"} – {exp.endDate || "Present"}</p>
                    {exp.description && <p className="text-xs text-gray-400 mt-1">{exp.description}</p>}
                  </div>
                )) : <p className="text-xs text-gray-400">No experience added yet.</p>}
              </div>
            )}

            {activeTab === "resume" && (
              <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 text-center">
                {resume ? (
                  <div>
                    <p className="text-sm text-gray-900">{resume.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{resume.size} · Uploaded {resume.date}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No resume uploaded yet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
