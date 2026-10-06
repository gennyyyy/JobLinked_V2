import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Edit3,
  Copy,
  Send,
  Globe,
  Archive,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  Users,
  Building,
  Info,
  X,
  RotateCcw,
} from "lucide-react";
import useAuth from "../../shared/hooks/useAuth";
import { JOB_TAGS } from "../../shared/constants";
import { listEmployerJobs, createJob, updateJob, changeJobStatus, duplicateJob } from "../../shared/services/jobs";
import { getEmployer } from "../../shared/services/auth";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";

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
  benefits: "",
  tags: [],
};

export default function JobPosts() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [company, setCompany] = useState(null);
  const [accreditationStatus, setAccreditationStatus] = useState("none");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Feedback notifications
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // View job detail modal
  const [viewingJob, setViewingJob] = useState(null);

  // Confirm archive modal
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [today] = useState(() => Date.now());

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
          return;
        }
        const jobList = await listEmployerJobs(companyData.id);
        setJobs(jobList);
      } else {
        setAccreditationStatus("none");
        setJobs([]);
      }
    } catch (err) {
      setLoadError(err.message || "Failed to load job listings");
    } finally {
      setLoading(false);
    }
  }, []);

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
      const jobList = await listEmployerJobs(company.id);
      setJobs(jobList);
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
    setEditingId(null);
    setErrors({});
    setShowForm(true);
  }

  function handleOpenEdit(job) {
    setForm({
      title: job.title || "",
      office: job.office || "",
      description: job.description || "",
      requirements: job.requirements || "",
      salary_min: job.salary_min !== null && job.salary_min !== undefined ? job.salary_min : "",
      salary_max: job.salary_max !== null && job.salary_max !== undefined ? job.salary_max : "",
      employment_type: job.employment_type || "Full-time",
      location: job.location || "",
      vacancies: job.vacancies || 1,
      deadline: job.deadline ? job.deadline.split("T")[0] : "",
      instructions: job.instructions || "",
      benefits: job.benefits || "",
      tags: job.tags || [],
    });
    setEditingId(job.id);
    setErrors({});
    setShowForm(true);
  }

  async function handleOpenDuplicate(job) {
    setActionError("");
    try {
      await duplicateJob(job.id);
      setActionSuccess(`"${job.title}" duplicated as draft.`);
      await refreshJobs();
    } catch (err) {
      setActionError(err.message || "Failed to duplicate job");
    }
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
        location: form.location,
        vacancies: Number(form.vacancies) || 1,
        deadline: form.deadline || null,
        instructions: form.instructions.trim() || null,
        benefits: form.benefits.trim() || null,
        tags: form.tags,
      };

      // accredited employers publish directly; no PESO approval step
      if (targetStatus === "published") {
        payload.status = "published";
        payload.remarks = null;
        payload.published_at = new Date().toISOString();
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
      await refreshJobs();
    } catch (err) {
      setActionError(err.message || "Failed to save job post");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishJob(job) {
    setActionError("");
    try {
      await changeJobStatus(job.id, "published", null);
      setActionSuccess(`"${job.title}" is now live on the job board.`);
      await refreshJobs();
      if (viewingJob?.id === job.id) {
        setViewingJob((prev) => ({ ...prev, status: "published", remarks: null }));
      }
    } catch (err) {
      setActionError(err.message || "Failed to publish job");
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

  // Statistics
  const stats = useMemo(() => {
    const total = jobs.length;
    const published = jobs.filter((j) => j.status === "published").length;
    const draft = jobs.filter((j) => j.status === "draft").length;
    const rejected = jobs.filter((j) => j.status === "rejected").length;
    const closed = jobs.filter((j) => j.status === "closed").length;
    const archived = jobs.filter((j) => j.status === "archived").length;
    return { total, published, draft, rejected, closed, archived };
  }, [jobs]);

  // Filtered & Sorted jobs
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        if (statusFilter !== "all" && j.status !== statusFilter) {
          return false;
        }
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
  }, [jobs, statusFilter, searchTerm, sortBy]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "published":
        return {
          label: "Active / Published",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle2,
        };
      case "pending":
        return {
          label: "Pending PESO Review",
          className: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Clock,
        };
      case "approved":
        return {
          label: "Approved by PESO",
          className: "bg-blue-50 text-blue-700 border-blue-200",
          icon: CheckCircle2,
        };
      case "rejected":
        return {
          label: "Needs Revision",
          className: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertTriangle,
        };
      case "closed":
        return {
          label: "Closed",
          className: "bg-gray-100 text-gray-600 border-gray-200",
          icon: XCircle,
        };
      case "archived":
        return {
          label: "Archived",
          className: "bg-zinc-100 text-zinc-500 border-zinc-200",
          icon: Archive,
        };
      case "draft":
      default:
        return {
          label: "Draft",
          className: "bg-slate-100 text-slate-700 border-slate-200",
          icon: Edit3,
        };
    }
  };

  const formatSalary = (min, max) => {
    if (!min && !max) return "Not disclosed";
    if (min && max) {
      return `₱${Number(min).toLocaleString()} - ₱${Number(max).toLocaleString()}`;
    }
    if (min) return `From ₱${Number(min).toLocaleString()}`;
    return `Up to ₱${Number(max).toLocaleString()}`;
  };

  const isDeadlinePassed = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline).setHours(23, 59, 59, 999) < today;
  };

  if (loading) return <LoadingScreen />;

  if (loadError) {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-gray-900 font-semibold">{loadError}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              RECRUITMENT BULLETINS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-gray-500 font-medium">Santa Maria PESO</span>
          </div>
          <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
            Job Vacancy Postings
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Publish municipal job openings and manage your vacancies
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={!company}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,87,184,0.2)] disabled:opacity-50 disabled:cursor-not-allowed self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Post a Vacancy</span>
        </button>
      </header>

      {/* Action feedback notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs animate-fade-in">
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
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-xs animate-fade-in">
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
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
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

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-white border-primary shadow-sm ring-1 ring-primary/20"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Total Posts</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("published")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "published"
              ? "bg-emerald-50/50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-emerald-700">{stats.published}</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Active / Live</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "draft"
              ? "bg-slate-50 border-slate-500 shadow-sm ring-1 ring-slate-500/20"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-bold text-slate-700">{stats.draft}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Drafts</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("archived")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "archived"
              ? "bg-zinc-50/50 border-zinc-500 shadow-sm ring-1 ring-zinc-500/20"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-zinc-700">{stats.archived}</p>
            {stats.archived > 0 && <Archive className="w-4 h-4 text-zinc-600" />}
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Archived</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("closed")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === "closed"
              ? "bg-gray-100 border-gray-400 shadow-sm ring-1 ring-gray-400/20"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">Closed</p>
        </button>
      </div>

      {/* Main Container: Search, Filter Tabs & Listings Table */}
      <div className="bg-white border-2 border-primary rounded-2xl p-5 md:p-6 shadow-xs space-y-5">
        {/* Controls: Search, Status Tabs & Sorting */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by job title, department, or barangay..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status and Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-700 font-medium focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Statuses ({jobs.length})</option>
                <option value="published">Active / Published ({stats.published})</option>
                <option value="draft">Drafts ({stats.draft})</option>
                <option value="rejected">Needs Revision ({stats.rejected})</option>
                <option value="closed">Closed ({stats.closed})</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-700 font-medium focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title (A-Z)</option>
                <option value="applicants">Most Candidates</option>
                <option value="deadline">Deadline Soonest</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-wider text-gray-500 uppercase bg-gray-50/70">
                <th className="text-left py-3 px-4 font-semibold rounded-l-xl">Job Bulletin</th>
                <th className="text-left py-3 px-4 font-semibold">Location</th>
                <th className="text-left py-3 px-4 font-semibold">Vacancies & Salary</th>
                <th className="text-left py-3 px-4 font-semibold">Deadline</th>
                <th className="text-left py-3 px-4 font-semibold">Candidates</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
                <th className="text-right py-3 px-4 font-semibold rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.map((post) => {
                const badge = getStatusBadge(post.status);
                const BadgeIcon = badge.icon;
                const expired = isDeadlinePassed(post.deadline);

                return (
                  <tr key={post.id} className="hover:bg-gray-50/80 transition-colors group cursor-pointer" onClick={() => setViewingJob(post)}>
                    {/* Job Title & Office */}
                    <td className="py-4 px-4">
                      <div>
                        <div className="flex items-center gap-2">
<button
                             type="button"
                             className="text-left font-semibold text-gray-900 hover:text-primary transition-colors text-sm line-clamp-1"
                           >
                             {post.title}
                           </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {post.office && (
                            <span className="text-[11px] text-gray-500 font-medium">
                              Dept: {post.office}
                            </span>
                          )}
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                            {post.employment_type}
                          </span>
                        </div>

                        {/* PESO Rejection Remarks Banner inside row */}
                        {post.status === "rejected" && post.remarks && (
                          <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-bold">PESO Feedback:</span> {post.remarks}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Brgy. {post.location}</span>
                      </div>
                    </td>

                    {/* Vacancies & Salary */}
                    <td className="py-4 px-4">
                      <div className="text-xs">
                        <span className="font-semibold text-gray-900">{post.vacancies}</span>
                        <span className="text-gray-500"> {post.vacancies === 1 ? "vacancy" : "vacancies"}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {formatSalary(post.salary_min, post.salary_max)}
                      </p>
                    </td>

                    {/* Deadline */}
                    <td className="py-4 px-4">
                      {post.deadline ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className={expired ? "text-rose-600 font-semibold" : "text-gray-600"}>
                            {new Date(post.deadline).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {expired && (
                            <span className="font-mono text-[9px] px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-700 font-bold uppercase">
                              Passed
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No deadline</span>
                      )}
                    </td>

                    {/* Candidates applied */}
                    <td className="py-4 px-4">
                      <Link
                        to="/employer/applicants"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-full bg-blue-50/70 border border-blue-200/80 text-primary hover:bg-blue-100 transition-colors"
                        title="Click to view applicants"
                      >
                        <Users className="w-3 h-3 text-primary" />
                        <span className="font-bold">{post.applicant_count || 0}</span>
                        <span className="text-gray-500">applied</span>
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border font-semibold ${badge.className}`}
                      >
                        <BadgeIcon className="w-3 h-3 shrink-0" />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Job */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(post); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Edit Job"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Duplicate Job */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenDuplicate(post); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Duplicate as new draft"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Publish (accredited employers publish directly) */}
                        {(post.status === "draft" || post.status === "rejected" || post.status === "pending" || post.status === "approved") && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePublishJob(post); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-all cursor-pointer"
                            title="Publish listing"
                          >
                            <Globe className="w-3 h-3" />
                            <span>Publish</span>
                          </button>
                        )}

                        {/* Archive */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmArchiveId(post.id); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Archive Listing"
                        >
                          <Archive className="w-4 h-4" />
                        </button>

                        {/* Close / Reopen */}
                        {(post.status === "published" || post.status === "closed") && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleClose(post); }}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredJobs.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">No job listings found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search criteria or filter to locate the postings you're looking for."
                  : "You haven't posted any job vacancies yet. Click '+ Post a Vacancy' to recruit Santa Maria talent."}
              </p>
              {(searchTerm || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline pt-2 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset filters</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Post / Edit Job Modal Form                                                */}
      {/* ========================================================================= */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-mono text-[10px] tracking-widest text-primary uppercase font-bold">
                    {editingId ? "UPDATE VACANCY" : "NEW RECRUITMENT BULLETIN"}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 mt-0.5">
                    {editingId ? "Edit Job Vacancy" : "Post a Municipal Vacancy"}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="mt-6 space-y-5">
              {/* Job Title */}
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="e.g. Administrative Officer, Welder, Accountant..."
                  className={`w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.title ? "border-rose-300 ring-1 ring-rose-200" : "border-gray-200 focus:border-primary"
                  }`}
                />
                {errors.title && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.title}</p>}
              </div>

              {/* Department / Office & Employment Type */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                    Department / Office <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.office}
                    onChange={(e) => setForm({ ...form, office: e.target.value })}
                    placeholder="e.g. Main Plant, Warehouse 1, Accounting"
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                    Employment Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:bg-white focus:border-primary transition-all cursor-pointer"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contractual">Contractual</option>
                    <option value="Job Order">Job Order</option>
                    <option value="Seasonal">Seasonal</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              {/* Barangay Location & Vacancies */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                    Barangay Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.location}
                    placeholder="e.g. Pulong Buhangin"
                    onChange={(e) => {
                      setForm({ ...form, location: e.target.value });
                      if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                    }}
                    className={`w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border text-gray-900 focus:outline-none focus:bg-white transition-all cursor-pointer ${
                      errors.location
                        ? "border-rose-300 ring-1 ring-rose-200"
                        : "border-gray-200 focus:border-primary"
                    }`}
                  />
                  {errors.location && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.location}</p>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                    Number of Vacancies <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.vacancies}
                    onChange={(e) => {
                      setForm({ ...form, vacancies: e.target.value });
                      if (errors.vacancies) setErrors((prev) => ({ ...prev, vacancies: undefined }));
                    }}
                    className={`w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border text-gray-900 focus:outline-none focus:bg-white transition-all ${
                      errors.vacancies
                        ? "border-rose-300 ring-1 ring-rose-200"
                        : "border-gray-200 focus:border-primary"
                    }`}
                  />
                  {errors.vacancies && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.vacancies}</p>
                  )}
                </div>
              </div>

              {/* Salary Range */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                    Minimum Salary (₱) <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                      ₱
                    </span>
                    <input
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
                      className="w-full min-h-[44px] pl-8 pr-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                    />
                  </div>
                  {errors.salary_min && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.salary_min}</p>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                    Maximum Salary (₱) <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={form.salary_max}
                      onChange={(e) => {
                        setForm({ ...form, salary_max: e.target.value });
                        if (errors.salary_max) setErrors((prev) => ({ ...prev, salary_max: undefined }));
                      }}
                      placeholder="e.g. 25000"
                      className="w-full min-h-[44px] pl-8 pr-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                    />
                  </div>
                  {errors.salary_max && (
                    <p className="text-rose-600 text-xs mt-1 font-medium">{errors.salary_max}</p>
                  )}
                </div>
              </div>

              {/* Application Deadline */}
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Application Deadline <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:bg-white focus:border-primary transition-all"
                />
              </div>

              {/* Job Description */}
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Job Description & Responsibilities <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => {
                    setForm({ ...form, description: e.target.value });
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  placeholder="Outline key duties, scope of work, day-to-day responsibilities, and team role..."
                  className={`w-full p-4 rounded-xl text-sm bg-gray-50 border text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white transition-all ${
                    errors.description
                      ? "border-rose-300 ring-1 ring-rose-200"
                      : "border-gray-200 focus:border-primary"
                  }`}
                />
                {errors.description && (
                  <p className="text-rose-600 text-xs mt-1 font-medium">{errors.description}</p>
                )}
              </div>

              {/* Qualifications / Requirements */}
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Qualifications & Requirements{" "}
                  <span className="text-gray-400 font-normal lowercase">(one per line recommended)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  placeholder="• Bachelor's Degree or Vocational Graduate&#10;• At least 1-2 years relevant work experience&#10;• Good communication and technical skills"
                  className="w-full p-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                />
              </div>

              {/* Benefits & Compensation */}
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Benefits & Perks <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.benefits}
                  onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                  placeholder="e.g. SSS, PhilHealth, Pag-IBIG, 13th Month Pay, Meal Allowance, Overtime Pay..."
                  className="w-full p-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                />
              </div>

              {/* Job Tags */}
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Tags <span className="text-gray-400 font-normal lowercase">(optional, click to toggle)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TAGS.map((tag) => {
                    const selected = form.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            tags: selected ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
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
                <label className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Application Instructions <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="e.g. Please bring an updated resume, 2x2 photo, and NBI clearance. Walk-ins accepted Mon-Fri 9AM-3PM..."
                  className="w-full p-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-8 pt-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveJob("draft")}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border font-semibold ${
                    getStatusBadge(viewingJob.status).className
                  }`}
                >
                  {getStatusBadge(viewingJob.status).label}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mt-2">{viewingJob.title}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>{company?.company_name || "My Company"}</span>
                  {viewingJob.office && <span>· Dept: {viewingJob.office}</span>}
                  <span>· Posted on {new Date(viewingJob.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rejection / PESO Remarks Alert */}
            {viewingJob.remarks && (
              <div
                className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${
                  viewingJob.status === "rejected"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-current" />
                <div>
                  <h4 className="font-bold">PESO Administrator Note</h4>
                  <p className="text-xs mt-1">{viewingJob.remarks}</p>
                </div>
              </div>
            )}

            {/* Quick Fact Grid */}
            <div className="grid grid-cols-1 gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200/70">
              <div>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">Employment</p>
                <p className="text-xs font-semibold text-gray-900 mt-1">{viewingJob.employment_type}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">Location</p>
                <p className="text-xs font-semibold text-gray-900 mt-1">Brgy. {viewingJob.location}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">Vacancies</p>
                <p className="text-xs font-semibold text-gray-900 mt-1">{viewingJob.vacancies} open</p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">Salary</p>
                <p className="text-xs font-semibold text-gray-900 mt-1">
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
            <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {viewingJob.applicant_count || 0} Candidates Applied
                  </p>
                  <p className="text-xs text-gray-500">Track and review resumes in your applicant pipeline</p>
                </div>
              </div>
              <Link
                to="/employer/applicants"
                className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors"
              >
                View Pipeline →
              </Link>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-gray-500">
                Job Description
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                {viewingJob.description}
              </p>
            </div>

            {/* Requirements */}
            {viewingJob.requirements && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-gray-500">
                  Qualifications & Requirements
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  {viewingJob.requirements}
                </p>
              </div>
            )}

            {/* Benefits */}
            {viewingJob.benefits && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-gray-500">
                  Benefits & Perks
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  {viewingJob.benefits}
                </p>
              </div>
            )}

            {/* Instructions */}
            {viewingJob.instructions && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono tracking-wider uppercase font-bold text-gray-500">
                  Application Instructions
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  {viewingJob.instructions}
                </p>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const toEdit = viewingJob;
                  setViewingJob(null);
                  handleOpenEdit(toEdit);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Edit Listing
              </button>

              {(viewingJob.status === "draft" || viewingJob.status === "rejected" || viewingJob.status === "pending" || viewingJob.status === "approved") && (
                <button
                  type="button"
                  onClick={() => handlePublishJob(viewingJob)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  Publish Job
                </button>
              )}

              {(viewingJob.status === "published" || viewingJob.status === "closed") && (
                <button
                  type="button"
                  onClick={() => handleToggleClose(viewingJob)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {viewingJob.status === "published" ? "Close Job" : "Reopen Job"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewingJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
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
    </div>
  );
}
