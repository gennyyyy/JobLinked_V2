import { useState, useEffect } from "react";
import { GraduationCap, Briefcase, FileText } from "lucide-react";
import { listSeekerEducation, listSeekerExperience } from "../services/seekers";
import { signedUrl } from "../services/documents";
import { titleCase } from "../utils/titleCase";

// Handles both legacy single-string values and comma-separated tag strings.
function splitPref(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((t) => String(t).trim()).filter(Boolean);
}

// Candidate credentials card. `applicant` is an application row with an
// embedded `seeker` and `resume` (GET /applications/company/:id). The card owns
// its education/experience reads; any error resolves to empty credentials
// instead of hanging on "Loading credentials…".
const NO_CREDENTIALS = { education: [], experience: [] };

function SeekerProfileCard({ applicant }) {
  const seekerId = applicant.seeker?.id;
  const [credentials, setCredentials] = useState(() => (seekerId ? null : NO_CREDENTIALS));
  const [resumeError, setResumeError] = useState("");

  useEffect(() => {
    if (!seekerId) return;
    Promise.all([listSeekerEducation(seekerId), listSeekerExperience(seekerId)])
      .then(([education, experience]) =>
        setCredentials({ education: education || [], experience: experience || [] })
      )
      .catch(() => setCredentials(NO_CREDENTIALS));
  }, [seekerId]);

  async function openResume() {
    if (!applicant.resume?.file_path) return;
    try {
      const url = await signedUrl("resumes", applicant.resume.file_path);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setResumeError(err.message || "Could not open resume");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Credentials — <span>{titleCase(applicant.seeker?.full_name)}</span></p>
          <p className="text-[11px] text-gray-500">Contact, preferences, education & work history</p>
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Contact & Preferences</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Email</dt><dd className="mt-1 text-xs text-gray-700 break-all">{applicant.seeker?.email || "—"}</dd></div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Phone</dt><dd className="mt-1 text-xs text-gray-700">{applicant.seeker?.phone || "—"}</dd></div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Barangay</dt><dd className="mt-1 text-xs text-gray-700">{titleCase(applicant.seeker?.barangay_district) || "—"}</dd></div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Employment Status</dt><dd className="mt-1 text-xs text-gray-700">{applicant.seeker?.employment_status || "—"}</dd></div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Preferred Jobs</dt><dd className="mt-1 text-xs text-gray-700">{splitPref(applicant.seeker?.preferred_position).join(", ") || "—"}</dd></div>
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Preferred Locations</dt><dd className="mt-1 text-xs text-gray-700">{splitPref(applicant.seeker?.preferred_location).join(", ") || "—"}</dd></div>
        </dl>
        <div className="mt-2.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Skills</p>
          {applicant.seeker?.skills?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {applicant.seeker.skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 border border-primary/20 text-primary">{titleCase(skill)}</span>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">No skills listed.</p>}
        </div>
        {applicant.resume?.file_path && (
          <button type="button" onClick={openResume} className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
            <FileText className="w-3.5 h-3.5" />
            View Resume ({applicant.resume.file_name})
          </button>
        )}
        {resumeError && <p role="alert" className="mt-2 text-xs text-rose-600">{resumeError}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-2 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" /> Education
          </p>
          {!credentials && <p className="text-xs text-gray-400">Loading credentials…</p>}
          {credentials && (
            credentials.education.length ? (
              <ul className="space-y-1.5">
                {credentials.education.map((edu) => (
                  <li key={edu.id} className="text-xs text-gray-700">{titleCase(edu.level)} — {titleCase(edu.school)}{edu.field ? `, ${titleCase(edu.field)}` : ""} <span className="text-gray-400">({edu.end_year || "present"})</span></li>
                ))}
              </ul>
            ) : <p className="text-xs text-gray-400">No education recorded.</p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-2 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" /> Work Experience
          </p>
          {!credentials && <p className="text-xs text-gray-400">Loading credentials…</p>}
          {credentials && (
            credentials.experience.length ? (
              <ul className="space-y-1.5">
                {credentials.experience.map((exp) => (
                  <li key={exp.id} className="text-xs text-gray-700">{exp.position} — {exp.company} <span className="text-gray-400">({exp.start_date || "?"} → {exp.end_date || "present"})</span></li>
                ))}
              </ul>
            ) : <p className="text-xs text-gray-400">No work experience recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeekerProfileCard;
