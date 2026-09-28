import { useEffect, useMemo, useState } from "react";
import { listAuditLogs, listUsers } from "../../services/admin";
import LoadingScreen from "../../components/LoadingScreen";

const ACTIVITY_TYPES = [
  "auth.login",
  "auth.login.failed",
  "auth.logout",
  "auth.register",
  "auth.password.change",
  "profile.update",
  "profile.view",
  "job.search",
  "job.view",
  "job.list.view",
  "job.create",
  "job.update",
  "job.status.draft",
  "job.status.pending",
  "job.status.approved",
  "job.status.rejected",
  "job.status.published",
  "job.status.closed",
  "job.status.archived",
  "application.list.view",
  "application.create",
  "application.status.Applied",
  "application.status.Under Review",
  "application.status.Shortlisted",
  "application.status.Interview",
  "application.status.Accepted",
  "application.status.Rejected",
  "resume.upload",
  "document.upload",
  "document.view",
  "document.pending",
  "document.verified",
  "document.rejected",
  "accreditation.submit",
  "accreditation.approved",
  "accreditation.rejected",
  "accreditation.revoked",
  "settings.reference.add",
  "settings.reference.remove",
  "settings.barangay.add",
  "settings.barangay.remove",
  "facebook.connect",
  "facebook.disconnect",
];

function Logs() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ userId: "", action: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogs(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const data = await listAuditLogs(nextFilters);
      setLogs(data);
    } catch (err) {
      setError(err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([listUsers(), listAuditLogs()])
      .then(([userRows, logRows]) => {
        setUsers(userRows);
        setLogs(logRows);
      })
      .catch((err) => setError(err.message || "Failed to load activity logs"))
      .finally(() => setLoading(false));
  }, []);

  const actions = useMemo(() => [...new Set([...ACTIVITY_TYPES, ...logs.map((log) => log.action).filter(Boolean)])].sort(), [logs]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function formatDetails(details) {
    if (!details) return "—";
    return typeof details === "string" ? details : JSON.stringify(details);
  }

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  return (
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM AUDIT</p>
        </div>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">Activity Logs</h1>
        <p className="mt-2 text-sm text-gray-500">Review user actions and system activity across the platform</p>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <select value={filters.userId} onChange={(e) => updateFilter("userId", e.target.value)} className="min-h-[44px] px-3 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:border-primary">
            <option value="">All users</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
          </select>
          <select value={filters.action} onChange={(e) => updateFilter("action", e.target.value)} className="min-h-[44px] px-3 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:border-primary">
            <option value="">All activities</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <input type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} aria-label="From date" className="min-h-[44px] px-3 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:border-primary" />
          <input type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} aria-label="To date" className="min-h-[44px] px-3 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:border-primary" />
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button type="button" onClick={loadLogs} className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover">Apply Filters</button>
          <button
            type="button"
            onClick={() => { const nextFilters = { ...filters, action: "auth." }; setFilters(nextFilters); loadLogs(nextFilters); }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
          >
            Login History
          </button>
          <button type="button" onClick={() => { const nextFilters = { userId: "", action: "", from: "", to: "" }; setFilters(nextFilters); loadLogs(nextFilters); }} className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50">Clear</button>
          <span className="ml-auto text-xs text-gray-400">{logs.length} records</span>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Date</th>
                <th className="text-left py-3 px-4 font-medium">User</th>
                <th className="text-left py-3 px-4 font-medium">Activity</th>
                <th className="text-left py-3 px-4 font-medium">Entity</th>
                <th className="text-left py-3 px-4 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 align-top">
                  <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-3 px-4 text-xs text-gray-700">{log.user?.full_name || log.user?.email || "System / legacy"}</td>
                  <td className="py-3 px-4"><span className="font-mono text-xs text-primary">{log.action}</span></td>
                  <td className="py-3 px-4 text-xs text-gray-500">{log.entity || "—"}{log.entity_id ? ` · ${log.entity_id}` : ""}</td>
                  <td className="py-3 px-4 max-w-xs break-words text-xs text-gray-500">{formatDetails(log.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="py-12 text-center text-sm text-gray-400">No activity logs match these filters.</div>}
        </div>
      </section>
    </div>
  );
}

export default Logs;
