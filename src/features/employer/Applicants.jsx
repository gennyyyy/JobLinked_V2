import { Button } from "../../components/ui/button";
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
import { PageSkeleton } from '../../shared/components/Skeletons';
import SeekerProfileCard from "../../shared/components/SeekerProfileCard";
import ApplicantsShell from "../../shared/components/ApplicantsShell";
import { TextField } from "../../shared/components/design";
import { titleCase } from "../../shared/utils/titleCase";
import { formatFullAddress } from "../../shared/utils/address";
import { INTERVIEW_ATTIRE, INTERVIEW_BRING } from "../../shared/constants";

const SUMMARY_CARDS = [
  { value: "all", label: "Active Application", tone: "border-border bg-blue-soft text-primary" },
  { value: "Under Review", label: "Under Review", tone: "border-border bg-warning-soft text-warning" },
  { value: "Interview", label: "Interview", tone: "border-border bg-blue-soft text-primary" },
  { value: "Accepted", label: "Accepted", tone: "border-border bg-success-soft text-success" },
  { value: "Rejected", label: "Rejected", tone: "border-border bg-danger-soft text-destructive" },
];

const STATUS_TONES = {
  Accepted: "bg-success-soft text-success",
  Interview: "bg-blue-soft text-primary",
  Rejected: "bg-danger-soft text-destructive",
  "Under Review": "bg-warning-soft text-warning",
};

// Micro-label above a small value, as used across the portal cards.
function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-navy">{children}</p>
    </div>
  );
}

function Chip({ label, selected, onToggle }) {
  return (
    <Button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`px-3 py-1.5 text-xs font-medium ${selected ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
    >
      {label}
    </Button>
  );
}

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

  if (loading) return <PageSkeleton stats={0} panels={2} />;

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-soft p-4 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">Couldn't load applicants</p>
          <p className="mt-0.5 text-xs">{error}</p>
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

  const summaryCards = SUMMARY_CARDS.map((card) => ({
    ...card,
    count: card.value === "all" ? tracked.length : counts[card.value],
  }));

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((applicant) => {
          const interviewing = interviewingId === applicant.id;
          return (
            <article key={applicant.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-navy">{titleCase(applicant.seeker?.full_name || "")}</p>
                <Button
                  type="button"
                  onClick={() => toggleProfile(applicant)}
                  aria-expanded={expandedId === applicant.id}
                  title={expandedId === applicant.id ? "Hide profile" : "View profile"}
                  data-applicant-profile-action="true"
                  variant="outline"
                  className="shrink-0 text-xs"
                >
                  {expandedId === applicant.id ? "Hide profile" : "View profile"}
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Detail label="Position">{applicant.job?.title}</Detail>
                <Detail label="Status">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONES[applicant.status] || "bg-secondary text-muted-foreground"}`}>
                    {applicant.status}
                  </span>
                </Detail>
                <Detail label="Applied">
                  <span className="font-normal text-muted-foreground">
                    {new Date(applicant.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </Detail>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {applicant.status === "Under Review" ? (
                  <Button type="button" title="Revert to Applied" onClick={() => setStatus(applicant.id, "Applied")}
                    data-action-tone="neutral" variant="outline" className="gap-1.5 text-xs">
                    <RotateCcw className="size-3.5" />
                    Undo Review
                  </Button>
                ) : (
                  <Button type="button" title="Move back to Under Review" onClick={() => setStatus(applicant.id, "Under Review")}
                    data-action-tone="warning" variant="outline" className="gap-1.5 border-warning/20 bg-warning-soft text-xs text-warning">
                    <Clock className="size-3.5" />
                    Review
                  </Button>
                )}
                <Button type="button" title={interviewing ? "Hide interview details" : "Schedule an interview"}
                  aria-pressed={interviewing}
                  onClick={() => (interviewing ? setInterviewingId(null) : handleInterview(applicant))}
                  data-action-tone={interviewing ? "purple-active" : "purple"}
                  variant={interviewing ? "default" : "outline"}
                  className={`gap-1.5 text-xs ${interviewing ? "" : "border-border bg-secondary text-navy hover:bg-secondary"}`}>
                  <Calendar className="size-3.5" />
                  Interview
                </Button>
                {applicant.status !== "Accepted" && (
                  <Button type="button" title="Accept candidate" onClick={() => setStatus(applicant.id, "Accepted")}
                    data-action-tone="success" variant="outline" className="gap-1.5 border-success/20 bg-success-soft text-xs text-success">
                    <CheckCircle2 className="size-3.5" />
                    Accept
                  </Button>
                )}
                {applicant.status !== "Rejected" && applicant.status !== "Placed" && (
                  <Button type="button" title="Reject candidate" onClick={() => setStatus(applicant.id, "Rejected")}
                    data-action-tone="danger" variant="outline" className="gap-1.5 border-danger/20 bg-danger-soft text-xs text-destructive">
                    <XCircle className="size-3.5" />
                    Reject
                  </Button>
                )}
              </div>
              {actionErrors[applicant.id] && (
                <p role="alert" className="mt-2 text-xs text-destructive">{actionErrors[applicant.id]}</p>
              )}

              {expandedId === applicant.id && (
                <div className="mt-4"><SeekerProfileCard applicant={applicant} /></div>
              )}
              {interviewing && (
                <div className="mt-4 rounded-xl border bg-muted p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="soft-icon size-8 rounded-lg">
                      <Calendar className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-navy">Schedule Interview — {titleCase(applicant.seeker?.full_name)}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">Pick a date &amp; time and add instructions for the candidate</p>
                    </div>
                  </div>
                  <div className="mb-4 flex flex-col gap-3">
                    <div>
                      <p className="mb-1.5 text-[10px] text-muted-foreground">
                        Attire <span className="normal-case">(optional, click to toggle)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {INTERVIEW_ATTIRE.map((opt) => (
                          <Chip
                            key={opt}
                            label={opt}
                            selected={interviewAttire.includes(opt)}
                            onToggle={() => setInterviewAttire((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]))}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] text-muted-foreground">
                        What to Bring <span className="normal-case">(optional, click to toggle)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {INTERVIEW_BRING.map((opt) => (
                          <Chip
                            key={opt}
                            label={opt}
                            selected={interviewBring.includes(opt)}
                            onToggle={() => setInterviewBring((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <TextField
                      id={`ivloc-${applicant.id}`}
                      label="Meeting Location"
                      value={interviewLocation}
                      onChange={(e) => setInterviewLocation(e.target.value)}
                      placeholder="Company address or meeting venue"
                    />
                    <div className="grid gap-3 md:grid-cols-3">
                      <TextField
                        id={`iv-${applicant.id}`}
                        label="Interview Date & Time"
                        type="datetime-local"
                        value={interviewAt}
                        min={interviewMin}
                        onChange={(e) => setInterviewAt(e.target.value)}
                      />
                      <TextField
                        id={`ivn-${applicant.id}`}
                        label="Instructions"
                        value={interviewNotes}
                        onChange={(e) => setInterviewNotes(e.target.value)}
                        placeholder="Meeting link, address, or any other note…"
                      />
                      <TextField
                        id={`ivnotes-${applicant.id}`}
                        label="Internal Notes"
                        multiline
                        rows={1}
                        value={interviewEmployerNotes}
                        onChange={(e) => setInterviewEmployerNotes(e.target.value)}
                        placeholder="Private notes — only you see these…"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => confirmInterview(applicant.id)} disabled={!interviewAt} className="text-xs">
                        Schedule
                      </Button>
                      <Button variant="outline" onClick={() => setInterviewingId(null)} className="text-xs">
                        Cancel
                      </Button>
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
