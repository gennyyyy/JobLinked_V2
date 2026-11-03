import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Plus,
  Edit3,
  Eye,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building,
  X,
  RotateCcw,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { JOB_TAGS, JOB_BENEFITS, JOB_EDUCATION_LEVELS, JOB_EXPERIENCE_PRESETS, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import { listEmployerJobs, createJob, updateJob, changeJobStatus, deleteJob } from "../../shared/services/jobs";
import { getEmployer } from "../../shared/services/auth";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { Pager } from "../../shared/components/dashboard";
import useDialog from "../../shared/hooks/useDialog";
import { InlineError } from "../../shared/components/dashboard";
import ApplicantsShell from "../../shared/components/ApplicantsShell";

const initialForm = {
  title: "",
  office: "",
  description: "",
  requirements: "",
  salary_min: "",
  salary_max: "",
  employment_type: "Full-time",
  location: "",
  vacancies: 1,
  deadline: "",
  instructions: "",
  benefits: [],
  tags: [],
  work_arrangement: "On-site",
};

// ponytail: education is a prefixed line inside requirements text; promote to a real column only if it must be filtered/matched.
const EDUCATION_LINE = /^\s*Education:\s*(.*)$/;

function parseEducation(requirements) {
  const match = (requirements || "").split("\n").find((line) => EDUCATION_LINE.test(line));
  return match ? match.match(EDUCATION_LINE)[1].trim() : "";
}

function applyEducation(requirements, level) {
  const others = (requirements || "").split("\n").filter((line) => !EDUCATION_LINE.test(line));
  const lines = level ? [`Education: ${level}`, ...others] : others;
  return lines.join("\n").trim();
}

// ponytail: experience is a prefixed line inside requirements text; promote to a real column only if it must be filtered/matched.
const EXPERIENCE_LINE = /^\s*Experience:\s*(?:No experience required|(\d+))/i;

function parseExperience(requirements) {
  const line = String(requirements || "").split("\n").find((l) => EXPERIENCE_LINE.test(l));
  if (!line) return "";
  const m = line.match(EXPERIENCE_LINE);
  return m[1] ? m[1] : "0";
}

function applyExperience(requirements, years) {
  const lines = String(requirements || "").split("\n").filter((l) => l.trim() && !EXPERIENCE_LINE.test(l));
  if (years !== "" && years !== undefined && years !== null) {
    const n = Number(years);
    lines.unshift(n === 0 ? "Experience: No experience required" : `Experience: ${n} year${n === 1 ? "" : "s"}`);
  }
  return lines.join("\n");
}

export default function JobPosts() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [company, setCompany] = useState(null);
  const [accreditationStatus, setAccreditationStatus] = useState("none");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [total, setTotal] = useState(0);
  // null = Total (no status filter). Counts come from the API's company-wide
  // `counts` object so the tiles stay stable while paging/filtering.
  const [statusFilter, setStatusFilter] = useState(null);
  const [statusCounts, setStatusCounts] = useState(null);

  // Feedback notifications
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Unsaved-changes guard: closing the form is confirmed first, so ~20 minutes
  // of typing isn't lost to a stray X / Cancel. The snapshot is taken when the
  // form opens; confirming discards, cancelling returns to the form as-is.
  const [formSnapshot, setFormSnapshot] = useState(null);
  const formDirty = formSnapshot !== null && JSON.stringify(form) !== formSnapshot;
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // "Custom…" selected in the work-experience dropdown (stored line stays the source of truth)
  const [experienceCustom, setExperienceCustom] = useState(false);
  const experienceYears = parseExperience(form.requirements);
  const experienceIsCustom = experienceCustom || (experienceYears !== "" && !JOB_EXPERIENCE_PRESETS.includes(Number(experienceYears)));

  // View job detail modal
  const [viewingJob, setViewingJob] = useState(null);

  // Confirm archive modal
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);

  // Confirm delete modal (holds the whole post so the dialog can read applicant_count and title)
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Escape / Tab-trap / focus-return for the two job modals (shared useDialog).
  // Escape inside the form goes through the discard guard so typing isn't lost,
  // and the barangay dropdown owns Escape while it is up — its own keydown
  // listener closes just the dropdown first.
  const formPanelRef = useDialog(
    () => { if (!confirmDiscard && !barangayOpen) requestCloseForm(); },
    showForm
  );
  const viewPanelRef = useDialog(() => setViewingJob(null), Boolean(viewingJob));

  // Barangay listbox (drops down only; native select flips up when scrolled)
  const [barangayOpen, setBarangayOpen] = useState(false);
  const [barangayQuery, setBarangayQuery] = useState("");
  const barangayRef = useRef(null);
  const filteredBarangays = SANTA_MARIA_BARANGAYS.filter((b) =>
    b.toLowerCase().includes(barangayQuery.trim().toLowerCase())
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const companyData = await getEmployer();

      setCompany(companyData);
      if (companyData) {
        // Read accreditation_status directly from the employers row — kept in sync
        // server-side so we don't need a separate query to employer_accreditations
        const status = companyData.accreditation_status || "none";
        setAccreditationStatus(status);
        if (status !== "approved") {
          setJobs([]);
          setTotal(0);
          return;
        }
        // The { data, total, page, pageSize } envelope (M1) — one screen at a
        // time, paged with the footer below.
        const res = await listEmployerJobs(companyData.id, { page, status: statusFilter });
        setJobs(res.data);
        setTotal(res.total);
        setPageSize(res.pageSize);
        setStatusCounts(res.counts || null);
      } else {
        setAccreditationStatus("none");
        setJobs([]);
        setTotal(0);
      }
    } catch (err) {
      setLoadError(err.message || "Failed to load job listings");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, [user, loadData]);

  // Auto-dismiss success notification after 5s
  useEffect(() => {
    if (!actionSuccess) return;
    const timer = setTimeout(() => setActionSuccess(""), 5000);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

  // Close barangay listbox on outside click / Escape
  useEffect(() => {
    if (!barangayOpen) return;
    function onPointerDown(e) {
      if (barangayRef.current && !barangayRef.current.contains(e.target)) setBarangayOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setBarangayOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [barangayOpen]);

  async function refreshJobs() {
    if (!company) return;
    try {
      const res = await listEmployerJobs(company.id, { page, status: statusFilter });
      setJobs(res.data);
      setTotal(res.total);
      setPageSize(res.pageSize);
      setStatusCounts(res.counts || null);
    } catch (err) {
      setActionError(err.message || "Failed to refresh jobs");
    }
  }

  function handleOpenCreate() {
    if (accreditationStatus !== "approved") {
      setActionError("Your employer account must be accredited before you can post jobs.");
      return;
    }
    setForm(initialForm);
    setFormSnapshot(JSON.stringify(initialForm));
    setEditingId(null);
    setErrors({});
    setExperienceCustom(false);
    setShowForm(true);
  }

  function handleOpenEdit(job) {
    const next = {
      title: job.title || "",
      office: job.office || "",
      description: job.description || "",
      requirements: job.requirements || "",
      salary_min: job.salary_min !== null && job.salary_min !== undefined ? job.salary_min : "",
      salary_max: job.salary_max !== null && job.salary_max !== undefined ? job.salary_max : "",
      employment_type: job.employment_type || "Full-time",
      work_arrangement: job.work_arrangement || "On-site",
      location: job.location || "",
      vacancies: job.vacancies || 1,
      deadline: job.deadline ? job.deadline.split("T")[0] : "",
      instructions: job.instructions || "",
      benefits: job.benefits ? job.benefits.split("\n").map((b) => b.trim()).filter(Boolean) : [],
      tags: job.tags || [],
    };
    setForm(next);
    setFormSnapshot(JSON.stringify(next));
    setEditingId(job.id);
    setErrors({});
    setExperienceCustom(false);
    setShowForm(true);
  }

  // X / Cancel: ask only when the form actually differs from what was opened.
  function requestCloseForm() {
    if (formDirty) { setConfirmDiscard(true); return; }
    closeForm();
  }

  function closeForm() {
    setShowForm(false);
    setConfirmDiscard(false);
    setFormSnapshot(null);
  }


  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = "Job title is required";
    if (!form.description.trim()) errs.description = "Job description is required";
    if (!form.location) errs.location = "Barangay location is required";

    const vac = Number(form.vacancies);
    if (!vac || vac < 1) errs.vacancies = "Must specify at least 1 vacancy";

    const sMin = form.salary_min !== "" ? Number(form.salary_min) : null;
    const sMax = form.salary_max !== "" ? Number(form.salary_max) : null;

    if (sMin !== null && sMin < 0) errs.salary_min = "Salary cannot be negative";
    if (sMax !== null && sMax < 0) errs.salary_max = "Salary cannot be negative";
    if (sMin !== null && sMax !== null && sMin > sMax) {
      errs.salary_max = "Maximum salary must be greater than or equal to minimum salary";
    }

    return errs;
  }

  async function handleSaveJob(targetStatus = "draft") {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    setActionError("");

    try {
      const payload = {
        title: form.title.trim(),
        office: form.office.trim() || null,
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        salary_min: form.salary_min !== "" ? Number(form.salary_min) : null,
        salary_max: form.salary_max !== "" ? Number(form.salary_max) : null,
        employment_type: form.employment_type,
        work_arrangement: form.work_arrangement,
        location: form.location,
        vacancies: Number(form.vacancies) || 1,
        deadline: form.deadline || null,
        instructions: form.instructions.trim() || null,
        benefits: form.benefits.length ? form.benefits.join("\n") : null,
        tags: form.tags,
      };

      // accredited employers publish directly; no PESO approval step
      if (targetStatus === "published") {
        payload.status = "published";
        payload.remarks = null;
      }

      if (editingId) {
        await updateJob(editingId, payload);
        setActionSuccess(
          targetStatus === "published"
            ? "Job is now live on the job board."
            : "Job post updated successfully."
        );
      } else {
        await createJob(company.id, {
          ...payload,
          status: targetStatus,
        });
        setActionSuccess(
          targetStatus === "published"
            ? "Job is now live on the job board."
            : "Job vacancy saved as draft."
        );
      }

      setShowForm(false);
      setEditingId(null);
      setFormSnapshot(null);
      await refreshJobs();
    } catch (err) {
      setActionError(err.message || "Failed to save job post");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleClose(job) {
    setActionError("");
    const nextStatus = job.status === "published" ? "closed" : "published";
    try {
      await changeJobStatus(job.id, nextStatus);
      setActionSuccess(
        nextStatus === "closed"
          ? `Listing for "${job.title}" is now closed.`
          : `Listing for "${job.title}" has been reopened and published.`
      );
      await refreshJobs();
      if (viewingJob?.id === job.id) {
        setViewingJob((prev) => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      setActionError(err.message || "Failed to update listing status");
    }
  }

  async function confirmArchiveJob() {
    if (!confirmArchiveId) return;
    setActionError("");
    try {
      await changeJobStatus(confirmArchiveId, "archived");
      setActionSuccess("Job post archived successfully.");
      await refreshJobs();
      if (viewingJob?.id === confirmArchiveId) {
        setViewingJob(null);
      }
    } catch (err) {
      setActionError(err.message || "Failed to archive job");
    } finally {
      setConfirmArchiveId(null);
    }
  }

  async function confirmDeleteJobPost() {
    const job = confirmDeleteJob;
    setConfirmDeleteJob(null);
    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setViewingJob((prev) => (prev && prev.id === job.id ? null : prev));
      setActionSuccess(`"${job.title}" was deleted.`);
    } catch (err) {
      setActionError(err.message || "Failed to delete job post");
    }
  }

  // Filtered & Sorted jobs
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchTitle = j.title?.toLowerCase().includes(q);
          const matchOffice = j.office?.toLowerCase().includes(q);
          const matchLocation = j.location?.toLowerCase().includes(q);
          const matchDesc = j.description?.toLowerCase().includes(q);
          return matchTitle || matchOffice || matchLocation || matchDesc;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        }
        if (sortBy === "title") {
          return (a.title || "").localeCompare(b.title || "");
        }
        if (sortBy === "applicants") {
          return (b.applicant_count || 0) - (a.applicant_count || 0);
        }
        if (sortBy === "deadline") {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        }
        return 0;
      });
  }, [jobs, searchTerm, sortBy]);

  const formatSalary = (min, max) => {
    if (!min && !max) return "Not disclosed";
    if (min && max) {
      return `₱${Number(min).toLocaleString()} - ₱${Number(max).toLocaleString()}`;
    }
    if (min) return `From ₱${Number(min).toLocaleString()}`;
    return `Up to ₱${Number(max).toLocaleString()}`;
  };

  // Counts come from the API (`counts` ignores status + paging); fall back to
  // the current page when an older API/response omits them.
  const sidebarTiles = [
    { id: null,        label: "Total",     value: statusCounts?.total ?? total, tone: "bg-blue-50 border-blue-300 text-blue-700", title: "Show all job postings" },
    { id: "published", label: "Published", value: statusCounts?.published ?? jobs.filter((j) => j.status === "published").length, tone: "bg-emerald-50 border-emerald-300 text-emerald-700", title: "Show published job postings" },
    { id: "closed",    label: "Closed",    value: statusCounts?.closed ?? jobs.filter((j) => j.status === "closed").length, tone: "bg-amber-50 border-amber-300 text-amber-700", title: "Show closed job postings" },
    { id: "draft",     label: "Draft",     value: statusCounts?.draft ?? jobs.filter((j) => j.status === "draft").length, tone: "bg-muted border-gray-300 text-muted-foreground", title: "Show draft job postings" },
  ];


  if (loading) return <LoadingScreen />;

  if (loadError) return <InlineError message={loadError} onRetry={loadData} />;

  return (
    <>
      {/* Action feedback notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess("")}
            className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError("")}
            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* No Company Warning Banner */}
      {!company && (
        <div className="p-5 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Building className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Company Profile Required</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                You must complete your company details before you can publish vacancies to the Santa Maria job board.
              </p>
            </div>
          </div>
          <Link
            to="/employer/company"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 transition-colors"
          >
            Set Up Company Profile →
          </Link>
        </div>
      )}

      <ApplicantsShell
        title="Job Vacancy Postings"
        subtitle="Publish municipal job openings and manage your vacancies"
        controlAction={
          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={!company}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Post a Job</span>
          </button>
        }
        sidebar={
          <>
            <div className="space-y-3">
              {sidebarTiles.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  data-tone={tile.id === "published" ? "success" : tile.id === "closed" ? "warning" : tile.id === "draft" ? "neutral" : "info"}
                  title={tile.title}
                  aria-pressed={statusFilter === tile.id}
                  onClick={() => { setStatusFilter((prev) => (prev === tile.id ? null : tile.id)); setPage(1); }}
                  className={`w-full text-left rounded-lg border px-4 py-3 cursor-pointer transition-all ${tile.tone} ${statusFilter === tile.id ? "ring-1 ring-offset-0 ring-current" : ""}`}
                >
                  <p className="text-2xl font-bold">{tile.value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">{tile.label}</p>
                </button>
              ))}
            </div>
          </>
        }
        footer={<Pager page={page} pageSize={pageSize} total={total} onChange={setPage} />}
        sort={sortBy}
        onSortChange={setSortBy}
        sortOptions={[
          { value: "newest", label: "Newest First" },
          { value: "oldest", label: "Oldest First" },
          { value: "title", label: "Title (A-Z)" },
          { value: "applicants", label: "Most Candidates" },
          { value: "deadline", label: "Deadline Soonest" },
        ]}
        sortLabel="Sort:"
        sortAriaLabel="Sort job postings"
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by job title, department, or barangay..."
        searchAriaLabel="Search job postings by title, department, or barangay"
      >

          {/* Listings grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredJobs.map((post) => (
            <div key={post.id} className="rounded-lg border border-primary bg-card p-4 shadow-xs">
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setViewingJob(post)}
                    className="text-left font-bold text-base text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {post.title}
                  </button>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Posted on {new Date(post.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(post)}
                    data-action-hover="info"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                    title="Edit Job"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingJob(post)}
                    data-action-hover="info"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                    title="View job details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteJob(post)}
                    data-action-hover="danger"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete posting permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {(post.status === "published" || post.status === "closed") && (
                    <button
                      type="button"
                      onClick={() => handleToggleClose(post)}
                      data-action-tone={post.status === "published" ? "warning" : "success"}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        post.status === "published"
                          ? "text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200"
                          : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                      }`}
                      title={post.status === "published" ? "Close recruitment" : "Reopen listing"}
                    >
                      {post.status === "published" ? "Close" : "Reopen"}
                    </button>
                  )}
                </div>
              </div>

              {/* Body label/value pairs */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs mt-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Department</p>
                  <p className="text-xs font-semibold text-foreground">{post.office}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Location</p>
                  <p className="text-xs font-semibold text-foreground">{`Brgy. ${post.location}, Santa Maria, Bulacan`}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Employment Type</p>
                  <p className="text-xs font-semibold text-foreground">{post.employment_type}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Salary</p>
                  <p className="text-xs font-semibold text-foreground">{formatSalary(post.salary_min, post.salary_max)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Vacancy</p>
                  <p className="text-xs font-semibold text-foreground">{post.vacancies}</p>
                </div>
              </div>

              {/* Bottom-right applicants link */}
              <div className="flex justify-end mt-4">
                <Link
                  to="/employer/applicants"
                  data-action-tone="info"
                  className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full bg-blue-50/70 border border-blue-200/80 text-primary hover:bg-blue-100 transition-colors"
                >
                  <Users className="w-3 h-3 text-primary" />
                  <span className="font-bold">{post.applicant_count || 0}</span>
                  <span>Applied</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No job listings found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchTerm
                ? "Try adjusting your search criteria to locate the postings you're looking for."
                : statusFilter
                  ? "No job postings with this status."
                  : accreditationStatus === "approved"
                    ? "You haven't posted any job vacancies yet. Click '+ Post a Job' to recruit Santa Maria talent."
                    : "To post job vacancies, your company must first be accredited by PESO."}
            </p>
            {searchTerm || statusFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter(null);
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline pt-2 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset filters</span>
              </button>
            ) : accreditationStatus !== "approved" ? (
              <Link
                to="/employer/accreditation"
                className="inline-block text-xs text-primary font-semibold hover:underline pt-2"
              >
                View accreditation →
              </Link>
            ) : null}
          </div>
        )}
      </ApplicantsShell>

      {/* ========================================================================= */}
      {/* Post / Edit Job Modal Form                                                */}
      {/* ========================================================================= */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            ref={formPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-title"
            className="w-full max-w-2xl bg-card border border-border rounded-3xl p-5 md:p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-mono text-[10px] tracking-widest text-primary uppercase font-bold">
                    {editingId ? "UPDATE VACANCY" : "NEW RECRUITMENT BULLETIN"}
                  </span>
                  <h2 id="job-form-title" className="text-xl font-bold text-foreground mt-0.5">
                    {editingId ? "Edit Job Vacancy" : "Post a Municipal Vacancy"}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={requestCloseForm}
                aria-label="Close form"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="mt-6 space-y-5">
              {/* Job Title */}
              <div>
                <label htmlFor="job-title" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Job Title <span aria-hidden="true" className="text-rose-500">*</span>
                </label>
                <input
                  id="job-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="e.g. Administrative Officer, Welder, Accountant..."
                  className={`w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.title ? "border-rose-300 ring-1 ring-rose-200" : "border-border focus:border-primary"
                  }`}
                />
                {errors.title && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.title}</p>}
              </div>

              {/* Department / Office & Employment Type */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="job-office" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Department / Office <span className="text-muted-foreground font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    id="job-office"
                    type="text"
                    value={form.office}
                    onChange={(e) => setForm({ ...form, office: e.target.value })}
                    placeholder="e.g. Main Plant, Warehouse 1, Accounting"
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="job-employment-type" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Employment Type <span aria-hidden="true" className="text-rose-500">*</span>
                  </label>
                  <select
                    id="job-employment-type"
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:bg-card focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contractual">Contractual</option>
                    <option value="Job Order">Job Order</option>
                    <option value="Seasonal">Seasonal</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="job-work-arrangement" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Work Arrangement <span aria-hidden="true" className="text-rose-500">*</span>
                  </label>
                  <select
                    id="job-work-arrangement"
                    value={form.work_arrangement}
                    onChange={(e) => setForm({ ...form, work_arrangement: e.target.value })}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:bg-card focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="On-site">On-site</option>
                    <option value="Remote / Work from home">Remote / Work from home</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              {/* Barangay Location & Vacancies */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label id="job-location-label" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Barangay Location <span aria-hidden="true" className="text-rose-500">*</span>
                  </label>
                  {/* ponytail: custom listbox only because native select direction is browser-controlled; revert to native if requirement lifts. */}
                  <div ref={barangayRef} className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={barangayOpen}
                      aria-labelledby="job-location-label job-location-value"
                      onClick={() => setBarangayOpen((v) => !v)}
                      className={`w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border text-foreground focus:outline-none focus:bg-card transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        errors.location
                          ? "border-rose-300 ring-1 ring-rose-200"
                          : "border-border focus:border-primary"
                      }`}
                    >
                      <span id="job-location-value" className={form.location ? "" : "text-muted-foreground"}>
                        {form.location || "Select barangay"}
                      </span>
                      <span aria-hidden="true" className="text-muted-foreground text-xs">▾</span>
                    </button>
                    {barangayOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl">
                        <input
                          type="text"
                          aria-label="Search barangay"
                          value={barangayQuery}
                          onChange={(e) => setBarangayQuery(e.target.value)}
                          autoFocus
                          placeholder="Search barangay..."
                          className="w-full px-4 py-2.5 text-sm bg-transparent border-b border-border text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        {filteredBarangays.length === 0 ? (
                          <p className="px-4 py-2.5 text-sm text-muted-foreground">No barangays match</p>
                        ) : (
                          <ul
                            role="listbox"
                            aria-label="Barangay location"
                            className="max-h-56 overflow-y-auto"
                          >
                            {filteredBarangays.map((b) => (
                              <li
                                key={b}
                                role="option"
                                aria-selected={form.location === b}
                                tabIndex={0}
                                onClick={() => {
                                  setForm({ ...form, location: b });
                                  if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                                  setBarangayOpen(false);
                                  setBarangayQuery("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setForm({ ...form, location: b });
                                    if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                                    setBarangayOpen(false);
                                    setBarangayQuery("");
                                  }
                                }}
                                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-muted focus:bg-muted focus:outline-none ${
                                  form.location === b ? "bg-muted font-semibold" : ""
                                }`}
                              >
                                {b}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.location && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.location}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="job-vacancies" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Number of Vacancies <span aria-hidden="true" className="text-rose-500">*</span>
                  </label>
                  <input
                    id="job-vacancies"
                    type="number"
                    min="1"
                    value={form.vacancies}
                    onChange={(e) => {
                      setForm({ ...form, vacancies: e.target.value });
                      if (errors.vacancies) setErrors((prev) => ({ ...prev, vacancies: undefined }));
                    }}
                    className={`w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border text-foreground focus:outline-none focus:bg-card transition-all ${
                      errors.vacancies
                        ? "border-rose-300 ring-1 ring-rose-200"
                        : "border-border focus:border-primary"
                    }`}
                  />
                  {errors.vacancies && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.vacancies}</p>
                  )}
                </div>
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="job-salary-min" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Minimum Salary (₱) <span className="text-muted-foreground font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                      ₱
                    </span>
                    <input
                      id="job-salary-min"
                      type="number"
                      min="0"
                      step="500"
                      value={form.salary_min}
                      onChange={(e) => {
                        setForm({ ...form, salary_min: e.target.value });
                        if (errors.salary_min || errors.salary_max) {
                          setErrors((prev) => ({ ...prev, salary_min: undefined, salary_max: undefined }));
                        }
                      }}
                      placeholder="e.g. 18000"
                      className="w-full min-h-[44px] pl-8 pr-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary transition-all"
                    />
                  </div>
                  {errors.salary_min && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.salary_min}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="job-salary-max" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                    Maximum Salary (₱) <span className="text-muted-foreground font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                      ₱
                    </span>
                    <input
                      id="job-salary-max"
                      type="number"
                      min="0"
                      step="500"
                      value={form.salary_max}
                      onChange={(e) => {
                        setForm({ ...form, salary_max: e.target.value });
                        if (errors.salary_max) setErrors((prev) => ({ ...prev, salary_max: undefined }));
                      }}
                      placeholder="e.g. 25000"
                      className="w-full min-h-[44px] pl-8 pr-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary transition-all"
                    />
                  </div>
                  {errors.salary_max && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.salary_max}</p>
                  )}
                </div>
              </div>

              {/* Application Deadline */}
              <div>
                <label htmlFor="job-deadline" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Application Deadline <span className="text-muted-foreground font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="job-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:bg-card focus:border-primary transition-all"
                />
              </div>

              {/* Job Description */}
              <div>
                <label htmlFor="job-description" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Job Description &amp; Responsibilities <span aria-hidden="true" className="text-rose-500">*</span>
                </label>
                <textarea
                  id="job-description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => {
                    setForm({ ...form, description: e.target.value });
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  placeholder="Outline key duties, scope of work, day-to-day responsibilities, and team role..."
                  className={`w-full p-4 rounded-xl text-sm bg-muted border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card transition-all ${
                    errors.description
                      ? "border-rose-300 ring-1 ring-rose-200"
                      : "border-border focus:border-primary"
                  }`}
                />
                {errors.description && (
                  <p className="text-rose-600 text-xs mt-1 font-medium">{errors.description}</p>
                )}
              </div>

              {/* Education Requirement */}
              <div>
                <label htmlFor="job-education-requirement" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Education Requirement <span className="text-muted-foreground font-normal lowercase">(optional)</span>
                </label>
                <select
                  id="job-education-requirement"
                  value={parseEducation(form.requirements)}
                  onChange={(e) => setForm({ ...form, requirements: applyEducation(form.requirements, e.target.value) })}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:bg-card focus:border-primary transition-all cursor-pointer"
                >
                  <option value="">Select education requirement</option>
                  {JOB_EDUCATION_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              {/* Work Experience Required */}
              <div>
                <label htmlFor="job-experience-required" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Work Experience Required <span className="text-muted-foreground font-normal lowercase">(years, optional)</span>
                </label>
                <select
                  id="job-experience-required"
                  value={experienceIsCustom ? "custom" : experienceYears}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") {
                      setExperienceCustom(true);
                      setForm({ ...form, requirements: applyExperience(form.requirements, "") });
                    } else {
                      setExperienceCustom(false);
                      setForm({ ...form, requirements: applyExperience(form.requirements, v) });
                    }
                  }}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground focus:outline-none focus:bg-card focus:border-primary transition-all cursor-pointer"
                >
                  <option value="">Select experience</option>
                  <option value="0">No experience required</option>
                  {JOB_EXPERIENCE_PRESETS.filter((n) => n !== 0).map((n) => (
                    <option key={n} value={n}>{n} year{n === 1 ? "" : "s"}</option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
                {experienceIsCustom && (
                  <input
                    id="job-experience-custom"
                    type="number"
                    min="0"
                    step="1"
                    value={experienceYears}
                    onChange={(e) => setForm({ ...form, requirements: applyExperience(form.requirements, e.target.value) })}
                    placeholder="Enter number of years"
                    aria-label="Number of years of experience required"
                    className="mt-2 w-full min-h-[44px] px-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary transition-all"
                  />
                )}
              </div>

              {/* Benefits & Perks */}
              <div role="group" aria-labelledby="job-benefits-label">
                <p id="job-benefits-label" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Benefits &amp; Perks <span className="text-muted-foreground font-normal lowercase">(optional, click to toggle)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* ponytail: custom benefit lines are preserved but only known chips are shown; render extras as chips if PESO starts using them. */}
                  {JOB_BENEFITS.map((benefit) => {
                    const selected = form.benefits.includes(benefit);
                    return (
                      <button
                        key={benefit}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            benefits: selected
                              ? f.benefits.filter((b) => b !== benefit)
                              : [...f.benefits, benefit],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {benefit}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Job Tags */}
              <div role="group" aria-labelledby="job-tags-label">
                <p id="job-tags-label" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Tags <span className="text-muted-foreground font-normal lowercase">(optional, click to toggle)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {JOB_TAGS.map((tag) => {
                    const selected = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            tags: selected ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Application Instructions */}
              <div>
                <label htmlFor="job-instructions" className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase font-semibold mb-1.5">
                  Application Instructions <span className="text-muted-foreground font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  id="job-instructions"
                  rows={2}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="e.g. Please bring an updated resume, 2x2 photo, and NBI clearance. Walk-ins accepted Mon-Fri 9AM-3PM..."
                  className="w-full p-4 rounded-xl text-sm bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-5 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={requestCloseForm}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveJob("draft")}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-muted-foreground bg-muted hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving..." : editingId ? "Save Changes as Draft" : "Save as Draft"}
              </button>

              <button
                type="button"
                onClick={() => handleSaveJob("published")}
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{saving ? "Publishing..." : "Publish Job"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* View Job Bulletin Details Modal                                           */}
      {/* ========================================================================= */}
      {viewingJob && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div
            ref={viewPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-view-title"
            className="w-full max-w-2xl bg-card border border-border rounded-3xl p-5 md:p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto space-y-6"
          >
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
              <div>
                <h2 id="job-view-title" className="text-2xl font-bold text-foreground">{viewingJob.title}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="uppercase">{company?.company_name || "My Company"}</span>
                  {viewingJob.office && <span>· Dept: {viewingJob.office}</span>}
                  <span>· Posted on {new Date(viewingJob.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                aria-label="Close job details"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Fact Grid */}
            <div className="grid grid-cols-1 gap-3 p-4 rounded-lg bg-muted border border-border/70">
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Employment</p>
                <p className="text-xs font-semibold text-foreground mt-1">{viewingJob.employment_type}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Work arrangement</p>
                <p className="text-xs font-semibold text-foreground mt-1">{viewingJob.work_arrangement || "On-site"}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Location</p>
                <p className="text-xs font-semibold text-foreground mt-1">Brgy. {viewingJob.location}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Vacancies</p>
                <p className="text-xs font-semibold text-foreground mt-1">{viewingJob.vacancies} open</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Salary</p>
                <p className="text-xs font-semibold text-foreground mt-1">
                  {formatSalary(viewingJob.salary_min, viewingJob.salary_max)}
                </p>
              </div>
            </div>

            {/* Tags */}
            {viewingJob.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewingJob.tags.map((tag) => (
                  <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25 text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Candidate Applications Summary */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50/50 border border-blue-100">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {viewingJob.applicant_count || 0} Candidates Applied
                  </p>
                  <p className="text-xs text-muted-foreground">Track and review resumes in your applicant pipeline</p>
                </div>
              </div>
              <Link
                to="/employer/applicants"
                className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors"
              >
                View Applicants →
              </Link>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-muted-foreground">
                Job Description
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-4 rounded-lg border border-border">
                {viewingJob.description}
              </p>
            </div>

            {/* Requirements */}
            {viewingJob.requirements && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-muted-foreground">
                  Qualifications & Requirements
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-4 rounded-lg border border-border">
                  {viewingJob.requirements}
                </p>
              </div>
            )}

            {/* Benefits */}
            {viewingJob.benefits && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-muted-foreground">
                  Benefits & Perks
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-4 rounded-lg border border-border">
                  {viewingJob.benefits}
                </p>
              </div>
            )}

            {/* Instructions */}
            {viewingJob.instructions && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-muted-foreground">
                  Application Instructions
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-4 rounded-lg border border-border">
                  {viewingJob.instructions}
                </p>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="pt-4 border-t border-border flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const toEdit = viewingJob;
                  setViewingJob(null);
                  handleOpenEdit(toEdit);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Edit Listing
              </button>

              {(viewingJob.status === "published" || viewingJob.status === "closed") && (
                <button
                  type="button"
                  onClick={() => handleToggleClose(viewingJob)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  {viewingJob.status === "published" ? "Close Job" : "Reopen Job"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted text-muted-foreground hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Archiving */}
      {confirmArchiveId && (
        <ConfirmationModal
          message="Are you sure you want to archive this job vacancy? It will be deactivated and removed from public listings."
          onConfirm={confirmArchiveJob}
          onCancel={() => setConfirmArchiveId(null)}
          confirmLabel="Archive Listing"
          danger
        />
      )}

      {/* Confirmation Modal for Deleting */}
      {confirmDeleteJob && (
        <ConfirmationModal
          message={
            confirmDeleteJob.applicant_count > 0
              ? `This permanently deletes "${confirmDeleteJob.title}" and its ${confirmDeleteJob.applicant_count} application(s). This cannot be undone.`
              : `This permanently deletes "${confirmDeleteJob.title}". This cannot be undone.`
          }
          onConfirm={confirmDeleteJobPost}
          onCancel={() => setConfirmDeleteJob(null)}
          confirmLabel="Delete"
          danger
        />
      )}

      {/* Confirmation Modal for discarding unsaved job-post changes */}
      {confirmDiscard && (
        <ConfirmationModal
          message="You have unsaved changes to this job post. Discard them and close the form?"
          onConfirm={closeForm}
          onCancel={() => setConfirmDiscard(false)}
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          danger
        />
      )}
    </>
  );
}
