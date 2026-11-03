import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import useAuth from "@/shared/hooks/useAuth";
import { listBySeeker } from "@/shared/services/applications";
import LoadingScreen from "@/shared/components/LoadingScreen";

import ApplicantsShell from "@/shared/components/ApplicantsShell";
import { SectionCard } from "@/shared/components/dashboard";
import { EmptyState } from "@/shared/components/design";
import { titleCase } from "@/shared/utils/titleCase";

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

const TILE_TONES = {
  all: "border-primary/15 bg-blue-soft text-primary",
  accepted: "border-success/20 bg-success-soft text-success",
  pending: "border-warning/20 bg-warning-soft text-warning",
  rejected: "border-danger/20 bg-danger-soft text-destructive",
};

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
    { id: "all", label: "Total", value: applications.length, hint: "All submitted Application", title: "Show all applications" },
    { id: "accepted", label: "Accepted", value: acceptedCount, hint: "Accepted or Placed Application", title: "Show accepted applications" },
    { id: "pending", label: "Pending", value: pendingCount, hint: "Awaiting employer review", title: "Show pending applications" },
    { id: "rejected", label: "Rejected", value: rejectedCount, hint: "Application not selected", title: "Show rejected applications" },
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
            const selected = statusFilter === tile.id;
            return (
              <Button
                key={tile.id}
                type="button"
                onClick={() => toggleFilter(tile.id)}
                aria-pressed={selected}
                title={tile.title}
                className={`w-full justify-start rounded-xl px-4 py-3 text-left ${TILE_TONES[tile.id]} ${selected ? "ring-2 ring-current" : ""}`}
              >
                <span className="flex min-w-0 flex-col items-start">
                  <span className="text-3xl font-semibold leading-none">{tile.value}</span>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-[.08em]">{tile.label}</span>
                  <span className="mt-1 text-[10px] font-normal opacity-80">{tile.hint}</span>
                </span>
              </Button>
            );
          })}
        </>
      }
    >

      {applications.length === 0 ? (
        <SectionCard title="My applications" subtitle="Browse verified municipal listings and apply with a single tap">
          <EmptyState
            title="You haven't submitted any job applications yet."
            description="Explore verified openings from accredited Santa Maria employers and apply with your JobLinked profile."
            href="/job-seeker/jobs"
            label="Explore openings"
          />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard title="My applications" subtitle="No applications match this view">
          <EmptyState
            title="No applications match this filter."
            description="Clear the filter to see every application you have submitted."
            action={<Button type="button" variant="outline" onClick={() => setStatusFilter("all")}>Clear filter</Button>}
          />
        </SectionCard>
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
                  className={`rounded-2xl border p-5 transition-colors ${
                    status === "Rejected" || status === "Terminated"
                      ? "border-warning/25 bg-warning-soft"
                      : "border-border bg-card"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => setSelectedId((current) => current === application.id ? null : application.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId((current) => current === application.id ? null : application.id);
                      }
                    }}
                    className="cursor-pointer rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="min-w-0 truncate text-base font-semibold text-navy">{application.job?.title}</h2>

                      <Link
                        to={`/job-seeker/jobs/${application.job_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="shrink-0 whitespace-nowrap rounded-full border border-primary/25 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary hover:bg-primary/10"
                      >
                        View job posting details →
                      </Link>

                      <ChevronDown
                        className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building className="size-3.5 shrink-0" />
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
                                  isFinalRejected ? "bg-danger" : index < reached ? "bg-primary" : "bg-border"
                                }`}
                              />
                            )}
                            <div className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center">
                              <div
                                className={`grid size-8 shrink-0 place-items-center rounded-full ${
                                  isFinalRejected
                                    ? "bg-danger text-white"
                                    : isReached
                                      ? "bg-primary text-primary-foreground"
                                      : "border-2 border-primary/30 bg-card"
                                }`}
                              >
                                {isFinalRejected ? <X className="size-4" /> : isReached ? <Check className="size-4" /> : null}
                              </div>
                              <p
                                className={`mt-2 text-xs font-semibold leading-tight ${
                                  isFinalRejected ? "text-danger" : isReached ? "text-navy" : "text-muted-foreground"
                                }`}
                              >
                                {stage.label}
                              </p>
                              {stage.date ? (
                                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{stage.date}</p>
                              ) : null}
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-4 space-y-4 border-t pt-4"
                      >
                        {hasInterview ? (
                          <div className="space-y-4 rounded-xl border bg-muted/50 p-4 sm:p-5">
                            {/* Interview header */}
                            <div className="flex flex-col justify-between gap-2.5 border-b pb-3 sm:flex-row sm:items-center">
                              <div className="flex items-center gap-2.5">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
                                  <Calendar className="size-4" />
                                </span>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-warning">Interview scheduled</p>
                                  <p className="text-sm font-semibold text-navy">
                                    {interviewFormatted ? interviewFormatted.full : "Schedule to be confirmed"}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="self-start bg-warning-soft text-warning sm:self-center">
                                Action required
                              </Badge>
                            </div>

                            {/* Structured info grid */}
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {parsedInstructions.location && (
                                <div className="rounded-xl border bg-card p-3.5">
                                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                                    <MapPin className="size-3.5 text-primary" /> Location / Venue
                                  </div>
                                  <p className="break-words text-sm font-medium text-navy">
                                    {parsedInstructions.location}
                                  </p>
                                </div>
                              )}

                              {parsedInstructions.attire && (
                                <div className="rounded-xl border bg-card p-3.5">
                                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                                    <Shirt className="size-3.5 text-teal" /> Recommended Attire
                                  </div>
                                  <Badge variant="secondary" className="bg-blue-soft text-primary">
                                    {parsedInstructions.attire}
                                  </Badge>
                                </div>
                              )}

                              {parsedInstructions.bring.length > 0 && (
                                <div className="rounded-xl border bg-card p-3.5 md:col-span-2">
                                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                                    <CheckSquare className="size-3.5 text-success" />
                                    What to Bring ({parsedInstructions.bring.length})
                                  </div>
                                  {parsedInstructions.bring.length > 1 ? (
                                    <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground marker:text-teal">
                                      {parsedInstructions.bring.map((item, idx) => (
                                        <li key={idx}>{item}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {parsedInstructions.bring.map((item, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-1.5 rounded-lg border border-success/20 bg-success-soft px-3 py-1.5 text-xs font-medium text-success"
                                        >
                                          <CheckCircle2 className="size-3.5 shrink-0" />
                                          <span>{item}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {parsedInstructions.notes.length > 0 && (
                                <div className="rounded-xl border bg-card p-3.5 md:col-span-2">
                                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                                    <Info className="size-3.5" /> Instructions &amp; Notes
                                  </div>
                                  <p className="whitespace-pre-line text-xs leading-6 text-muted-foreground">
                                    {parsedInstructions.notes.join("\n")}
                                  </p>
                                </div>
                              )}
                            </div>

                            {application.employer_notes && (
                              <div className="rounded-xl border border-warning/20 bg-warning-soft p-3.5 text-xs">
                                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-warning">
                                  <MessageSquare className="size-3.5" /> Note from employer
                                </div>
                                <p className="whitespace-pre-line leading-6 text-foreground">
                                  {application.employer_notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-xl border bg-muted/50 p-4">
                            <div className="flex items-start gap-3">
                              <span className="soft-icon size-9 rounded-xl">
                                <Info className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-navy">
                                  {application.status === "Applied" && "Application Received"}
                                  {application.status === "Under Review" && "Under Review by Employer"}
                                  {application.status === "Accepted" && "Application Accepted"}
                                  {application.status === "Placed" && "Placed in Position"}
                                  {application.status === "Rejected" && "Application Not Selected"}
                                  {application.status === "Terminated" && "Engagement Ended"}
                                </p>
                                <p className="mt-1 text-xs leading-6 text-muted-foreground">
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
                              <div className="rounded-lg border bg-card p-3 text-xs">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Employer note</p>
                                <p className="whitespace-pre-line leading-6 text-muted-foreground">{application.employer_notes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Link
                            to={`/job-seeker/jobs/${application.job_id}`}
                            className="text-link text-xs"
                          >
                            View job posting details
                            <ExternalLink className="size-3.5" />
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
