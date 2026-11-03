import { useState, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import {
  Building,
  Calendar,
  Check,
  CheckCircle2,
  X,
  MapPin,
  Shirt,
  CheckSquare,
  Info,
  MessageSquare,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { listBySeeker } from "../../shared/services/applications";
import LoadingScreen from "../../shared/components/LoadingScreen";

import ApplicantsShell from "../../shared/components/ApplicantsShell";
import { SectionCard } from "../../shared/components/dashboard";
import { titleCase } from "../../shared/utils/titleCase";

function formatInterviewDateTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: isoString, time: "", full: isoString };

  const dateFormatted = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeFormatted = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { date: dateFormatted, time: timeFormatted, full: `${dateFormatted} at ${timeFormatted}` };
}

function parseInterviewInstructions(text) {
  if (!text) return { location: null, attire: null, bring: [], notes: [] };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let location = null;
  let attire = null;
  let bring = [];
  const notes = [];

  for (const line of lines) {
    if (/^location:\s*/i.test(line)) {
      location = line.replace(/^location:\s*/i, "").trim();
    } else if (/^attire:\s*/i.test(line)) {
      attire = line.replace(/^attire:\s*/i, "").trim();
    } else if (/^bring:\s*/i.test(line)) {
      const itemsStr = line.replace(/^bring:\s*/i, "").trim();
      bring = itemsStr.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      notes.push(line);
    }
  }

  return { location, attire, bring, notes };
}

const STAGE_ORDER = ["Applied", "Under Review", "Interview"];
// Where each terminal status lands on the stepper's fourth stage.
const FINAL_STAGE = { Accepted: "Hired", Placed: "Hired", Rejected: "Rejected", Terminated: "Terminated" };

// application.history is [{ status, changed_at }]. Order is not guaranteed
// (the API currently returns it oldest-first), so keep the latest timestamp per
// status. Older responses omit history entirely, so every lookup falls back and
// unknown dates simply render nothing.
function stageDates(application) {
  const dates = {};
  for (const entry of application.history || []) {
    if (!entry?.status || !entry.changed_at) continue;
    const current = dates[entry.status];
    if (!current || new Date(entry.changed_at) > new Date(current)) dates[entry.status] = entry.changed_at;
  }
  dates.Applied = dates.Applied || application.applied_at || null;
  dates.Interview = application.interview_at || dates.Interview || null;
  return dates;
}

