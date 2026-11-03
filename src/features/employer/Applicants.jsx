import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Calendar,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";
import SeekerProfileCard from "../../shared/components/SeekerProfileCard";
import ApplicantsShell from "../../shared/components/ApplicantsShell";
import { titleCase } from "../../shared/utils/titleCase";
import { formatFullAddress } from "../../shared/utils/address";
import { INTERVIEW_ATTIRE, INTERVIEW_BRING } from "../../shared/constants";

function Applicants() {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionErrors, setActionErrors] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [expandedId, setExpandedId] = useState(null);
  const [interviewingId, setInterviewingId] = useState(null);
  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [interviewEmployerNotes, setInterviewEmployerNotes] = useState("");
  const [interviewMin, setInterviewMin] = useState("");
  const [interviewAttire, setInterviewAttire] = useState([]);
  const [interviewBring, setInterviewBring] = useState([]);
  const [interviewLocation, setInterviewLocation] = useState("");

  const defaultInterviewLocation = useMemo(() => formatFullAddress(user || {}), [user]);

  useEffect(() => {
    if (!user) return;
    listByCompany(user.id)
      .then((list) => setApplicants(list))
      .catch((err) => setError(err.message || "Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [user]);

  async function setStatus(id, status, extra = {}) {
    try {
      const updated = await updateApplicationStatus(id, status, extra);
      setApplicants((prev) =>
        prev.map((a) => (a.id === id ? (updated ? { ...a, ...updated } : { ...a, status }) : a))
      );
      setActionErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [id]: err.message }));
    }
  }

  function handleInterview(applicant) {
    setInterviewingId(applicant.id);
    setInterviewAt("");
    setInterviewNotes("");
    setInterviewEmployerNotes("");
    setInterviewAttire([]);
    setInterviewBring([]);
    setInterviewLocation(defaultInterviewLocation);
    setInterviewMin(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }

  function confirmInterview(id) {
    if (!interviewAt) return;
    const parts = [];
    if (interviewLocation.trim()) parts.push(`Location: ${interviewLocation.trim()}`);
    if (interviewAttire.length) parts.push(`Attire: ${interviewAttire.join(", ")}`);
    if (interviewBring.length) parts.push(`Bring: ${interviewBring.join(", ")}`);
    if (interviewNotes.trim()) parts.push(interviewNotes.trim());
    const extra = { interviewAt, interviewInstructions: parts.join("\n") };
    if (interviewEmployerNotes.trim()) extra.employerNotes = interviewEmployerNotes.trim();
    setStatus(id, "Interview", extra);
    setInterviewingId(null);
  }

  function toggleProfile(applicant) {
    setExpandedId((prev) => (prev === applicant.id ? null : applicant.id));
  }

  const tracked = useMemo(
    () => applicants.filter((a) => a.status !== "Terminated"),
    [applicants]
  );

  const counts = useMemo(() => {
    const c = { "Under Review": 0, Interview: 0, Accepted: 0, Rejected: 0 };
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

  const filtered = tracked
    .filter((a) => {
      const matchesFilter = filter === "all" || a.status === filter;
      const matchesSearch = !search || a.seeker?.full_name?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) =>
      sort === "newest"
        ? new Date(b.applied_at) - new Date(a.applied_at)
        : new Date(a.applied_at) - new Date(b.applied_at)
    );

  const hasActiveFilters = filter !== "all" || search.trim() !== "";
  const clearFilters = () => { setFilter("all"); setSearch(""); };

  const summaryCards = [
    { value: "all", label: "Active Application", count: tracked.length, className: "border-blue-300 bg-blue-50 text-blue-700" },
    { value: "Under Review", label: "Under Review", count: counts["Under Review"], className: "border-amber-300 bg-amber-50 text-amber-700" },
    { value: "Interview", label: "Interview", count: counts.Interview, className: "border-purple-300 bg-purple-50 text-purple-700" },
    { value: "Accepted", label: "Accepted", count: counts.Accepted, className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
    { value: "Rejected", label: "Rejected", count: counts.Rejected, className: "border-rose-300 bg-rose-50 text-rose-700" },
  ];

  return (
    <ApplicantsShell
      title="Applicant Tracking"
      subtitle="Review credentials and update recruitment statuses — accepted candidates also appear on the Employees page"
      search={search}
      onSearchChange={setSearch}
      sort={sort}
      onSortChange={setSort}
      isEmpty={filtered.length === 0}
      emptyTitle={hasActiveFilters ? "No applicants match your filters" : "No applicants yet"}
      emptyBody={hasActiveFilters
        ? "Try adjusting your search or status filter to find candidates."
        : "Candidates applying to your listings will appear here for review."}
      onClearFilters={hasActiveFilters ? clearFilters : undefined}
      filters={summaryCards}
      activeFilter={filter}
      onFilterChange={setFilter}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((applicant) => {
          const statusStyle =
            applicant.status === "Accepted"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : applicant.status === "Interview"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : applicant.status === "Rejected"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";
          return (
            <article key={applicant.id} className="rounded-lg border border-primary/40 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-dark-blue truncate">{titleCase(applicant.seeker?.full_name || "")}</p>
                <button type="button" onClick={() => toggleProfile(applicant)}
                  title={expandedId === applicant.id ? "Hide profile" : "View profile"}
                  data-applicant-profile-action="true"
                  className="shrink-0 inline-flex items-center whitespace-nowrap rounded-full border border-dark-blue text-dark-blue px-3 py-1 text-[10px] font-semibold uppercase">
                  {expandedId === applicant.id ? "HIDE PROFILE" : "VIEW PROFILE"} →
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Position</p>
                  <p className="mt-0.5 text-xs font-semibold text-dark-blue truncate">{applicant.job?.title}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</p>
                  <span className={`mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2 py-0.5 rounded-full uppercase border font-semibold ${statusStyle}`}>
                    {applicant.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Applied</p>
                  <p className="mt-0.5 text-xs text-gray-700 truncate">
                    {new Date(applicant.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {applicant.status === "Under Review" && (
                  <button type="button" title="Revert to Applied" onClick={() => setStatus(applicant.id, "Applied")}
                    data-action-tone="neutral"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Undo Review</span>
                  </button>
                )}
                {applicant.status !== "Under Review" && (
                  <button type="button" title="Move back to Under Review" onClick={() => setStatus(applicant.id, "Under Review")}
                    data-action-tone="warning"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Review</span>
                  </button>
                )}
                <button type="button" title={interviewingId === applicant.id ? "Hide interview details" : "Schedule an interview"}
                  aria-pressed={interviewingId === applicant.id}
                  onClick={() => (interviewingId === applicant.id ? setInterviewingId(null) : handleInterview(applicant))}
                  data-action-tone={interviewingId === applicant.id ? "purple-active" : "purple"}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    interviewingId === applicant.id
                      ? "border-purple-600 bg-purple-600 text-white hover:bg-purple-700"
                      : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Interview</span>
                </button>
                {applicant.status !== "Accepted" && (
                  <button type="button" title="Accept candidate" onClick={() => setStatus(applicant.id, "Accepted")}
                    data-action-tone="success"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Accept</span>
                  </button>
                )}
                {applicant.status !== "Rejected" && applicant.status !== "Placed" && (
                  <button type="button" title="Reject candidate" onClick={() => setStatus(applicant.id, "Rejected")}
                    data-action-tone="danger"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer">
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Reject</span>
                  </button>
                )}
              </div>
              {actionErrors[applicant.id] && (
                <p role="alert" className="mt-1.5 text-[11px] text-danger">{actionErrors[applicant.id]}</p>
              )}

              {expandedId === applicant.id && (
                <div className="mt-3"><SeekerProfileCard applicant={applicant} /></div>
              )}
              {interviewingId === applicant.id && (
                <div className="mt-3">
                  <div className="bg-white border border-primary/20 rounded-xl p-4 md:p-5 shadow-xs">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Schedule Interview — <span>{titleCase(applicant.seeker?.full_name)}</span></p>
                        <p className="text-[11px] text-gray-500">Pick a date & time and add instructions for the candidate</p>
                      </div>
                    </div>
                    <div className="space-y-3 mb-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
                          Attire <span className="text-gray-400 normal-case tracking-normal">(optional, click to toggle)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {INTERVIEW_ATTIRE.map((opt) => {
                            const selected = interviewAttire.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() =>
                                  setInterviewAttire((prev) => (selected ? prev.filter((x) => x !== opt) : [...prev, opt]))
                                }
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                  selected ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
                          What to Bring <span className="text-gray-400 normal-case tracking-normal">(optional, click to toggle)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {INTERVIEW_BRING.map((opt) => {
                            const selected = interviewBring.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() =>
                                  setInterviewBring((prev) => (selected ? prev.filter((x) => x !== opt) : [...prev, opt]))
                                }
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                  selected ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label htmlFor={`ivloc-${applicant.id}`} className="block font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
                        Meeting Location
                      </label>
                      <input
                        id={`ivloc-${applicant.id}`}
                        type="text"
                        value={interviewLocation}
                        onChange={(e) => setInterviewLocation(e.target.value)}
                        placeholder="Company address or meeting venue"
                        className="w-full min-h-[40px] px-3 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                      />
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
                          placeholder="Meeting link, address, or any other note…"
                          className="w-full min-h-[40px] px-3 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
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
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
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
                </div>
              )}
            </article>
          );
        })}
      </div>
    </ApplicantsShell>
  );
}

export default Applicants;
