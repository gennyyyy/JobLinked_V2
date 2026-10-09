import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { listAuditLogs, listUsers } from "../../shared/services/admin";
import LoadingScreen from "../../shared/components/LoadingScreen";

const ACTIVITY_TYPES = [
  "auth.login",
  "auth.login.failed",
  "auth.logout",
  "auth.register",
  "auth.password.change",
  "auth.password.reset.request",
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
  "application.status.Terminated",
  "resume.upload",
  "resume.activate",
  "document.upload",
  "document.view",
  "document.pending",
  "document.verified",
  "document.rejected",
  "accreditation.submit",
  "accreditation.approved",
  "accreditation.rejected",
  "accreditation.revoked",
  "facebook.connect",
  "facebook.disconnect",
  "data.purge",
  "settings.reference.add",
  "settings.reference.remove",
  "settings.barangay.add",
  "settings.barangay.remove",
  "user.update",
];

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider text-gray-500 uppercase">{label}</p>
      <p className="mt-1 text-sm text-gray-900 font-medium">{value}</p>
    </div>
  );
}

function UserModal({ email, onClose }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    listUsers({ search: email })
      .then((rows) => setUser((rows || []).find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [email]);

  if (!email) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto border border-primary rounded-lg shadow-xl p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-200">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-primary uppercase">USER PROFILE</span>
            <h2 className="mt-1 text-xl font-bold text-gray-900">{loading ? email : user?.full_name || email}</h2>
            {user?.role && <span className="mt-2 inline-block px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs capitalize">{user.role.replace("-", " ")}</span>}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer" aria-label="Close">✕</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
          {loading ? (
            <p className="text-xs text-gray-400">Loading profile…</p>
          ) : !user ? (
            <p className="text-sm text-gray-500">No profile found for this email.</p>
          ) : (
            <>
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow label="Status" value={user.status} />
              {user.role === "employer" && <InfoRow label="Company" value={user.company_name} />}
              <InfoRow label="Barangay" value={user.barangay_district || user.barangay} />
              <InfoRow label="City" value={user.city} />
              <InfoRow label="Member since" value={user.created_at && new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} />
            </>
          )}
        </div>
        <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Logs() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ userId: "", action: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");

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

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  return (
    <div className="space-y-6 md:h-[calc(100vh-3rem)] md:flex md:flex-col md:overflow-hidden">
      <header className="shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-medium">SYSTEM AUDIT</p>
        </div>
        <h1 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-dark-blue">Activity Logs</h1>
        <p className="mt-2 text-sm text-gray-500">Review user actions and system activity across the platform</p>
      </header>



      <section className="bg-white border border-primary rounded-lg shadow-xs min-h-0 flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="shrink-0 px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 border-b border-gray-100">
          <div className="flex-1 min-w-[150px]">
            <select
              value={filters.userId}
              onChange={(e) => updateFilter("userId", e.target.value)}
              aria-label="Filter by user"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer"
            >
              <option value="">All users</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <select
              value={filters.action}
              onChange={(e) => updateFilter("action", e.target.value)}
              aria-label="Filter by activity"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer"
            >
              <option value="">All activities</option>
              <option value="auth.">auth.* (all auth events)</option>
              {actions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </div>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
            aria-label="From date"
            className="min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
            aria-label="To date"
            className="min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <button
            type="button"
            onClick={() => loadLogs()}
            className="min-h-[38px] px-5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover active:scale-[0.99] transition-all cursor-pointer shadow-xs"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => { const nextFilters = { ...filters, action: "auth." }; setFilters(nextFilters); loadLogs(nextFilters); }}
            className="min-h-[38px] px-5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs"
          >
            Login History
          </button>
          <button
            type="button"
            onClick={() => { const nextFilters = { userId: "", action: "", from: "", to: "" }; setFilters(nextFilters); loadLogs(nextFilters); }}
            className="min-h-[38px] px-4 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            Clear
          </button>
          <span className="self-center ml-auto text-xs text-gray-400 font-medium whitespace-nowrap">{logs.length} records</span>
        </div>
        {/* Table */}
        <div className="overflow-auto min-h-0 flex-1 md:max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "160px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "190px" }} />
            </colgroup>
            <thead>
              <tr className="sticky top-0 bg-white z-10 border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-400 uppercase">
                <th className="text-left py-3 pl-5 pr-3 font-medium">Date</th>
                <th className="text-left py-3 px-3 font-medium">User</th>
                <th className="text-left py-3 px-3 pr-5 font-medium">Activity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors align-top">
                  <td className="py-3 pl-5 pr-3 whitespace-nowrap text-xs text-gray-500">{formatDate(log.created_at)}</td>
                  <td className="py-3 px-3 text-xs">
                    {log.actor_email ? (
                      <button
                        type="button"
                        onClick={() => setSelectedEmail(log.actor_email)}
                        className="text-primary hover:underline text-left cursor-pointer break-all"
                      >
                        {log.actor_email}
                      </button>
                    ) : (
                      <span className="text-gray-400">{log.actor_name || "—"}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 pr-5">
                    <span className="font-mono text-xs font-semibold text-primary break-all">{log.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No activity logs match these filters.</div>}
        </div>
      </section>
      {selectedEmail && <UserModal email={selectedEmail} onClose={() => setSelectedEmail("")} />}
    </div>
  );
}

export default Logs;