function stageDate(isoString, withTime = false) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  if (!withTime) return date;
  return `${date} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

function Applications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listBySeeker(user.id)
      .then((result) => { if (!cancelled) setApplications(result); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load applications"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  const acceptedCount = applications.filter((application) => ["Accepted", "Placed"].includes(application.status)).length;
  const rejectedCount = applications.filter((application) => application.status === "Rejected").length;
  const pendingCount = applications.filter((application) => ["Applied", "Under Review", "Interview"].includes(application.status)).length;
  const toggleFilter = (next) => setStatusFilter((prev) => (prev === next ? "all" : next));
  const filtered = applications
    .filter((application) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "accepted" ? ["Accepted", "Placed"].includes(application.status) : statusFilter === "pending" ? ["Applied", "Under Review", "Interview"].includes(application.status) : application.status === "Rejected");
      const matchesSearch = !search || [application.job?.title, application.job?.employers?.company_name, application.seeker?.full_name]
        .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) =>
      sortBy === "oldest"
        ? new Date(a.applied_at) - new Date(b.applied_at)
        : new Date(b.applied_at) - new Date(a.applied_at)
    );

  const tiles = [
    { id: "all", label: "Total", value: applications.length, hint: "All submitted Application", tone: "bg-blue-50 border-blue-300 text-blue-800", title: "Show all applications" },
    { id: "accepted", label: "Accepted", value: acceptedCount, hint: "Accepted or Placed Application", tone: "bg-emerald-50 border-emerald-300 text-emerald-800", title: "Show accepted applications" },
    { id: "pending", label: "Pending", value: pendingCount, hint: "Awaiting employer review", tone: "bg-purple-50 border-purple-300 text-purple-800", title: "Show pending applications" },
    { id: "rejected", label: "Rejected", value: rejectedCount, hint: "Application not selected", tone: "bg-danger/5 border-danger/40 text-danger", title: "Show rejected applications" },
  ];

  return (
    <ApplicantsShell
      title="My Applications"
      subtitle="Live status of your submitted job applications with Santa Maria employers"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by company or position..."
      searchAriaLabel="Search applications"
      sort={sortBy}
      onSortChange={setSortBy}
      sortOptions={[
        { value: "newest", label: "Newest First" },
        { value: "oldest", label: "Oldest First" },
      ]}
      sortAriaLabel="Sort applications"
      sidebar={
        <>
          {tiles.map((tile) => {
            const isSelected = statusFilter === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                data-tone={tile.id === "accepted" ? "success" : tile.id === "rejected" ? "danger" : tile.id === "pending" ? "purple" : "info"}
                onClick={() => toggleFilter(tile.id)}
                aria-pressed={isSelected}
                title={tile.title}
                className={`w-full text-left rounded-lg border px-4 py-3 cursor-pointer transition-all ${tile.tone} ${
                  isSelected ? "ring-1 ring-offset-0 ring-current" : ""
                }`}
              >
                <p className="text-3xl font-bold leading-none">{tile.value}</p>
                <p className="mt-2 font-mono text-[11px] tracking-widest uppercase">{tile.label}</p>
                <p className="mt-1 text-xs opacity-80">{tile.hint}</p>
              </button>
            );
          })}
        </>
      }
    >

      {applications.length === 0 ? (
        <SectionCard title="My Applications" subtitle="Browse verified municipal listings and apply with a single tap">
          <div className="py-8 text-center">
            <p className="text-base text-muted-foreground">You haven't submitted any job applications yet.</p>
            <Link to="/job-seeker/jobs" className="inline-flex mt-6 min-h-[44px] items-center px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">
              Explore Openings →
            </Link>
          </div>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-primary bg-card py-8 text-center text-sm text-muted-foreground">
          No applications match this filter.{" "}
          <button onClick={() => setStatusFilter("all")} className="text-primary hover:underline underline-offset-4 font-medium cursor-pointer">Clear filter</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((application) => {
              const status = application.status;
              const isExpanded = selectedId === application.id;
              const interviewFormatted = formatInterviewDateTime(application.interview_at);
              const parsedInstructions = parseInterviewInstructions(application.interview_instructions);
              const hasInterview = Boolean(application.interview_at || application.status === "Interview" || application.interview_instructions);

              // Stepper: three fixed stages + a fourth set by the terminal status.
              const finalLabel = FINAL_STAGE[status] || "Hired";
              const endsRejected = finalLabel === "Rejected" || finalLabel === "Terminated";
              const dates = stageDates(application);
              const reached = FINAL_STAGE[status] ? 4 : STAGE_ORDER.indexOf(status) + 1;
              const stages = [
                { label: "Applied", date: stageDate(dates.Applied) },
                { label: "Under Review", date: stageDate(dates["Under Review"]) },
                { label: "Interview", date: stageDate(dates.Interview, true) },
                { label: finalLabel, date: FINAL_STAGE[status] ? stageDate(dates[status]) : null },
              ];

              return (
                <article
                  key={application.id}
                  className={`rounded-lg border p-5 transition-colors ${
                    status === "Rejected" || status === "Terminated"
                      ? "border-amber-300 bg-amber-50"
                      : "border-primary bg-card"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId((current) => current === application.id ? null : application.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId((current) => current === application.id ? null : application.id);
                      }
                    }}
                    className="cursor-pointer rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <div className="flex items-center gap-2.5">
                      <h2 className="min-w-0 text-base font-bold text-dark-blue truncate">{application.job?.title}</h2>

                      <Link
                        to={`/job-seeker/jobs/${application.job_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="shrink-0 inline-flex items-center whitespace-nowrap rounded-full border border-primary text-primary px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                      >
                        VIEW JOB POSTING DETAILS →
                      </Link>

                      <ChevronDown
                        className={`ml-auto w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {titleCase(application.job?.employers?.company_name || "")}
                    </p>

                    {/* Status stepper — plain divs, no list roles. */}
                    <div className="mt-5 flex items-start">
                      {stages.map((stage, index) => {
                        const isFinalRejected = index === 3 && endsRejected;
                        const isReached = index < reached;
                        return (
                          <Fragment key={stage.label}>
                            {index > 0 && (
                              <div
                                className={`mt-[15px] h-0.5 flex-1 ${
                                  isFinalRejected ? "bg-danger" : index < reached ? "bg-primary" : "bg-gray-200"
                                }`}
                              />
                            )}
                            <div className="min-w-0 flex-1 px-0.5 flex flex-col items-center text-center">
                              <div
                                className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                                  isFinalRejected
                                    ? "bg-danger text-white"
                                    : isReached
                                      ? "bg-primary text-white"
                                      : "bg-card border-2 border-primary/40"
                                }`}
                              >
                                {isFinalRejected ? <X className="w-4 h-4" /> : isReached ? <Check className="w-4 h-4" /> : null}
                              </div>
                              <p
                                className={`mt-2 text-xs font-semibold leading-tight ${
                                  isFinalRejected ? "text-danger" : isReached ? "text-dark-blue" : "text-muted-foreground"
                                }`}
                              >
                                {stage.label}
                              </p>
                              {stage.date ? (
                                <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">{stage.date}</p>
                              ) : null}
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>

                    {/* Expanded Details Card */}
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-4 pt-4 border-t border-border space-y-4 animate-fadeIn"
                      >
                        {hasInterview ? (
                          <div className="bg-muted/70 border border-border rounded-xl p-4 sm:p-5 space-y-4">
                            {/* Interview Header Banner */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/80">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700">
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-mono text-[10px] tracking-wider uppercase text-amber-800 font-bold">
                                    Interview Scheduled
                                  </p>
                                  <p className="text-sm font-bold text-foreground">
                                    {interviewFormatted ? interviewFormatted.full : "Schedule to be confirmed"}
                                  </p>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 self-start sm:self-center">
                                Action Required
                              </span>
                            </div>

                            {/* Structured Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Location */}
                              {parsedInstructions.location && (
                                <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                    <MapPin className="w-3.5 h-3.5 text-primary" /> Location / Venue
                                  </div>
                                  <p className="text-sm font-semibold text-foreground break-words">
                                    {parsedInstructions.location}
                                  </p>
                                </div>
                              )}

                              {/* Recommended Attire */}
                              {parsedInstructions.attire && (
                                <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                    <Shirt className="w-3.5 h-3.5 text-accent" /> Recommended Attire
                                  </div>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    {parsedInstructions.attire}
                                  </span>
                                </div>
                              )}

                              {/* Items to Bring */}
                              {parsedInstructions.bring.length > 0 && (
                                <div className="md:col-span-2 bg-card border border-border rounded-xl p-3.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    What to Bring ({parsedInstructions.bring.length})
                                  </div>
                                  {parsedInstructions.bring.length > 1 ? (
                                    <ul className="list-disc pl-5 space-y-1 text-xs text-emerald-800 marker:text-emerald-600">
                                      {parsedInstructions.bring.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {parsedInstructions.bring.map((item, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>{item}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Extra notes from instructions */}
                              {parsedInstructions.notes.length > 0 && (
                                <div className="md:col-span-2 bg-card border border-border rounded-xl p-3.5 shadow-2xs">
                                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                    <Info className="w-3.5 h-3.5 text-muted-foreground" /> Instructions & Notes
                                  </div>
                                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                                    {parsedInstructions.notes.join("\n")}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Employer Note */}
                            {application.employer_notes && (
                              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs">
                                <div className="flex items-center gap-1.5 font-mono font-semibold text-amber-900 uppercase tracking-wider mb-1">
                                  <MessageSquare className="w-3.5 h-3.5 text-amber-700" /> Note from Employer
                                </div>
                                <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                                  {application.employer_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-muted/70 border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                                <Info className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {application.status === "Applied" && "Application Received"}
                                  {application.status === "Under Review" && "Under Review by Employer"}
                                  {application.status === "Accepted" && "Application Accepted"}
                                  {application.status === "Placed" && "Placed in Position"}
                                  {application.status === "Rejected" && "Application Not Selected"}
                                  {application.status === "Terminated" && "Engagement Ended"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {application.status === "Applied" && "Your profile and documents were submitted to the employer. You will receive an update once they review it."}
                                  {application.status === "Under Review" && "The employer is currently reviewing candidate qualifications and credentials for this position."}
                                  {application.status === "Accepted" && "Congratulations! You have been accepted for this position. The employer may reach out with onboarding steps."}
                                  {application.status === "Placed" && "Congratulations! You have been placed into this position. The employer may reach out with onboarding details."}
                                  {application.status === "Rejected" && "Thank you for applying. Unfortunately, the employer decided not to move forward with this application."}
                                  {application.status === "Terminated" && "This employment engagement has ended. Please contact the employer if you need more details."}
                                </p>
                              </div>
                            </div>

                            {application.employer_notes && (
                              <div className="bg-card border border-border rounded-lg p-3 text-xs">
                                <p className="font-mono text-[10px] uppercase font-semibold text-muted-foreground mb-1">Employer Note</p>
                                <p className="text-muted-foreground whitespace-pre-line">{application.employer_notes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Link
                            to={`/job-seeker/jobs/${application.job_id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            <span>View job posting details</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
      )}
    </ApplicantsShell>
  );
}

export default Applications;
