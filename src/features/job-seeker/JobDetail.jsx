import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Banknote, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, MapPin, Users } from "lucide-react";
import useAuth from "@/shared/hooks/useAuth";
import { getJob } from "@/shared/services/jobs";
import { applyToJob, listBySeeker } from "@/shared/services/applications";
import { listResumes, uploadResume, validateFile } from "@/shared/services/documents";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { CompanyMark, LinkButton, Panel } from "@/shared/components/design";
import { titleCase } from "@/shared/utils/titleCase";

function JobDetail() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Snapshot once per mount (same convention as the employer job list) so the
  // deadline comparison stays pure.
  const [today] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      getJob(jobId),
      listBySeeker(user.id),
      listResumes(user.id),
    ])
      .then(([jobData, apps, resumeList]) => {
        if (cancelled) return;
        setJob(jobData);
        setAlreadyApplied(apps.some((a) => a.job_id === jobId));
        setResumes(resumeList);
        const active = resumeList.find((r) => r.is_active) || resumeList[0];
        setSelectedResume(active?.id || "");
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load job"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, user]);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;
  if (!job) return <Navigate to="/job-seeker" replace />;

  async function handleResumeUpload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) { setUploadError(validationError); return; }
    setUploadError("");
    setUploading(true);
    try {
      await uploadResume(user.id, file);
      const updated = await listResumes(user.id);
      setResumes(updated);
      const active = updated.find((r) => r.is_active) || updated[0];
      setSelectedResume(active?.id || "");
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setApplyError("");
    try {
      await applyToJob(job.id, user.id, selectedResume || null);
      setAlreadyApplied(true);
    } catch (err) {
      setApplyError(err.message || "Failed to submit application");
    } finally {
      setApplying(false);
    }
  }

  const requirements = job.requirements ? job.requirements.split("\n").filter(Boolean) : [];
  const tags = Array.isArray(job.tags) ? job.tags.filter(Boolean) : [];

  // Same cutoff convention as the employer list: the deadline day itself still
  // accepts applications; only a fully elapsed day closes the listing.
  // Date-time without a zone suffix parses as local time — the true end of day.
  const deadlinePassed = job.deadline
    ? new Date(`${String(job.deadline).slice(0, 10)}T23:59:59.999`).getTime() < today
    : false;

  const salary = job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable";
  const companyName = titleCase(job.employers?.company_name);

  return (
    <div className="w-full pb-12">
      <Link to="/job-seeker/jobs" className="text-link text-xs">
        <ArrowLeft className="size-3.5" />
        Back to all jobs
      </Link>

      <div className="surface mt-5">
        <div className="flex flex-col justify-between gap-5 sm:flex-row">
          <div className="flex min-w-0 gap-5">
            <CompanyMark initials={String(job.employers?.company_name || "J").slice(0, 2).toUpperCase()} large />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-[-.035em] md:text-[30px]">{job.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{companyName}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />Brgy. {job.location}, Santa Maria</span>
                <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" />{job.employment_type}</span>
              </div>
            </div>
          </div>
          <p className="text-sm font-semibold text-navy sm:text-right">
            {salary}
            <span className="mt-1 block text-[10px] font-normal text-muted-foreground">{job.salary_min ? "per month" : "salary"}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_335px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Position overview" description="What this role asks of you, day to day.">
            <p className="prose-copy whitespace-pre-line">{job.description || "No description provided for this opening."}</p>

            {requirements.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-3 text-sm font-semibold">Role requirements</h2>
                <ul className="flex flex-col gap-2.5">
                  {requirements.map((req) => (
                    <li key={req} className="flex items-start gap-2.5 text-xs leading-6 text-muted-foreground">
                      <Check className="mt-1.5 size-3.5 shrink-0 text-teal" />
                      {req}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {job.benefits && (
              <section className="mt-7">
                <h2 className="mb-3 text-sm font-semibold">Benefits</h2>
                <p className="prose-copy whitespace-pre-line">{job.benefits}</p>
              </section>
            )}

            {job.instructions && (
              <section className="mt-7">
                <h2 className="mb-3 text-sm font-semibold">Application instructions</h2>
                <p className="prose-copy whitespace-pre-line">{job.instructions}</p>
              </section>
            )}

            {tags.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-3 text-sm font-semibold">Skills that make a difference</h2>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
              </section>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="The details at a glance">
            <dl className="flex flex-col gap-5">
              {[
                { icon: Banknote, label: "Monthly salary", value: salary },
                { icon: MapPin, label: "Work location", value: `Brgy. ${job.location}, Santa Maria` },
                { icon: BriefcaseBusiness, label: "Work arrangement", value: job.work_arrangement || "On-site" },
                { icon: Users, label: "Openings", value: job.vacancies ?? "—" },
                { icon: CalendarDays, label: "Apply by", value: job.deadline ? new Date(job.deadline).toLocaleDateString() : "No deadline" },
                { icon: CalendarDays, label: "Date posted", value: job.published_at ? new Date(job.published_at).toLocaleDateString() : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div className="flex gap-3" key={label}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <dt className="text-[10px] text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-xs font-medium text-navy">{value}</dd>
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${deadlinePassed ? "text-muted-foreground" : "text-success"}`} />
                <div className="min-w-0">
                  <dt className="text-[10px] text-muted-foreground">Listing status</dt>
                  <dd className={`mt-1 text-xs font-medium ${deadlinePassed ? "text-muted-foreground" : "text-success"}`}>
                    {deadlinePassed ? "Closed — application deadline passed" : "Verified Open"}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              {alreadyApplied ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                    Application submitted — track updates in "My Applications"
                  </p>
                  <LinkButton href="/job-seeker/applications" variant="outline">
                    View application status
                    <ArrowRight data-icon="inline-end" />
                  </LinkButton>
                </>
              ) : (
                <>
                  <p className="text-xs leading-5 text-muted-foreground">Submitting forwards your registered JobLinked profile to the employer.</p>
                  {resumes.length > 0 && (
                    <>
                      <Label htmlFor="job-resume-select" className="text-xs">Resume to attach</Label>
                      <select
                        id="job-resume-select"
                        value={selectedResume}
                        onChange={(e) => setSelectedResume(e.target.value)}
                        className="form-select"
                      >
                        {resumes.map((r) => <option key={r.id} value={r.id}>{r.file_name}</option>)}
                      </select>
                    </>
                  )}
                  <Input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="job-resume-upload" />
                  <Label htmlFor="job-resume-upload" className="w-fit cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                    {uploading ? "Uploading…" : "Upload new resume"}
                  </Label>
                  <p className="text-[10px] leading-5 text-muted-foreground">PDF up to 2 MB; DOC or DOCX up to 5 MB.</p>
                  {deadlinePassed && (
                    <p className="text-xs text-danger">Applications are closed — the deadline has passed.</p>
                  )}
                  <Button onClick={handleApply} disabled={applying || deadlinePassed}>
                    {applying ? "Submitting…" : "Submit Application"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </>
              )}
              {applyError && <p className="text-xs text-danger">{applyError}</p>}
              {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default JobDetail;
