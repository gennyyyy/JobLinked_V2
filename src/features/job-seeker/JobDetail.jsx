import { useState, useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import useAuth from "../../shared/hooks/useAuth";
import { getJob } from "../../shared/services/jobs";
import { applyToJob, listBySeeker } from "../../shared/services/applications";
import { listResumes, uploadResume, validateFile } from "../../shared/services/documents";
import LoadingScreen from "../../shared/components/LoadingScreen";

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

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getJob(jobId),
      listBySeeker(user.id),
      listResumes(user.id),
    ])
      .then(([jobData, apps, resumeList]) => {
        setJob(jobData);
        setAlreadyApplied(apps.some((a) => a.job_id === jobId));
        setResumes(resumeList);
        const active = resumeList.find((r) => r.is_active) || resumeList[0];
        setSelectedResume(active?.id || "");
      })
      .catch((err) => setError(err.message || "Failed to load job"))
      .finally(() => setLoading(false));
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

  return (
    <div className="w-full space-y-6">
      <Link to="/job-seeker/jobs" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-900 transition-colors">
        ← Back to all jobs
      </Link>

      <article className="bg-white border border-primary rounded-lg p-6 md:p-10 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-6 border-b border-gray-200">
          <div>
            <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-[#0057B8]/10 border border-[#0057B8]/25 text-[#0057B8]">
              {job.location} · {job.employment_type}
            </span>
            <h1 className="mt-3 text-xl md:text-2xl font-bold tracking-tight text-gray-900">{job.title}</h1>
            <p className="mt-1 text-sm text-gray-500 font-medium">{job.employers?.company_name}</p>
          </div>
          <span className="inline-flex px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 font-mono text-sm text-primary font-semibold self-start">
            {job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "Negotiable"}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Compensation</p>
            <p className="mt-1 font-mono text-sm text-gray-900 font-medium">{job.salary_min ? `₱${job.salary_min}${job.salary_max ? `–₱${job.salary_max}` : ""}` : "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Location</p>
            <p className="mt-1 text-sm text-gray-900 font-medium">Brgy. {job.location}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Vacancies</p>
            <p className="mt-1 text-sm text-gray-900 font-medium">{job.vacancies ?? "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Application Deadline</p>
            <p className="mt-1 text-sm text-gray-600">{job.deadline ? new Date(job.deadline).toLocaleDateString() : "No deadline"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Date Posted</p>
            <p className="mt-1 text-sm text-gray-600">{job.published_at ? new Date(job.published_at).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Listing Status</p>
            <p className="mt-1 text-sm text-emerald-600 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Verified Open
            </p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Position Overview</h2>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed whitespace-pre-line">{job.description || "No description provided for this opening."}</p>
        </section>

        {requirements.length > 0 && (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Role Requirements</h2>
            <ul className="space-y-2.5">
              {requirements.map((req) => (
                <li key={req} className="text-sm text-gray-600 flex items-start gap-3">
                  <span className="text-[#0057B8] mt-0.5">▪</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {job.benefits && (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Benefits</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{job.benefits}</p>
          </section>
        )}

        {job.instructions && (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Application Instructions</h2>
            <p className="text-sm text-gray-600 whitespace-pre-line">{job.instructions}</p>
          </section>
        )}

        {tags.length > 0 && (
          <section className="mt-8">
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="font-mono text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary">{tag}</span>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            {alreadyApplied ? (
              <span className="font-mono text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                ✓ Application submitted — track updates in "My Applications"
              </span>
            ) : (
              <p className="text-xs text-gray-400">Submitting forwards your registered JobLinked profile to the employer.</p>
            )}
          </div>

          {!alreadyApplied && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {resumes.length > 0 && (
                <>
                  <label htmlFor="job-resume-select" className="sr-only">Choose resume</label>
                  <select
                    id="job-resume-select"
                    value={selectedResume}
                    onChange={(e) => setSelectedResume(e.target.value)}
                    className="min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 transition-all"
                  >
                    {resumes.map((r) => <option key={r.id} value={r.id}>{r.file_name}</option>)}
                  </select>
                </>
              )}
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" id="job-resume-upload" />
              <label htmlFor="job-resume-upload" className="inline-flex items-center min-h-[44px] px-4 rounded-xl text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer">
                {uploading ? "Uploading…" : "Upload New Resume"}
              </label>
              <button
                onClick={handleApply}
                disabled={applying}
                className="min-h-[44px] px-8 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
              >
                {applying ? "Submitting…" : "Submit Application"}
              </button>
            </div>
          )}
          {alreadyApplied && (
            <Link to="/job-seeker/applications" className="min-h-[44px] inline-flex items-center px-6 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors">
              View Application Status →
            </Link>
          )}
        </div>
        {applyError && <p className="mt-3 text-xs text-danger">{applyError}</p>}
        {uploadError && <p className="mt-3 text-xs text-danger">{uploadError}</p>}
      </article>
    </div>
  );
}

export default JobDetail;
