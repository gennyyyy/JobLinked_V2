import { useState, useEffect } from "react";
import useAuth from "../../hooks/useAuth";
import { listByCompany, updateApplicationStatus } from "../../services/applications";
import { supabase } from "../../lib/supabase";
import LoadingScreen from "../../components/LoadingScreen";

function Applicants() {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle()
      .then(({ data, error: err }) => {
        if (err) throw err;
        if (data) return listByCompany(data.id);
        return [];
      })
      .then((list) => setApplicants(list))
      .catch((err) => setError(err.message || "Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [user]);

  async function setStatus(id, status, extra = {}) {
    try {
      await updateApplicationStatus(id, status, extra);
      setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleInterview(id) {
    const date = prompt("Interview date (ISO format, e.g. 2026-10-15T09:00):");
    if (!date) return;
    const instructions = prompt("Interview instructions:") || "";
    setStatus(id, "Interview", { interviewAt: date, interviewInstructions: instructions });
  }

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  const filtered = applicants.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter;
    const matchesSearch = !search || a.seeker?.full_name?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">CANDIDATE PIPELINE</p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Applicant Tracking</h1>
        <p className="mt-2 text-sm text-gray-500">Review credentials and update recruitment statuses for candidate applications</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by candidate name..."
          className="flex-1 min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-[44px] px-4 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="Applied">Applied</option>
          <option value="Under Review">Under Review</option>
          <option value="Shortlisted">Shortlisted</option>
          <option value="Interview">Interview</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Candidate Name</th>
                <th className="text-left py-3 px-4 font-medium">Position Applied For</th>
                <th className="text-left py-3 px-4 font-medium">Date Submitted</th>
                <th className="text-left py-3 px-4 font-medium">Review Status</th>
                <th className="text-right py-3 px-4 font-medium">Evaluation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((applicant) => (
                <tr key={applicant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-4 text-gray-900 font-medium">{applicant.seeker?.full_name}</td>
                  <td className="py-3.5 px-4 text-gray-600">{applicant.job?.title}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                    {new Date(applicant.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                      applicant.status === "Shortlisted" || applicant.status === "Accepted"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : applicant.status === "Rejected"
                          ? "bg-danger/10 border-danger/20 text-danger"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      {applicant.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {applicant.status !== "Shortlisted" && applicant.status !== "Accepted" && (
                      <button onClick={() => setStatus(applicant.id, "Shortlisted")} className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        Shortlist
                      </button>
                    )}
                    {applicant.status !== "Interview" && applicant.status !== "Accepted" && (
                      <button onClick={() => handleInterview(applicant.id)} className="px-3 py-1 rounded-lg text-xs font-medium bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition-colors">
                        Interview
                      </button>
                    )}
                    {applicant.status !== "Accepted" && (
                      <button onClick={() => setStatus(applicant.id, "Accepted")} className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        Accept
                      </button>
                    )}
                    {applicant.status !== "Rejected" && (
                      <button onClick={() => setStatus(applicant.id, "Rejected")} className="px-3 py-1 rounded-lg text-xs font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors">
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              No applicant submissions yet. Candidates applying to your listings will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Applicants;
