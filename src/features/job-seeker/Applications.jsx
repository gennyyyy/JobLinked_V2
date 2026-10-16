import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Building,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
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
import { PageHeader, SectionCard } from "../../shared/components/dashboard";
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

function Applications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

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
  const filtered = applications.filter((application) =>
    statusFilter === "all" ||
    (statusFilter === "accepted" ? ["Accepted", "Placed"].includes(application.status) : statusFilter === "pending" ? ["Applied", "Under Review", "Interview"].includes(application.status) : application.status === "Rejected")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="APPLICATION TRACKER"
        title="My Applications"
        subtitle="Live status of your submitted job applications with Santa Maria employers"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { id: "all", label: "Total", value: applications.length, hint: "All submitted applications", title: "Show all applications", icon: Briefcase },
          { id: "accepted", label: "Accepted", value: acceptedCount, hint: "Accepted or placed applications", title: "Show accepted applications", icon: CheckCircle2 },
          { id: "pending", label: "Pending", value: pendingCount, hint: "Awaiting employer review", title: "Show pending applications", icon: Clock },
          { id: "rejected", label: "Rejected", value: rejectedCount, hint: "Applications not selected", title: "Show rejected applications", icon: XCircle },
        ].map((tile) => {
          const TileIcon = tile.icon;
          const isSelected = statusFilter === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => toggleFilter(tile.id)}
              aria-pressed={isSelected}
              title={tile.title}
              className={`rounded-xl p-4 text-left cursor-pointer transition-all active:scale-[0.99] bg-white border ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20 shadow-xs"
                  : "border-gray-200 hover:border-gray-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-sans text-2xl md:text-3xl font-bold text-primary leading-none">{tile.value}</p>
                <TileIcon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-gray-400"}`} />
              </div>
              <p className="mt-3 font-mono text-[10px] md:text-[11px] tracking-widest text-gray-500 uppercase">{tile.label}</p>
              <p className="mt-2 text-xs text-gray-400">{tile.hint}</p>
            </button>
          );
        })}
      </div>

      {applications.length === 0 ? (
        <SectionCard title="My Applications" subtitle="Browse verified municipal listings and apply with a single tap">
          <div className="py-8 text-center">
            <p className="text-base text-gray-600">You haven't submitted any job applications yet.</p>
            <Link to="/job-seeker/jobs" className="inline-flex mt-6 min-h-[44px] items-center px-6 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors">
              Explore Openings →
            </Link>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="All Applications" subtitle="Latest submissions first">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No applications match this filter.{" "}
              <button onClick={() => setStatusFilter("all")} className="text-primary hover:underline underline-offset-4 font-medium cursor-pointer">Clear filter</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((application) => {
                const isExpanded = selectedId === application.id;
                const interviewFormatted = formatInterviewDateTime(application.interview_at);
                const parsedInstructions = parseInterviewInstructions(application.interview_instructions);
                const hasInterview = Boolean(application.interview_at || application.status === "Interview" || application.interview_instructions);

                return (
                  <div
                    key={application.id}
                    className="py-4 first:pt-0 last:pb-0 transition-colors"
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
                      className="group p-3 sm:p-4 rounded-xl cursor-pointer hover:bg-gray-50/90 focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all border border-transparent hover:border-gray-200/80"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors truncate">
                              {application.job?.title}
                            </h2>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                            <span className="flex items-center gap-1 font-medium text-gray-700">
                              <Building className="w-3.5 h-3.5 text-gray-400" />
                              {titleCase(application.job?.employers?.company_name || "")}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="font-mono text-[11px] text-gray-400">
                              Applied on {new Date(application.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>

                          {interviewFormatted && (
                            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-900 border border-amber-500/25">
                              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Interview: {interviewFormatted.full}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-3 py-1 rounded-full uppercase border font-semibold ${
                              ["Accepted", "Placed"].includes(application.status)
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : application.status === "Rejected" || application.status === "Terminated"
                                  ? "bg-danger/10 border-danger/20 text-danger"
                                  : application.status === "Interview"
                                    ? "bg-amber-50 border-amber-300 text-amber-800"
                                    : "bg-blue-50 border-blue-200 text-blue-700"
                            }`}
                          >
                            {application.status === "Interview" && <Calendar className="w-3 h-3 text-amber-600" />}
                            {["Accepted", "Placed"].includes(application.status) && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {(application.status === "Rejected" || application.status === "Terminated") && <XCircle className="w-3 h-3 text-danger" />}
                            {["Applied", "Under Review"].includes(application.status) && <Clock className="w-3 h-3 text-blue-600" />}
                            <span>{application.status}</span>
                          </span>

                          <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? "rotate-180 text-primary" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details Card */}
                      {isExpanded && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-fadeIn"
                        >
                          {hasInterview ? (
                            <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
                              {/* Interview Header Banner */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-200/80">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700">
                                    <Calendar className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="font-mono text-[10px] tracking-wider uppercase text-amber-800 font-bold">
                                      Interview Scheduled
                                    </p>
                                    <p className="text-sm font-bold text-gray-900">
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
                                  <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                      <MapPin className="w-3.5 h-3.5 text-primary" /> Location / Venue
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 break-words">
                                      {parsedInstructions.location}
                                    </p>
                                  </div>
                                )}

                                {/* Recommended Attire */}
                                {parsedInstructions.attire && (
                                  <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                      <Shirt className="w-3.5 h-3.5 text-accent" /> Recommended Attire
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                      {parsedInstructions.attire}
                                    </span>
                                  </div>
                                )}

                                {/* Items to Bring */}
                                {parsedInstructions.bring.length > 0 && (
                                  <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-gray-500 uppercase tracking-wider mb-2">
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
                                  <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-3.5 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                      <Info className="w-3.5 h-3.5 text-gray-400" /> Instructions & Notes
                                    </div>
                                    <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
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
                            <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                                  <Info className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {application.status === "Applied" && "Application Received"}
                                    {application.status === "Under Review" && "Under Review by Employer"}
                                    {application.status === "Accepted" && "Application Accepted"}
                                    {application.status === "Placed" && "Placed in Position"}
                                    {application.status === "Rejected" && "Application Not Selected"}
                                    {application.status === "Terminated" && "Engagement Ended"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
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
                                <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs">
                                  <p className="font-mono text-[10px] uppercase font-semibold text-gray-400 mb-1">Employer Note</p>
                                  <p className="text-gray-700 whitespace-pre-line">{application.employer_notes}</p>
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
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

export default Applications;
