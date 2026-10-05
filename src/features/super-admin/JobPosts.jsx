import { useState, useEffect } from "react";
import { listAllJobs } from "../../shared/services/admin";
import { changeJobStatus } from "../../shared/services/jobs";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";

function JobPosts() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);

  useEffect(() => {
    listAllJobs()
      .then(setJobs)
      .catch((err) => setError(err.message || "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  async function handleAction(job, action) {
    try {
      await changeJobStatus(job.id, action);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: action, remarks: null } : j)));
    } catch (err) {
      setError(err.message);
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
    <div className="space-y-6 animate-fade-in">
      <header>
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-medium">CENTRAL BULLETIN</p>
        </div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">All Municipal Job Postings</h1>
        <p className="mt-2 text-sm text-gray-500">Monitor active job listings from accredited Santa Maria employers</p>
      </header>

      <section className="bg-white border-2 border-primary rounded-2xl shadow-xs">
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
                  <td colSpan={5} className="py-12 text-center text-sm text-gray-400">No job posts found.</td>
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
                    {post.status === "published" && (
                      <button onClick={() => handleAction(post, "closed")} className="text-xs text-amber-700 hover:underline cursor-pointer">Close</button>
                    )}
                    <button onClick={() => setConfirmArchiveId(post.id)} className="text-xs font-mono text-danger hover:text-danger/80 cursor-pointer transition-colors">Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
