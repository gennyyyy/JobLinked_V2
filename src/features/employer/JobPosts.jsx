import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Plus,
  Edit3,
  Eye,
  Send,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building,
  X,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { JOB_TAGS, JOB_BENEFITS, JOB_EDUCATION_LEVELS, JOB_EXPERIENCE_PRESETS, SANTA_MARIA_BARANGAYS } from "../../shared/constants";
import { listEmployerJobs, createJob, updateJob, changeJobStatus, deleteJob } from "../../shared/services/jobs";
import { getEmployer } from "../../shared/services/auth";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import { PageSkeleton } from '../../shared/components/Skeletons';
import { Pager } from "../../shared/components/dashboard";import useDialog from "../../shared/hooks/useDialog";
import { InlineError } from "../../shared/components/dashboard";
import { EmptyState, Notice, PageHeading, Panel, SearchInput, StatusBadge, TextField, SelectField } from "../../shared/components/design";

const POSTING_LABELS = {
  draft: 'Draft',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
}
const POSTING_STATUSES = Object.entries(POSTING_LABELS).map(([value, label]) => ({ value, label }))
const ACCREDITATION_LABELS = {
  none: 'Pending Review',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  resubmission: 'Resubmission Requested',
  revoked: 'Revoked',
}
const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

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

const EXPERIENCE_OPTIONS = [
  { value: "0", label: "No experience required" },
  ...JOB_EXPERIENCE_PRESETS.filter((n) => n !== 0).map((n) => ({ value: String(n), label: `${n} year${n === 1 ? "" : "s"}` })),
  { value: "custom", label: "Custom…" },
];

function formatSalary(min, max) {
  if (!min && !max) return "Not disclosed";
  if (min && max) {
    return `₱${Number(min).toLocaleString()} - ₱${Number(max).toLocaleString()}`;
  }
  if (min) return `From ₱${Number(min).toLocaleString()}`;
  return `Up to ₱${Number(max).toLocaleString()}`;
}

