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
  const [form, setForm] = useState({
    firstName: user?.name?.split(" ")[0] || "",
    lastName: user?.name?.split(" ").slice(1).join(" ") || "",
    phone: existing.phone || "",
    address: existing.address || "",
    birthdate: existing.birthdate || "",
    skills: (existing.skills || []).join(", "),
  });

  if (!email) {
    return (
      <div className="text-center py-16 text-white/40">
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
    });
    if (name && name !== user?.name) {
      login(role, { email, name });
    }
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          MUNICIPAL CANDIDATE PROFILE
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          My Account & Resume
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Your credentials, contact information, and skill tags seen by Santa Maria employers
        </p>
      </header>

      <div className="bg-[#272727] border border-white/[0.06] rounded-2xl p-7 md:p-9 shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        {/* User Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0075A2]/15 border border-[#0075A2]/30 flex items-center justify-center font-bold text-xl text-[#0075A2] shadow-[0_4px_16px_rgba(0,117,162,0.15)]">
              {form.firstName[0] || "J"}{form.lastName[0] || "S"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{fullName}</h2>
              <p className="font-mono text-xs text-white/40 mt-0.5">
                Accredited Job Seeker · {email}
              </p>
            </div>
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="min-h-[40px] px-5 rounded-xl border border-white/[0.12] text-xs font-medium text-white hover:bg-white/[0.05] hover:border-[#0075A2]/40 transition-colors self-start sm:self-center"
            >
              Edit Profile
            </button>
          )}
        </div>

        {saved && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-fade-in">
            ✓ Your candidate profile information has been successfully updated.
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  First Name
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Last Name
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Contact Mobile
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="0917 123 4567"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => handleChange("birthdate", e.target.value)}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                Barangay & Residential Address
              </label>
              <input
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Poblacion, Santa Maria, Bulacan"
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] tracking-wider text-white/50 uppercase mb-1.5">
                Skills & Competencies <span className="text-white/35 font-normal">(comma-separated)</span>
              </label>
              <input
                value={form.skills}
                onChange={(e) => handleChange("skills", e.target.value)}
                placeholder="Data Entry, Customer Relations, Bookkeeping, English Fluency"
                className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-[#0075A2]/60 focus:ring-1 focus:ring-[#0075A2]/30 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                className="min-h-[42px] px-6 rounded-xl bg-[#0075A2] text-white text-xs font-medium hover:bg-[#005a7d] transition-colors shadow-[0_2px_8px_rgba(0,117,162,0.25)]"
              >
                Save Profile
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-[42px] px-5 rounded-xl border border-white/[0.1] text-xs font-medium text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div>
                <dt className="font-mono text-[10px] tracking-widest uppercase text-white/40">Email Address</dt>
                <dd className="mt-1 font-mono text-xs text-white/80">{email || "—"}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-widest uppercase text-white/40">Mobile Contact</dt>
                <dd className="mt-1 font-mono text-xs text-white/80">{form.phone || "Not set"}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-widest uppercase text-white/40">Barangay Address</dt>
                <dd className="mt-1 text-xs text-white/80">{form.address || "Not set"}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-widest uppercase text-white/40">Date of Birth</dt>
                <dd className="mt-1 font-mono text-xs text-white/80">{form.birthdate || "Not set"}</dd>
              </div>
            </dl>

            <section>
              <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase mb-3">
                Skills & Capabilities
              </h3>
              {skills.length ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="font-mono text-xs px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/70"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/40">No skills specified yet. Click "Edit Profile" to list your skills.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
