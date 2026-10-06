import { useState, useEffect, Fragment } from "react";
import useAuth from "../../shared/hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../shared/services/applications";
import { signedUrl } from "../../shared/services/documents";
import { listSeekerEducation, listSeekerExperience } from "../../shared/services/seekers";
import LoadingScreen from "../../shared/components/LoadingScreen";

// Handles both legacy single-string values and comma-separated tag strings.
function splitPref(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((t) => String(t).trim()).filter(Boolean);
}

function Applicants() {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [profile, setProfile] = useState({});
  const [interviewingId, setInterviewingId] = useState(null);
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [interviewEmployerNotes, setInterviewEmployerNotes] = useState("");
  const [interviewMin, setInterviewMin] = useState("");

  useEffect(() => {
    if (!user) return;
    // user.id IS the employers row id — no separate lookup needed
    listByCompany(user.id)
      .then((list) => setApplicants(list))
      .catch((err) => setError(err.message || "Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [user]);

  async function setStatus(id, status, extra = {}) {
    try {
      const updated = await updateApplicationStatus(id, status, extra);
      // Merge the full server response so interview_at, instructions etc. are reflected;
      // fall back to a local patch if the server returns null for any reason
      setApplicants((prev) =>
        prev.map((a) => (a.id === id ? (updated ? { ...a, ...updated } : { ...a, status }) : a))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  function handleInterview(applicant) {
    setInterviewingId(applicant.id);
    setInterviewAt("");
    setInterviewNotes("");
    setInterviewEmployerNotes("");
    setInterviewMin(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }

  function confirmInterview(id) {
    if (!interviewAt) return;
    const extra = { interviewAt, interviewInstructions: interviewNotes.trim() };
    // Empty notes send nothing — the key is omitted, not sent as "".
    if (interviewEmployerNotes.trim()) extra.employerNotes = interviewEmployerNotes.trim();
    setStatus(id, "Interview", extra);
    setInterviewingId(null);
  }

  // Candidate credentials are only fetched on first expand. Reads go through
  // the employer application seeker-children endpoints; any error resolves to
  // empty credentials instead of hanging on "Loading credentials…".
  function toggleProfile(applicant) {
    if (expandedId === applicant.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(applicant.id);
    const seekerId = applicant.seeker?.id;
    if (!seekerId || profile[seekerId]) return;
    Promise.all([listSeekerEducation(seekerId), listSeekerExperience(seekerId)])
      .then(([edu, exp]) => {
        setProfile((prev) => ({ ...prev, [seekerId]: { education: edu || [], experience: exp || [] } }));
      })
      .catch(() => {
        setProfile((prev) => ({ ...prev, [seekerId]: { education: [], experience: [] } }));
      });
  }

  async function openResume(applicant) {
    if (!applicant.resume?.file_path) return;
    try {
      const url = await signedUrl("resumes", applicant.resume.file_path);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  // Accepted/Terminated candidates are employees — they live on /employer/employees
  const tracked = applicants.filter((a) => a.status !== "Accepted" && a.status !== "Terminated");

  const counts = { "Under Review": 0, Interview: 0, Rejected: 0 };
  tracked.forEach((a) => { if (a.status in counts) counts[a.status] += 1; });

  const filtered = tracked.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter;
    const matchesSearch = !search || a.seeker?.full_name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">CANDIDATE PIPELINE</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Applicant Tracking</h1>
        <p className="mt-2 text-sm text-gray-500">Review credentials and update recruitment statuses — accepted candidates move to the Employees page</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: "all", label: "Applications", count: tracked.length, num: "text-gray-900", active: "bg-white border-primary shadow-sm ring-1 ring-primary/20" },
          { value: "Under Review", label: "Under Review", count: counts["Under Review"], num: "text-amber-700", active: "bg-amber-50/50 border-amber-500 shadow-sm ring-1 ring-amber-500/20" },
          { value: "Interview", label: "Interview", count: counts.Interview, num: "text-primary", active: "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" },
          { value: "Rejected", label: "Rejected", count: counts.Rejected, num: "text-danger", active: "bg-danger/5 border-danger shadow-sm ring-1 ring-danger/20" },
        ].map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setFilter(c.value)}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              filter === c.value ? c.active : "bg-white border-gray-200 hover:border-gray-300"
            }`}
          >
            <p className={`text-2xl font-bold ${c.num}`}>{c.count}</p>
            <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by candidate name..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      <div className="bg-white border-2 border-primary rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Candidate Name</th>
                <th className="text-left py-3 px-4 font-medium">Position Applied For</th>
                <th className="text-left py-3 px-4 font-medium">Date Submitted</th>
                <th className="text-left py-3 px-4 font-medium">Review Status</th>
                <th className="text-right py-3 px-4 font-medium">Evaluation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((applicant) => (
                <Fragment key={applicant.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <button onClick={() => toggleProfile(applicant)} className="text-left text-gray-900 font-medium hover:text-primary transition-colors">
                      {applicant.seeker?.full_name}
                      <span className="block text-[10px] font-mono uppercase tracking-wider text-gray-400">{expandedId === applicant.id ? "hide profile" : "view profile"}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">{applicant.job?.title}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    {new Date(applicant.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                      applicant.status === "Shortlisted" || applicant.status === "Accepted" || applicant.status === "Placed"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : applicant.status === "Rejected" || applicant.status === "Terminated"
                          ? "bg-danger/10 border-danger/20 text-danger"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      {applicant.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {applicant.status !== "Under Review" && (
                      <button onClick={() => setStatus(applicant.id, "Under Review")} className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors">
                        Under Review
                      </button>
                    )}
                    {applicant.status !== "Shortlisted" && (
                      <button onClick={() => setStatus(applicant.id, "Shortlisted")} className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        Shortlist
                      </button>
                    )}
                    {applicant.status !== "Interview" && (
                      <button onClick={() => handleInterview(applicant)} className="px-3 py-1 rounded-lg text-xs font-medium bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition-colors">
                        Interview
                      </button>
                    )}
                    <button onClick={() => setStatus(applicant.id, "Accepted")} className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                      Accept
                    </button>
                    {applicant.status !== "Rejected" && applicant.status !== "Placed" && (
                      <button onClick={() => setStatus(applicant.id, "Rejected")} className="px-3 py-1 rounded-lg text-xs font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors">
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === applicant.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={5} className="py-5 px-4">
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                        <div className="space-y-3">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Contact & Preferences</p>
                          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5">
                            <div><dt className="text-[10px] uppercase text-gray-400">Email</dt><dd className="text-gray-700 break-all">{applicant.seeker?.email || "—"}</dd></div>
                            <div><dt className="text-[10px] uppercase text-gray-400">Phone</dt><dd className="text-gray-700">{applicant.seeker?.phone || "—"}</dd></div>
                            <div><dt className="text-[10px] uppercase text-gray-400">Barangay</dt><dd className="text-gray-700">{applicant.seeker?.barangay_district || "—"}</dd></div>
                            <div><dt className="text-[10px] uppercase text-gray-400">Employment Status</dt><dd className="text-gray-700">{applicant.seeker?.employment_status || "—"}</dd></div>
                            <div><dt className="text-[10px] uppercase text-gray-400">Preferred Jobs</dt><dd className="text-gray-700">{splitPref(applicant.seeker?.preferred_position).join(", ") || "—"}</dd></div>
                            <div><dt className="text-[10px] uppercase text-gray-400">Preferred Locations</dt><dd className="text-gray-700">{splitPref(applicant.seeker?.preferred_location).join(", ") || "—"}</dd></div>
                          </dl>
                          <div>
                            <p className="text-[10px] uppercase text-gray-400 mb-1.5">Skills</p>
                            {applicant.seeker?.skills?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {applicant.seeker.skills.map((skill) => (
                                  <span key={skill} className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary">{skill}</span>
                                ))}
                              </div>
                            ) : <p className="text-gray-400">No skills listed.</p>}
                          </div>
                          {applicant.resume?.file_path && (
                            <button onClick={() => openResume(applicant)} className="text-primary hover:underline text-xs font-medium">
                              View Resume ({applicant.resume.file_name})
                            </button>
                          )}
                        </div>

                        <div className="space-y-4">
                          {!profile[applicant.seeker?.id] && <p className="text-xs text-gray-400">Loading credentials…</p>}
                          {profile[applicant.seeker?.id] && (
                            <>
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Education</p>
                                {profile[applicant.seeker.id].education.length ? (
                                  <ul className="space-y-1">
                                    {profile[applicant.seeker.id].education.map((edu) => (
                                      <li key={edu.id} className="text-gray-700">{edu.level} — {edu.school}{edu.field ? `, ${edu.field}` : ""} <span className="text-gray-400">({edu.end_year || "present"})</span></li>
                                    ))}
                                  </ul>
                                ) : <p className="text-gray-400">No education recorded.</p>}
                              </div>
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Work Experience</p>
                                {profile[applicant.seeker.id].experience.length ? (
                                  <ul className="space-y-1">
                                    {profile[applicant.seeker.id].experience.map((exp) => (
                                      <li key={exp.id} className="text-gray-700">{exp.position} — {exp.company} <span className="text-gray-400">({exp.start_date || "?"} → {exp.end_date || "present"})</span></li>
                                    ))}
                                  </ul>
                                ) : <p className="text-gray-400">No work experience recorded.</p>}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                </tr>
                )}
                {interviewingId === applicant.id && (
                  <tr className="bg-primary/5">
                    <td colSpan={5} className="py-4 px-4">
                      <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div>
                          <label htmlFor={`iv-${applicant.id}`} className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Interview Date &amp; Time</label>
                          <input
                            id={`iv-${applicant.id}`}
                            type="datetime-local"
                            value={interviewAt}
                            min={interviewMin}
                            onChange={(e) => setInterviewAt(e.target.value)}
                            className="min-h-[40px] px-3 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label htmlFor={`ivn-${applicant.id}`} className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Instructions</label>
                          <input
                            id={`ivn-${applicant.id}`}
                            type="text"
                            value={interviewNotes}
                            onChange={(e) => setInterviewNotes(e.target.value)}
                            placeholder="Meeting link, address, what to bring…"
                            className="w-full min-h-[40px] px-3 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label htmlFor={`ivnotes-${applicant.id}`} className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Internal Notes</label>
                          <textarea
                            id={`ivnotes-${applicant.id}`}
                            value={interviewEmployerNotes}
                            onChange={(e) => setInterviewEmployerNotes(e.target.value)}
                            placeholder="Private notes — only you see these…"
                            rows={1}
                            className="w-full min-h-[40px] px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmInterview(applicant.id)}
                            disabled={!interviewAt}
                            className="px-4 py-2 rounded-xl text-xs font-medium bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                          >
                            Schedule
                          </button>
                          <button onClick={() => setInterviewingId(null)} className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-white transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              No applicant submissions yet. Candidates applying to your listings will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Applicants;
