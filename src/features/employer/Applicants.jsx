import { useState, useEffect, useMemo, Fragment } from "react";
import {
  Users,
  Search,
  Filter,
  Clock,
  Calendar,
  XCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";
import SeekerProfileCard from "../../shared/components/SeekerProfileCard";
import { titleCase } from "../../shared/utils/titleCase";
import { formatFullAddress } from "../../shared/utils/address";
import { INTERVIEW_ATTIRE, INTERVIEW_BRING } from "../../shared/constants";

function Applicants() {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Status-change failures are keyed per applicant so one failed action can't
  // replace the whole list (page-level `error` stays load-failures only).
  const [actionErrors, setActionErrors] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
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
    // Empty notes send nothing — the key is omitted, not sent as "".
    if (interviewEmployerNotes.trim()) extra.employerNotes = interviewEmployerNotes.trim();
    setStatus(id, "Interview", extra);
    setInterviewingId(null);
  }

  // Candidate credentials are fetched by SeekerProfileCard itself once the row
  // is expanded.
  function toggleProfile(applicant) {
    setExpandedId((prev) => (prev === applicant.id ? null : applicant.id));
  }

  // Accepted candidates also appear on /employer/employees; Terminated ones are hidden here.
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
            Review credentials and update recruitment statuses — accepted candidates also appear on the Employees page
          </p>
        </div>
      </header>

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { value: "all", label: "Applications", count: tracked.length, icon: null },
          { value: "Under Review", label: "Under Review", count: counts["Under Review"], icon: Clock },
          { value: "Interview", label: "Interview", count: counts.Interview, icon: Calendar },
          { value: "Accepted", label: "Accepted", count: counts.Accepted, icon: CheckCircle2 },
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
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-primary focus:bg-white transition-all"
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
                <option value="Accepted">Accepted ({counts.Accepted})</option>
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
                <th scope="col" className="text-left py-3 px-4 font-semibold rounded-l-xl">Candidate</th>
                <th scope="col" className="text-left py-3 px-4 font-semibold">Position Applied For</th>
                <th scope="col" className="text-left py-3 px-4 font-semibold">Date Submitted</th>
                <th scope="col" className="text-left py-3 px-4 font-semibold">Review Status</th>
                <th scope="col" className="text-right py-3 px-4 font-semibold rounded-r-xl">Evaluation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
                <Fragment key={applicant.id}>
                <tr className="hover:bg-gray-50/80 transition-colors group">
                  <th scope="row" className="py-4 px-4 text-left font-normal">
                    <button type="button" onClick={() => toggleProfile(applicant)} className="text-left group/btn cursor-pointer">
                      <span className="block font-semibold text-gray-900 group-hover/btn:text-primary transition-colors text-sm line-clamp-1">
                        <span>{titleCase(applicant.seeker?.full_name)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-gray-500 font-medium">
                        {expandedId === applicant.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {expandedId === applicant.id ? "Hide profile" : "View profile"}
                      </span>
                    </button>
                  </th>
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
                    {applicant.status === "Under Review" && (
                      <button
                        type="button"
                        title="Revert to Applied"
                        onClick={() => setStatus(applicant.id, "Applied")}
                        className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Undo Review</span>
                      </button>
                    )}
                    {applicant.status !== "Under Review" && (
                      <button type="button" title="Move back to Under Review" onClick={() => setStatus(applicant.id, "Under Review")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Review</span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-pressed={interviewingId === applicant.id}
                      title={interviewingId === applicant.id ? "Hide interview details" : "Schedule an interview"}
                      onClick={() => (interviewingId === applicant.id ? setInterviewingId(null) : handleInterview(applicant))}
                      className={`inline-flex items-center gap-1.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                        interviewingId === applicant.id
                          ? "border-primary bg-primary text-white hover:bg-primary-hover"
                          : "border-primary/25 bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Interview</span>
                    </button>
                    {applicant.status !== "Accepted" && (
                      <button type="button" title="Accept candidate" onClick={() => setStatus(applicant.id, "Accepted")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Accept</span>
                      </button>
                    )}
                    {applicant.status !== "Rejected" && applicant.status !== "Placed" && (
                      <button type="button" title="Reject candidate" onClick={() => setStatus(applicant.id, "Rejected")} className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Reject</span>
                      </button>
                    )}
                    </div>
                    {actionErrors[applicant.id] && (
                      <p role="alert" className="mt-1.5 text-right text-[11px] text-danger">{actionErrors[applicant.id]}</p>
                    )}
                  </td>
                </tr>
                {expandedId === applicant.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={5} className="py-5 px-4">
                      {/* Credential Detail Card */}
                      <SeekerProfileCard applicant={applicant} />
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
