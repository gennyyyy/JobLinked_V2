import { Button } from "../../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Edit3,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building,
  X,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { listEmployerJobs, createJob, updateJob, changeJobStatus, deleteJob } from "../../shared/services/jobs";
import { getEmployer } from "../../shared/services/auth";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import { PageSkeleton } from '../../shared/components/Skeletons';
import { Pager } from "../../shared/components/dashboard";
import { InlineError } from "../../shared/components/dashboard";
import { EmptyState, Notice, PageHeading, Panel, SearchInput, StatusBadge, SelectField } from "../../shared/components/design";
import { POSTING_LABELS, POSTING_STATUSES, ACCREDITATION_LABELS, formatDate, initialForm } from "./jobPostFields";
import JobPostFormDialog from "./JobPostFormDialog";
import JobPostDetailDialog from "./JobPostDetailDialog";

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

  // View job detail modal
  const [viewingJob, setViewingJob] = useState(null);

  // Confirm archive modal
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);

  // Confirm delete modal (holds the whole post so the dialog can read applicant_count and title)
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy] = useState("newest");

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

      {showForm && (
        <JobPostFormDialog
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          saving={saving}
          editingId={editingId}
          confirmDiscard={confirmDiscard}
          onRequestClose={requestCloseForm}
          onSave={handleSaveJob}
        />
      )}

      {/* ========================================================================= */}
      {/* View Job Bulletin Details Modal                                           */}
      {/* ========================================================================= */}
      {viewingJob && (
        <JobPostDetailDialog
          job={viewingJob}
          company={company}
          onClose={() => setViewingJob(null)}
          onEdit={handleOpenEdit}
          onToggleClose={handleToggleClose}
          onDelete={setConfirmDeleteJob}
        />
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
