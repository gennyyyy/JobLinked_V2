import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useState, useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { getJob } from "../../shared/services/jobs";
import { applyToJob, listBySeeker } from "../../shared/services/applications";
import { listResumes, uploadResume, validateFile } from "../../shared/services/documents";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { SectionCard } from "../../shared/components/dashboard";
import { titleCase } from "../../shared/utils/titleCase";

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

  return (
    <div className="w-full space-y-6">
      <Link to="/job-seeker/jobs" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to all jobs
      </Link>

      <SectionCard
        titleAs="h1"
        title={job.title}
        subtitle={titleCase(job.employers?.company_name)}
        action={
          <span className="inline-flex px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 font-mono text-sm text-primary font-semibold shrink-0">
            {job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable"}
          </span>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-6 border-b border-border">
          <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">
            {job.location} · {job.employment_type}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 p-5 rounded-xl bg-muted border border-border">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Compensation</p>
            <p className="mt-1 font-mono text-sm text-foreground font-medium">{job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Location</p>
            <p className="mt-1 text-sm text-foreground font-medium">Brgy. {job.location}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Work Arrangement</p>
            <p className="mt-1 text-sm text-foreground font-medium">{job.work_arrangement || "On-site"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Vacancies</p>
            <p className="mt-1 text-sm text-foreground font-medium">{job.vacancies ?? "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Application Deadline</p>
            <p className="mt-1 text-sm text-muted-foreground">{job.deadline ? new Date(job.deadline).toLocaleDateString() : "No deadline"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Date Posted</p>
            <p className="mt-1 text-sm text-muted-foreground">{job.published_at ? new Date(job.published_at).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Listing Status</p>
            <p className={`mt-1 text-sm font-medium flex items-center gap-1.5 ${deadlinePassed ? "text-muted-foreground" : "text-emerald-600"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${deadlinePassed ? "bg-gray-400" : "bg-emerald-500"}`} />
              {deadlinePassed ? "Closed — application deadline passed" : "Verified Open"}
            </p>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Position Overview</h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-line">{job.description || "No description provided for this opening."}</p>
        </section>

        {requirements.length > 0 && (
          <section className="mt-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Role Requirements</h2>
            <ul className="space-y-2.5">
              {requirements.map((req) => (
                <li key={req} className="text-sm text-muted-foreground flex items-start gap-3">
                  <span className="text-[#0057B8] mt-0.5">▪</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {job.benefits && (
          <section className="mt-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Benefits</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{job.benefits}</p>
          </section>
        )}

        {job.instructions && (
          <section className="mt-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Application Instructions</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{job.instructions}</p>
          </section>
        )}

        {tags.length > 0 && (
          <section className="mt-6">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="font-mono text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">{tag}</span>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            {alreadyApplied ? (
              <span className="font-mono text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Application submitted — track updates in "My Applications"
              </span>
            ) : (
              <p className="text-xs text-muted-foreground">Submitting forwards your registered JobLinked profile to the employer.</p>
            )}
          </div>

          {!alreadyApplied && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {resumes.length > 0 && (
                <>
                  <Label htmlFor="job-resume-select" className="sr-only">Choose resume</Label>
                  <select
                    id="job-resume-select"
                    value={selectedResume}
                    onChange={(e) => setSelectedResume(e.target.value)}
                    className="min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:border-primary/60 transition-all"
                  >
                    {resumes.map((r) => <option key={r.id} value={r.id}>{r.file_name}</option>)}
                  </select>
                </>
              )}
              <Input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="job-resume-upload" />
              <Label htmlFor="job-resume-upload" className="inline-flex items-center min-h-[44px] px-4 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-gray-200 border border-border transition-colors cursor-pointer">
                {uploading ? "Uploading…" : "Upload New Resume"}
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">PDF up to 2 MB; DOC or DOCX up to 5 MB.</p>
              {deadlinePassed && (
                <p className="text-xs text-danger">Applications are closed — the deadline has passed.</p>
              )}
              <Button
                onClick={handleApply}
                disabled={applying || deadlinePassed}
                className="min-h-[44px] px-8 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
              >
                {applying ? "Submitting…" : "Submit Application"}
              </Button>
            </div>
          )}
          {alreadyApplied && (
            <Link to="/job-seeker/applications" className="min-h-[44px] inline-flex items-center px-6 rounded-xl border border-gray-300 text-muted-foreground text-xs font-medium hover:bg-muted transition-colors">
              View Application Status →
            </Link>
          )}
        </div>
        {applyError && <p className="mt-3 text-xs text-danger">{applyError}</p>}
        {uploadError && <p className="mt-3 text-xs text-danger">{uploadError}</p>}
      </SectionCard>
    </div>
  );
}

export default JobDetail;
