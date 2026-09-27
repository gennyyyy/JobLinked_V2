import { useState, useEffect } from "react";
import { listAllJobs } from "../../services/admin";
import { changeJobStatus } from "../../services/jobs";
import ConfirmationModal from "../../components/ConfirmationModal";
import LoadingScreen from "../../components/LoadingScreen";

function JobPosts() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: action } : j)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmArchive() {
    await handleAction(jobs.find((j) => j.id === confirmArchiveId), "archived");
    setConfirmArchiveId(null);
  }

  const filtered = jobs.filter((j) => statusFilter === "all" || j.status === statusFilter);

  const statusLabel = (status) => {
    const map = { draft: "Draft", pending: "Pending", approved: "Approved", rejected: "Rejected", published: "Published", closed: "Closed", archived: "Archived" };
    return map[status] || status;
  };

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">CENTRAL BULLETIN</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">All Municipal Job Postings</h1>
        <p className="mt-2 text-sm text-gray-500">Monitor active job listings from accredited Santa Maria employers</p>
      </header>

      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">Job Postings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Job Title</th>
                <th className="text-left py-3 px-4 font-medium">Company</th>
                <th className="text-left py-3 px-4 font-medium">Location</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((post) => (
                <tr key={post.id} className="hover:bg-primary/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{post.title}</td>
                  <td className="py-3.5 px-4 text-gray-500">{post.companies?.name}</td>
                  <td className="py-3.5 px-4 text-xs text-gray-500">{post.location}</td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                      post.status === "published" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : post.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-700"
                      : post.status === "rejected" ? "bg-danger/10 border-danger/20 text-danger"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                    }`}>
                      {statusLabel(post.status)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {post.status === "published" && (
                      <button onClick={() => handleAction(post, "closed")} className="text-xs text-amber-700 hover:underline">Close</button>
                    )}
                    <button onClick={() => setConfirmArchiveId(post.id)} className="text-xs font-mono text-danger hover:text-danger transition-colors">Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No job posts found.</div>
          )}
        </div>
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
    </div>
  );
}

export default JobPosts;
