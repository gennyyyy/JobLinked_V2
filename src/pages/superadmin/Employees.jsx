import { useState, useEffect } from "react";
import { listUsers, updateUser } from "../../services/admin";
import LoadingScreen from "../../components/LoadingScreen";

function JobSeekers() {
  const [jobSeekers, setJobSeekers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    listUsers({ role: "job-seeker" })
      .then(setJobSeekers)
      .catch((err) => setError(err.message || "Failed to load job seekers"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  async function toggleStatus(seeker) {
    const newStatus = seeker.status === "active" ? "suspended" : "active";
    await updateUser(seeker.id, { status: newStatus });
    setJobSeekers((prev) => prev.map((e) => (e.id === seeker.id ? { ...e, status: newStatus } : e)));
  }

  const filtered = jobSeekers.filter((e) => {
    const matchesSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">MUNICIPAL REGISTRY</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Registered Job Seekers</h1>
        <p className="mt-2 text-sm text-gray-500">View registered Santa Maria job seekers and manage platform enrollment statuses</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">Job Seekers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Full Name</th>
                <th className="text-left py-3 px-4 font-medium">Email Address</th>
                <th className="text-left py-3 px-4 font-medium">Date Registered</th>
                <th className="text-left py-3 px-4 font-medium">Account Status</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-primary/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{emp.full_name}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{emp.email}</td>
                  <td className="py-3.5 px-4 text-xs text-gray-500">
                    {new Date(emp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                      emp.status === 'active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : emp.status === 'suspended' ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-gray-100 border-gray-200 text-gray-500'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => toggleStatus(emp)}
                      className={`text-xs font-mono transition-colors ${
                        emp.status === 'active' ? 'text-danger hover:text-danger' : 'text-[#0057B8] hover:text-gray-900'
                      }`}
                    >
                      {emp.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">No job seekers found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobSeekers;
