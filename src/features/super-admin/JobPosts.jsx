import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { listAllJobs, editJob, publishJob, unpublishJob } from "../../shared/services/admin";
import { changeJobStatus } from "../../shared/services/jobs";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";

// Minimal admin edit modal (prefill → PATCH admin/jobs/:id). The employer
// JobForm lives inside the employer page and can't be imported without
// dragging employer logic along — this covers admin corrections.
function EditModal({ job, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: job.title || "",
    location: job.location || "",
    vacancies: job.vacancies || 1,
    deadline: job.deadline ? job.deadline.split("T")[0] : "",
    description: job.description || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title.trim()) { setError("Job title is required"); return; }
    setError("");
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        location: form.location.trim() || null,
        vacancies: Number(form.vacancies) || 1,
        deadline: form.deadline || null,
        description: form.description.trim(),
      };
      const updated = await editJob(job.id, payload);
      onSaved(updated || { ...job, ...payload });
    } catch (err) {
      setError(err.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto border border-primary rounded-lg shadow-xl p-5 md:p-6">
        <span className="font-mono text-[10px] tracking-widest text-primary uppercase">Edit job post</span>
        <h2 className="mt-1 text-xl font-bold text-gray-900">Correct listing</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-title" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Job title</label>
            <input id="edit-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-location" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Location</label>
            <input id="edit-location" type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-vacancies" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Vacancies</label>
              <input id="edit-vacancies" type="number" min="1" value={form.vacancies} onChange={(e) => setForm({ ...form, vacancies: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-deadline" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Deadline</label>
              <input id="edit-deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="edit-description" className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">Description</label>
            <textarea id="edit-description" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-medium rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function JobPosts() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    listAllJobs()
      .then(setJobs)
      .catch((err) => setError(err.message || "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  async function handleAction(job, action) {
    try {
      await changeJobStatus(job.id, action);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: action, remarks: null } : j)));
    } catch (err) {
      setError(err.message);
    }
  }

  // Admin publish/unpublish (POST admin/jobs/:id/publish|unpublish).
  // 404 = backend item missing → graceful error state, no invented fallback.
  async function handlePublishToggle(job) {
    setActionError("");
    try {
      const updated = job.status === "published" ? await unpublishJob(job.id) : await publishJob(job.id);
      const next = updated?.status || (job.status === "published" ? "draft" : "published");
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, ...updated, status: next } : j)));
    } catch (err) {
      setActionError(err.message || "Failed to update publish state");
    }
  }

  async function confirmArchive() {
    await handleAction(jobs.find((j) => j.id === confirmArchiveId), "archived");
    setConfirmArchiveId(null);
  }

  const isExpired = (j) => Boolean(j.deadline) && new Date(j.deadline) < new Date() && j.status !== "archived";
  const filtered = jobs.filter((j) => {
    const matchesStatus = statusFilter === "all" ? true : statusFilter === "expired" ? isExpired(j) : j.status === statusFilter;
    const matchesSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.employers?.company_name?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusLabel = (status) => {
    const map = { draft: "Draft", pending: "Pending", approved: "Approved", rejected: "Rejected", published: "Published", closed: "Closed", archived: "Archived" };
    return map[status] || status;
  };

  const statusBadge = (status) => {
    if (status === "published") return "bg-emerald-50 border-emerald-200 text-emerald-700";
    if (status === "pending") return "bg-amber-50 border-amber-200 text-amber-700";
    if (status === "approved") return "bg-blue-50 border-blue-200 text-blue-700";
    if (status === "rejected") return "bg-danger/10 border-danger/20 text-danger";
    return "bg-gray-50 border-gray-200 text-gray-500";
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-medium">CENTRAL BULLETIN</p>
        </div>
        <h1 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-dark-blue">All Municipal Job Postings</h1>
        <p className="mt-2 text-sm text-gray-500">Monitor active job listings from accredited Santa Maria employers</p>
      </header>

      {actionError && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-xl">{actionError}</div>
      )}

      <section className="bg-white border border-primary rounded-lg shadow-xs">
        {/* Filter bar */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 border-b border-gray-100">
          <div className="flex-1 min-w-[160px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="expired">Expired (past deadline)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or company…"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          <span className="self-center ml-auto text-xs text-gray-400 font-medium whitespace-nowrap">{filtered.length} records</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col />
              <col style={{ width: "180px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-400 uppercase">
                <th className="text-left py-3 pl-5 pr-3 font-medium">Job Title</th>
                <th className="text-left py-3 px-3 font-medium">Company</th>
                <th className="text-left py-3 px-3 font-medium">Location</th>
                <th className="text-left py-3 px-3 font-medium">Status</th>
                <th className="text-right py-3 px-3 pr-5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">No job posts found.</td>
                </tr>
              ) : filtered.map((post) => (
                <tr key={post.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 pl-5 pr-3 text-gray-900 font-medium text-xs">{post.title}</td>
                  <td className="py-3 px-3 text-xs text-gray-500">{post.employers?.company_name}</td>
                  <td className="py-3 px-3 text-xs text-gray-500">{post.location}</td>
                  <td className="py-3 px-3">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${statusBadge(post.status)}`}>
                      {statusLabel(post.status)}
                    </span>
                  </td>
                  <td className="py-3 px-3 pr-5 text-right space-x-3">
                    {post.status === "published" ? (
                      <button onClick={() => handlePublishToggle(post)} className="text-xs text-amber-700 hover:underline cursor-pointer">Unpublish</button>
                    ) : (
                      post.status !== "archived" && (
                        <button onClick={() => handlePublishToggle(post)} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">Publish</button>
                      )
                    )}
                    <button onClick={() => setEditing(post)} className="text-xs text-gray-600 hover:underline cursor-pointer">Edit</button>
                    <button onClick={() => setConfirmArchiveId(post.id)} className="text-xs font-mono text-danger hover:text-danger/80 cursor-pointer transition-colors">Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <EditModal
          job={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
            setEditing(null);
          }}
        />
      )}

      {confirmArchiveId && (
        <ConfirmationModal
          message="Are you sure you want to archive this job post?"
          onConfirm={confirmArchive}
          onCancel={() => setConfirmArchiveId(null)}
          confirmLabel="Archive"
          danger
        />
      )}
    </div>
  );
}

export default JobPosts;