// Section label/value pair inside the read-only detail dialog.
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-medium text-navy">{children}</p>
    </div>
  );
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
  const [sortBy] = useState("newest");

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

  if (loading) return <PageSkeleton stats={0} panels={2} />;

  if (loadError) return <InlineError message={loadError} onRetry={loadData} />;

  return (
    <>
      {/* Action feedback notifications */}
      {actionSuccess && (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs font-medium text-success">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{actionSuccess}</span>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setActionSuccess("")} aria-label="Dismiss" className="text-success hover:bg-success-soft">
            <X />
          </Button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs font-medium text-destructive">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{actionError}</span>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setActionError("")} aria-label="Dismiss" className="text-destructive hover:bg-danger-soft">
            <X />
          </Button>
        </div>
      )}

      {/* No Company Warning Banner */}
      {!company && (
        <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-warning/20 bg-warning-soft p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Building className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-warning">Company Profile Required</h2>
              <p className="mt-1 text-xs leading-6 text-warning/80">
                You must complete your company details before you can publish vacancies to the Santa Maria job board.
              </p>
            </div>
          </div>
          <Link
            to="/employer/company"
            className="shrink-0 rounded-lg bg-warning px-4 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-warning/90"
          >
            Set Up Company Profile →
          </Link>
        </div>
      )}

      <PageHeading
        eyebrow="Create local opportunities"
        title="Good work starts with a great team."
        description="Manage your vacancies, prepare drafts, and keep your recruitment up to date."
        action={(
          <Button type="button" onClick={handleOpenCreate} disabled={!company}>
            <Plus data-icon="inline-start" />
            Create a vacancy
          </Button>
        )}
      />
      {accreditationStatus !== "approved" && (
        <Notice title={`Accreditation: ${ACCREDITATION_LABELS[accreditationStatus] || accreditationStatus || 'pending'}`} warning>
          You can prepare drafts, but publishing is unavailable until PESO approves your accreditation.{" "}
          <Link to="/employer/accreditation" className="font-medium underline underline-offset-4">Review requirements and feedback.</Link>
        </Notice>
      )}
      <Panel
        title="Your job postings"
        description="Only vacancies owned by your current company are shown."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={searchTerm}
            onChange={(value) => { setSearchTerm(value); setPage(1) }}
            label="Search job postings"
            placeholder="Search your job postings…"
          />
          <div className="sm:w-48">
            <SelectField
              id="posting-status"
              label="Posting status"
              placeholder="All statuses"
              options={POSTING_STATUSES}
              value={statusFilter || ""}
              onChange={(event) => { setStatusFilter(event.target.value || null); setPage(1) }}
            />
          </div>
        </div>
        {filteredJobs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vacancy</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <button type="button" onClick={() => setViewingJob(post)} className="text-left font-medium text-navy hover:text-primary">
                      {post.title}
                    </button>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {post.location || 'Santa Maria'} · {post.employment_type || 'Full-time'} · {post.vacancies || 1} openings
                    </p>
                    {post.remarks && (
                      <p className="mt-2 max-w-xs text-[11px] leading-5 text-destructive">PESO feedback: {post.remarks}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link to="/employer/applicants" className="text-link text-xs">
                      <Users className="size-3.5" />
                      {post.applicant_count || 0} applicants
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(post.deadline)}</TableCell>
                  <TableCell><StatusBadge status={POSTING_LABELS[post.status] || post.status} /></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => handleOpenEdit(post)} aria-label={`Edit ${post.title}`}>
                        <Edit3 data-icon="inline-start" />
                        Edit
                      </Button>
                      {post.status === 'published' ? (
                        <Button variant="ghost" onClick={() => handleToggleClose(post)}>Close</Button>
                      ) : (
                        <Button
                          variant="ghost"
                          disabled={saving || accreditationStatus !== 'approved'}
                          onClick={() => handleToggleClose(post)}
                        >
                          {post.status === 'closed' ? 'Reopen' : 'Publish'}
                        </Button>
                      )}
                      {post.status === 'published' && (
                        <Link to={`/jobs/${post.id}`} aria-label={`View ${post.title}`} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-primary">
                          <Eye />
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Your next opening starts here."
            description="No vacancies match this view. Clear the filters or create a new job posting."
            action={<Button type="button" onClick={handleOpenCreate} disabled={!company}>Create a vacancy</Button>}
          />
        )}
        <Pager page={page} pageSize={pageSize} total={total} onChange={setPage} />
      </Panel>

      {/* ========================================================================= */}
      {/* Post / Edit Job Modal Form                                                */}
      {/* ========================================================================= */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div
            ref={formPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-title"
            className="my-8 max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl md:p-6"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="soft-icon">
                  <Briefcase />
                </span>
                <div>
                  <p className="eyebrow">{editingId ? "Update vacancy" : "New recruitment bulletin"}</p>
                  <h2 id="job-form-title" className="mt-1 text-xl font-semibold tracking-[-.02em] text-navy">
                    {editingId ? "Edit Job Vacancy" : "Post a Municipal Vacancy"}
                  </h2>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={requestCloseForm} aria-label="Close form">
                <X />
              </Button>
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              <TextField
                id="job-title"
                label={<>Job Title <span aria-hidden="true" className="text-destructive">*</span></>}
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                placeholder="e.g. Administrative Officer, Welder, Accountant..."
                error={errors.title}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id="job-office"
                  label={<>Department / Office <span className="font-normal text-muted-foreground">(optional)</span></>}
                  value={form.office}
                  onChange={(e) => setForm({ ...form, office: e.target.value })}
                  placeholder="e.g. Main Plant, Warehouse 1, Accounting"
                />
                <SelectField
                  id="job-employment-type"
                  label={<>Employment Type <span aria-hidden="true" className="text-destructive">*</span></>}
                  value={form.employment_type}
                  onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                  options={["Full-time", "Part-time", "Contractual", "Job Order", "Seasonal", "Internship"]}
                />
                <SelectField
                  id="job-work-arrangement"
                  label={<>Work Arrangement <span aria-hidden="true" className="text-destructive">*</span></>}
                  value={form.work_arrangement}
                  onChange={(e) => setForm({ ...form, work_arrangement: e.target.value })}
                  options={["On-site", "Remote / Work from home", "Hybrid"]}
                />
                <TextField
                  id="job-vacancies"
                  type="number"
                  min="1"
                  label={<>Number of Vacancies <span aria-hidden="true" className="text-destructive">*</span></>}
                  value={form.vacancies}
                  onChange={(e) => {
                    setForm({ ...form, vacancies: e.target.value });
                    if (errors.vacancies) setErrors((prev) => ({ ...prev, vacancies: undefined }));
                  }}
                  error={errors.vacancies}
                />
              </div>

              {/* Barangay Location */}
              <div>
                <Label id="job-location-label" className="text-sm font-medium">
                  Barangay Location <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                {/* ponytail: custom listbox only because native select direction is browser-controlled; revert to native if requirement lifts. */}
                <div ref={barangayRef} className="relative mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    aria-haspopup="listbox"
                    aria-expanded={barangayOpen}
                    aria-labelledby="job-location-label job-location-value"
                    aria-invalid={Boolean(errors.location)}
                    onClick={() => setBarangayOpen((v) => !v)}
                    className="w-full justify-between font-normal"
                  >
                    <span id="job-location-value" className={form.location ? "" : "text-muted-foreground"}>
                      {form.location || "Select barangay"}
                    </span>
                    <span aria-hidden="true" className="text-xs text-muted-foreground">▾</span>
                  </Button>
                  {barangayOpen && (
                    <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-xl border bg-card shadow-xl">
                      <Input
                        type="text"
                        aria-label="Search barangay"
                        value={barangayQuery}
                        onChange={(e) => setBarangayQuery(e.target.value)}
                        autoFocus
                        placeholder="Search barangay..."
                        className="rounded-b-none border-0 border-b"
                      />
                      {filteredBarangays.length === 0 ? (
                        <p className="px-4 py-2.5 text-xs text-muted-foreground">No barangays match</p>
                      ) : (
                        <ul role="listbox" aria-label="Barangay location" className="max-h-56 overflow-y-auto">
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
                              className={`cursor-pointer px-4 py-2.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none ${
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
                {errors.location && <p role="alert" className="mt-1 text-xs text-destructive">{errors.location}</p>}
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  id="job-salary-min"
                  type="number"
                  min="0"
                  step="500"
                  label={<>Minimum Salary (₱) <span className="font-normal text-muted-foreground">(optional)</span></>}
                  value={form.salary_min}
                  onChange={(e) => {
                    setForm({ ...form, salary_min: e.target.value });
                    if (errors.salary_min || errors.salary_max) {
                      setErrors((prev) => ({ ...prev, salary_min: undefined, salary_max: undefined }));
                    }
                  }}
                  placeholder="e.g. 18000"
                  error={errors.salary_min}
                />
                <TextField
                  id="job-salary-max"
                  type="number"
                  min="0"
                  step="500"
                  label={<>Maximum Salary (₱) <span className="font-normal text-muted-foreground">(optional)</span></>}
                  value={form.salary_max}
                  onChange={(e) => {
                    setForm({ ...form, salary_max: e.target.value });
                    if (errors.salary_max) setErrors((prev) => ({ ...prev, salary_max: undefined }));
                  }}
                  placeholder="e.g. 25000"
                  error={errors.salary_max}
                />
              </div>

              <TextField
                id="job-deadline"
                type="date"
                label={<>Application Deadline <span className="font-normal text-muted-foreground">(optional)</span></>}
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />

              <TextField
                id="job-description"
                multiline
                rows={4}
                label={<>Job Description &amp; Responsibilities <span aria-hidden="true" className="text-destructive">*</span></>}
                value={form.description}
                onChange={(e) => {
                  setForm({ ...form, description: e.target.value });
                  if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder="Outline key duties, scope of work, day-to-day responsibilities, and team role..."
                error={errors.description}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  id="job-education-requirement"
                  label={<>Education Requirement <span className="font-normal text-muted-foreground">(optional)</span></>}
                  placeholder="Select education requirement"
                  value={parseEducation(form.requirements)}
                  onChange={(e) => setForm({ ...form, requirements: applyEducation(form.requirements, e.target.value) })}
                  options={JOB_EDUCATION_LEVELS}
                />

                <div>
                  <SelectField
                    id="job-experience-required"
                    label={<>Work Experience Required <span className="font-normal text-muted-foreground">(years, optional)</span></>}
                    placeholder="Select experience"
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
                    options={EXPERIENCE_OPTIONS}
                  />
                  {experienceIsCustom && (
                    <div className="mt-3">
                      <TextField
                        id="job-experience-custom"
                        type="number"
                        min="0"
                        step="1"
                        label="Number of years of experience required"
                        value={experienceYears}
                        onChange={(e) => setForm({ ...form, requirements: applyExperience(form.requirements, e.target.value) })}
                        placeholder="Enter number of years"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Benefits & Perks */}
              <div role="group" aria-labelledby="job-benefits-label">
                <p id="job-benefits-label" className="mb-2 text-sm font-medium">
                  Benefits &amp; Perks <span className="font-normal text-muted-foreground">(optional, click to toggle)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* ponytail: custom benefit lines are preserved but only known chips are shown; render extras as chips if PESO starts using them. */}
                  {JOB_BENEFITS.map((benefit) => {
                    const selected = form.benefits.includes(benefit);
                    return (
                      <Button
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
                        className={`px-3 py-1.5 text-xs font-medium ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {benefit}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Job Tags */}
              <div role="group" aria-labelledby="job-tags-label">
                <p id="job-tags-label" className="mb-2 text-sm font-medium">
                  Tags <span className="font-normal text-muted-foreground">(optional, click to toggle)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {JOB_TAGS.map((tag) => {
                    const selected = form.tags.includes(tag);
                    return (
                      <Button
                        key={tag}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            tags: selected ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
                          }))
                        }
                        className={`px-3 py-1.5 text-xs font-medium ${
                          selected
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {tag}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <TextField
                id="job-instructions"
                multiline
                rows={2}
                label={<>Application Instructions <span className="font-normal text-muted-foreground">(optional)</span></>}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="e.g. Please bring an updated resume, 2x2 photo, and NBI clearance. Walk-ins accepted Mon-Fri 9AM-3PM..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col items-center justify-end gap-3 border-t pt-4 sm:flex-row">
              <Button type="button" variant="outline" onClick={requestCloseForm} disabled={saving} className="w-full text-xs sm:w-auto">
                Cancel
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSaveJob("draft")}
                disabled={saving}
                className="w-full text-xs sm:w-auto"
              >
                {saving ? "Saving..." : editingId ? "Save Changes as Draft" : "Save as Draft"}
              </Button>

              <Button
                type="button"
                onClick={() => handleSaveJob("published")}
                disabled={saving}
                className="w-full gap-1.5 text-xs sm:w-auto"
              >
                <Send className="size-3.5" />
                <span>{saving ? "Publishing..." : "Publish Job"}</span>
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* View Job Bulletin Details Modal                                           */}
      {/* ========================================================================= */}
      {viewingJob && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
          <div
            ref={viewPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-view-title"
            className="my-8 max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl md:p-6"
          >
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between gap-3 border-b pb-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <StatusBadge status={viewingJob.status === "published" ? "Published" : viewingJob.status === "closed" ? "Closed" : "Draft"} />
                  {viewingJob.office && <span className="truncate text-[10px] text-muted-foreground">Dept: {viewingJob.office}</span>}
                </div>
                <h2 id="job-view-title" className="text-xl font-semibold tracking-[-.02em] text-navy">{viewingJob.title}</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {company?.company_name || "My Company"} · Posted on {new Date(viewingJob.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setViewingJob(null)} aria-label="Close job details">
                <X />
              </Button>
            </div>

            {/* Quick Fact Grid */}
            <div className="grid grid-cols-1 gap-4 rounded-xl border bg-muted p-4 sm:grid-cols-2">
              <Fact label="Employment">{viewingJob.employment_type}</Fact>
              <Fact label="Work arrangement">{viewingJob.work_arrangement || "On-site"}</Fact>
              <Fact label="Location">Brgy. {viewingJob.location}</Fact>
              <Fact label="Vacancies">{viewingJob.vacancies} open</Fact>
              <Fact label="Salary">{formatSalary(viewingJob.salary_min, viewingJob.salary_max)}</Fact>
            </div>

            {/* Tags */}
            {viewingJob.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewingJob.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-soft px-2 py-0.5 text-[10px] font-medium text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Candidate Applications Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/10 bg-blue-soft p-4">
              <div className="flex items-center gap-3">
                <Users className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-navy">{viewingJob.applicant_count || 0} Candidates Applied</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Track and review resumes in your applicant pipeline</p>
                </div>
              </div>
              <Link to="/employer/applicants" className="text-link text-xs">
                View Applicants →
              </Link>
            </div>

            {[
              ["Job Description", viewingJob.description],
              ["Qualifications & Requirements", viewingJob.requirements],
              ["Benefits & Perks", viewingJob.benefits],
              ["Application Instructions", viewingJob.instructions],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <h3 className="mb-2 text-xs font-semibold text-navy">{label}</h3>
                  <p className="rounded-xl border bg-muted p-4 text-xs leading-6 whitespace-pre-line text-muted-foreground">
                    {value}
                  </p>
                </div>
              ))}

            {/* Modal Bottom Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const toEdit = viewingJob;
                  setViewingJob(null);
                  handleOpenEdit(toEdit);
                }}
                className="text-xs"
              >
                Edit Listing
              </Button>

              {(viewingJob.status === "published" || viewingJob.status === "closed") && (
                <Button type="button" variant="outline" onClick={() => handleToggleClose(viewingJob)} className="text-xs">
                  {viewingJob.status === "published" ? "Close Job" : "Reopen Job"}
                </Button>
              )}

              <Button type="button" variant="ghost" onClick={() => setConfirmDeleteJob(viewingJob)} className="text-xs text-destructive hover:bg-danger-soft">
                Delete posting
              </Button>

              <Button type="button" variant="secondary" onClick={() => setViewingJob(null)} className="text-xs">
                Done
              </Button>
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
