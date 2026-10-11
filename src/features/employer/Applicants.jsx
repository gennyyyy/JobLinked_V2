import { useState, useEffect, useMemo, Fragment } from "react";
import {
  Users,
  Search,
  Filter,
  Clock,
  Calendar,
  XCircle,
  FileText,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Briefcase,
} from "lucide-react";
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

  // Accepted/Terminated candidates are employees — they live on /employer/employees
  const tracked = useMemo(
    () => applicants.filter((a) => a.status !== "Accepted" && a.status !== "Terminated"),
    [applicants]
  );

  const counts = useMemo(() => {
    const c = { "Under Review": 0, Interview: 0, Rejected: 0 };
    tracked.forEach((a) => { if (a.status in c) c[a.status] += 1; });
    return c;
  }, [tracked]);

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-rose-100 rounded-2xl p-5 flex items-start gap-3 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.08)]">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Couldn't load applicants</p>
            <p className="text-sm text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const filtered = tracked.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter;
    const matchesSearch = !search || a.seeker?.full_name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const hasActiveFilters = filter !== "all" || search.trim() !== "";
  const clearFilters = () => { setFilter("all"); setSearch(""); };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              CANDIDATE PIPELINE
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-gray-500 font-medium">Santa Maria PESO</span>
          </div>
          <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-gray-900">
            Applicant Tracking
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review credentials and update recruitment statuses — accepted candidates move to the Employees page
          </p>
        </div>
      </header>

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: "all", label: "Applications", count: tracked.length, icon: null },
          { value: "Under Review", label: "Under Review", count: counts["Under Review"], icon: Clock },
          { value: "Interview", label: "Interview", count: counts.Interview, icon: Calendar },
          { value: "Rejected", label: "Rejected", count: counts.Rejected, icon: XCircle },
        ].map((c) => {
          const MetricIcon = c.icon;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilter(c.value)}
              className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                filter === c.value ? "bg-white border-gray-900 ring-1 ring-gray-900/20" : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-gray-900">{c.count}</p>
                {MetricIcon && <MetricIcon className="w-4 h-4 text-gray-400" />}
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">{c.label}</p>
            </button>
          );
        })}
      </div>

      {/* Main Container: Search, Filter & Applicants Table */}
      <div className="bg-white border border-primary rounded-lg p-5 md:p-5 shadow-xs space-y-5">
        {/* Controls: Search & Status Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate name..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-700 font-medium focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Statuses ({tracked.length})</option>
                <option value="Under Review">Under Review ({counts["Under Review"]})</option>
                <option value="Interview">Interview ({counts.Interview})</option>
                <option value="Rejected">Rejected ({counts.Rejected})</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        {/* Applicants Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-wider text-gray-500 uppercase bg-gray-50/70">
                <th className="text-left py-3 px-4 font-semibold rounded-l-xl">Candidate</th>
                <th className="text-left py-3 px-4 font-semibold">Position Applied For</th>
                <th className="text-left py-3 px-4 font-semibold">Date Submitted</th>
                <th className="text-left py-3 px-4 font-semibold">Review Status</th>
                <th className="text-right py-3 px-4 font-semibold rounded-r-xl">Evaluation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((applicant) => {
                const statusStyle =
                  applicant.status === "Interview"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : applicant.status === "Rejected"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";
                return (
                <Fragment key={applicant.id}>
                <tr className="hover:bg-gray-50/80 transition-colors group">
                  <td className="py-4 px-4">
                    <button type="button" onClick={() => toggleProfile(applicant)} className="text-left group/btn cursor-pointer">
                      <span className="block font-semibold text-gray-900 group-hover/btn:text-primary transition-colors text-sm line-clamp-1">
                        <span className="uppercase">{applicant.seeker?.full_name}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-gray-500 font-medium">
                        {expandedId === applicant.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {expandedId === applicant.id ? "Hide profile" : "View profile"}
                      </span>
                    </button>
                  </td>
                  <td className="py-4 px-4 text-gray-600">{applicant.job?.title}</td>
                  <td className="py-4 px-4 font-mono text-xs text-gray-500">
                    {new Date(applicant.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border font-semibold ${statusStyle}`}>
                      {applicant.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                    {applicant.status !== "Under Review" && (
                      <button type="button" title="Move back to Under Review" onClick={() => setStatus(applicant.id, "Under Review")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Review</span>
                      </button>
                    )}
                    {applicant.status !== "Interview" && (
                      <button type="button" title="Schedule an interview" onClick={() => handleInterview(applicant)} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-primary/25 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Interview</span>
                      </button>
                    )}
                    <button type="button" title="Accept candidate" onClick={() => setStatus(applicant.id, "Accepted")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Accept</span>
                    </button>
                    {applicant.status !== "Rejected" && applicant.status !== "Placed" && (
                      <button type="button" title="Reject candidate" onClick={() => setStatus(applicant.id, "Rejected")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Reject</span>
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
                {expandedId === applicant.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={5} className="py-5 px-4">
                      {/* Credential Detail Card */}
                      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Credentials — <span className="uppercase">{applicant.seeker?.full_name}</span></p>
                            <p className="text-[11px] text-gray-500">Contact, preferences, education & work history</p>
                          </div>
                        </div>

                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">Contact & Preferences</p>
                          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Email</dt><dd className="mt-1 text-xs text-gray-700 break-all">{applicant.seeker?.email || "—"}</dd></div>
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Phone</dt><dd className="mt-1 text-xs text-gray-700">{applicant.seeker?.phone || "—"}</dd></div>
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Barangay</dt><dd className="mt-1 text-xs text-gray-700 uppercase">{applicant.seeker?.barangay_district || "—"}</dd></div>
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Employment Status</dt><dd className="mt-1 text-xs text-gray-700">{applicant.seeker?.employment_status || "—"}</dd></div>
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Preferred Jobs</dt><dd className="mt-1 text-xs text-gray-700">{splitPref(applicant.seeker?.preferred_position).join(", ") || "—"}</dd></div>
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100"><dt className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Preferred Locations</dt><dd className="mt-1 text-xs text-gray-700">{splitPref(applicant.seeker?.preferred_location).join(", ") || "—"}</dd></div>
                          </dl>
                          <div className="mt-2.5">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Skills</p>
                            {applicant.seeker?.skills?.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {applicant.seeker.skills.map((skill) => (
                                  <span key={skill} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 border border-primary/20 text-primary uppercase">{skill}</span>
                                ))}
                              </div>
                            ) : <p className="text-xs text-gray-400">No skills listed.</p>}
                          </div>
                          {applicant.resume?.file_path && (
                            <button type="button" onClick={() => openResume(applicant)} className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition-colors cursor-pointer">
                              <FileText className="w-3.5 h-3.5" />
                              View Resume ({applicant.resume.file_name})
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-2 flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5" /> Education
                            </p>
                            {!profile[applicant.seeker?.id] && <p className="text-xs text-gray-400">Loading credentials…</p>}
                            {profile[applicant.seeker?.id] && (
                              profile[applicant.seeker.id].education.length ? (
                                <ul className="space-y-1.5">
                                  {profile[applicant.seeker.id].education.map((edu) => (
                                    <li key={edu.id} className="text-xs text-gray-700 uppercase">{edu.level} — {edu.school}{edu.field ? `, ${edu.field}` : ""} <span className="text-gray-400">({edu.end_year || "present"})</span></li>
                                  ))}
                                </ul>
                              ) : <p className="text-xs text-gray-400">No education recorded.</p>
                            )}
                          </div>
                          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-2 flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5" /> Work Experience
                            </p>
                            {!profile[applicant.seeker?.id] && <p className="text-xs text-gray-400">Loading credentials…</p>}
                            {profile[applicant.seeker?.id] && (
                              profile[applicant.seeker.id].experience.length ? (
                                <ul className="space-y-1.5">
                                  {profile[applicant.seeker.id].experience.map((exp) => (
                                    <li key={exp.id} className="text-xs text-gray-700">{exp.position} — {exp.company} <span className="text-gray-400">({exp.start_date || "?"} → {exp.end_date || "present"})</span></li>
                                  ))}
                                </ul>
                              ) : <p className="text-xs text-gray-400">No work experience recorded.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                </tr>
                )}
                {interviewingId === applicant.id && (
                  <tr className="bg-primary/[0.03]">
                    <td colSpan={5} className="py-4 px-4">
                      {/* Interview Scheduler Card */}
                      <div className="bg-white border border-primary/20 rounded-xl p-4 md:p-5 shadow-xs">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Schedule Interview — <span className="uppercase">{applicant.seeker?.full_name}</span></p>
                            <p className="text-[11px] text-gray-500">Pick a date & time and add instructions for the candidate</p>
                          </div>
                        </div>
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
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          >
                            Schedule
                          </button>
                          <button onClick={() => setInterviewingId(null)} className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer">
                            Cancel
                          </button>
                        </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
              </div>
              <p className="font-semibold text-gray-900 mb-1">
                {hasActiveFilters ? "No applicants match your filters" : "No applicants yet"}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {hasActiveFilters
                  ? "Try adjusting your search or status filter to find candidates."
                  : "Candidates applying to your listings will appear here for review."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Applicants;
