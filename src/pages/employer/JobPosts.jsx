import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import {
  getJobsByEmployer,
  addJob,
  updateJob,
  deleteJob,
  getApplicationsByJob,
} from "../../utils/jobStore";
import { barangays } from "../../data/barangays";

const emptyForm = {
  title: "",
  description: "",
  requirements: "",
  salary: "",
  type: "Full-time",
  location: barangays[0] || "Poblacion",
  status: "Open",
};

function JobPosts() {
  const { user } = useAuth();
  const companyEmail = user?.email || "";
  const companyName = user?.name || "My Company";
  const [jobs, setJobs] = useState(getJobsByEmployer(companyEmail));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  function refresh() {
    setJobs(getJobsByEmployer(companyEmail));
  }

  function handleAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    setShowForm(true);
  }

  function handleEdit(job) {
    setForm({
      title: job.title,
      description: job.description,
      requirements: (job.requirements || []).join(", "),
      salary: job.salary,
      type: job.type,
      location: job.location,
      status: job.status,
    });
    setEditingId(job.id);
    setErrors({});
    setShowForm(true);
  }

  function validate() {
    const e = {};
    if (!form.title?.trim()) e.title = "Job title is required";
    if (!form.description?.trim()) e.description = "Description is required";
    if (!form.type) e.type = "Employment type is required";
    if (!form.location) e.location = "Location is required";
    if (!form.status) e.status = "Status is required";
    return e;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    const payload = {
      title: form.title,
      description: form.description,
      requirements: (form.requirements || "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      salary: form.salary,
      type: form.type,
      location: form.location,
      status: form.status,
    };
    if (editingId) {
      updateJob(editingId, payload);
    } else {
      addJob({ ...payload, company: companyName, companyEmail });
    }
    setShowForm(false);
    setEditingId(null);
    refresh();
  }

  function handleClose(job) {
    updateJob(job.id, { status: job.status === "Open" ? "Closed" : "Open" });
    refresh();
  }

  function handleDelete(job) {
    deleteJob(job.id);
    refresh();
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
            RECRUITMENT BULLETINS
          </p>
          <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
            Job Posts
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage your company's listings on the Santa Maria municipal job board
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="min-h-[44px] px-6 rounded-xl bg-[#0057B8] text-white text-sm font-medium hover:bg-[#004a9e] active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,117,162,0.25)] self-start sm:self-auto"
        >
          + Add New Job Post
        </button>
      </header>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <span className="font-mono text-[10px] tracking-widest text-primary uppercase">
                  {editingId ? "UPDATE LISTING" : "NEW VACANCY"}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-1">
                  {editingId ? "Edit Job Post" : "Post a Vacancy"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                  Job Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="e.g. Administrative Officer"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                {errors.title && <p className="text-danger text-xs mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => {
                    setForm({ ...form, description: e.target.value });
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  rows={3}
                  placeholder="Responsibilities, role overview, and duties..."
                  className="w-full p-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                {errors.description && <p className="text-danger text-xs mt-1">{errors.description}</p>}
              </div>

              <div>
                <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                  Requirements <span className="text-gray-300 font-normal">(comma-separated)</span>
                </label>
                <textarea
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  rows={2}
                  placeholder="Bachelor's degree, 1 year experience, MS Office..."
                  className="w-full p-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                    Monthly Salary
                  </label>
                  <input
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                    placeholder="₱20,000 - ₱25,000"
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                    Employment Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      setForm({ ...form, type: e.target.value });
                      if (errors.type) setErrors((prev) => ({ ...prev, type: undefined }));
                    }}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contractual</option>
                    <option>Job Order</option>
                  </select>
                  {errors.type && <p className="text-danger text-xs mt-1">{errors.type}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                    Barangay Location
                  </label>
                  <select
                    value={form.location}
                    onChange={(e) => {
                      setForm({ ...form, location: e.target.value });
                      if (errors.location) setErrors((prev) => ({ ...prev, location: undefined }));
                    }}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  >
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {errors.location && <p className="text-danger text-xs mt-1">{errors.location}</p>}
                </div>

                <div>
                  <label className="block font-mono text-[11px] tracking-wider text-gray-500 uppercase mb-1.5">
                    Posting Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => {
                      setForm({ ...form, status: e.target.value });
                      if (errors.status) setErrors((prev) => ({ ...prev, status: undefined }));
                    }}
                    className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  >
                    <option>Open</option>
                    <option>Closed</option>
                  </select>
                  {errors.status && <p className="text-danger text-xs mt-1">{errors.status}</p>}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-medium text-white bg-primary hover:bg-[#004a9e] rounded-xl transition-colors"
              >
                {editingId ? "Save Changes" : "Publish Job Post"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts Table */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Job Title</th>
                <th className="text-left py-3 px-4 font-medium">Salary</th>
                <th className="text-left py-3 px-4 font-medium">Location</th>
                <th className="text-left py-3 px-4 font-medium">Candidates</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((post) => {
                const count = getApplicationsByJob(post.id).length;
                return (
                  <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-4 text-gray-900 font-medium">{post.title}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-primary">{post.salary || "—"}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-500">{post.location}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
                        {count} applied
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                          post.status === "Open"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-gray-100 border-gray-200 text-gray-500"
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3">
                      <button
                        onClick={() => handleEdit(post)}
                        className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleClose(post)}
                        className="text-xs text-amber-700 hover:text-amber-700 transition-colors"
                      >
                        {post.status === "Open" ? "Close" : "Reopen"}
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        className="text-xs font-mono text-danger hover:text-danger transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              No job postings created yet. Click "+ Add New Job Post" to post a vacancy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobPosts;
