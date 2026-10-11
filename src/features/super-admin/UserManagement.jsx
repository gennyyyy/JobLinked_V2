import { useState, useEffect } from "react";
import { listUsers, updateUser, listAllAccreditations, listRoles, assignRole, assignCustomRole } from "../../shared/services/admin";
import { latestAccByCompany } from "../../shared/services/documents";
import useAuth from "../../shared/hooks/useAuth";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";

const SYSTEM_ROLE_LABELS = { "super-admin": "Super Admin", employer: "Employer", "job-seeker": "Job Seeker" };

function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    Promise.all([listUsers(), listAllAccreditations(), listRoles().catch(() => [])])
      .then(([u, accs, roles]) => {
        setUsers(u);
        setAccreditations(accs);
        setCustomRoles(roles || []);
      })
      .catch((err) => setError(err.message || "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  // accreditations ordered submitted_at desc → first row per company is its latest
  const latestByCompany = latestAccByCompany(accreditations);

  // Role assignment lives ONLY here (the Roles page manages definitions).
  // - sys:<role>   → cross-table system-role move (+ clears any custom tag)
  // - custom:<id>  → ensures the account sits in the role's base portal, then tags
  // - plain clear  → removes the custom tag only
  async function handleAssignRole(user, value) {
    if (value === `sys:${user.role}` && !user.custom_role_id) return;
    setActionError("");
    setSuccess("");
    setSavingId(user.id);
    try {
      if (value.startsWith("custom:")) {
        const role = customRoles.find((r) => String(r.id) === value.slice(7));
        if (!role) throw new Error("Custom role not found — refresh the page");
        if (user.role !== role.base_role) await assignRole(user.id, role.base_role);
        await assignCustomRole(user.id, role.id);
        setSuccess(`Role "${role.name}" assigned to ${user.full_name || user.email}.`);
      } else if (value.startsWith("sys:")) {
        const role = value.slice(4);
        if (user.custom_role_id) await assignCustomRole(user.id, null);
        if (user.role !== role) await assignRole(user.id, role);
        setSuccess(`Role set to ${SYSTEM_ROLE_LABELS[role] || role} for ${user.full_name || user.email}.`);
      } else if (value === "clear-custom") {
        await assignCustomRole(user.id, null);
        setSuccess(`Custom role cleared for ${user.full_name || user.email}.`);
      }
      const updated = await listUsers();
      setUsers(updated);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setActionError(err.message || "Failed to assign role");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleStatus(user) {
    const newStatus = user.status === "active" ? "suspended" : "active";
    await updateUser(user.id, { status: newStatus });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
  }

  async function confirmDelete() {
    await updateUser(confirmDeleteId, { status: "inactive" });
    setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteId));
    setConfirmDeleteId(null);
    setSuccess("User deactivated");
    setTimeout(() => setSuccess(""), 3000);
  }

  const filteredUsers = users.filter((u) => {
    const matchesRole = filterRole === "all" || u.role === filterRole;
    const matchesSearch = !searchTerm || u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const roleOptions = [
    { value: "all", label: "All Roles" },
    { value: "super-admin", label: "Super Admin" },
    { value: "employer", label: "Employer" },
    { value: "job-seeker", label: "Job Seeker" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-medium">SYSTEM ADMINISTRATION</p>
        </div>
        <h1 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-dark-blue">User Management</h1>
        <p className="mt-2 text-sm text-gray-500">Manage system users and assign them to roles</p>
      </header>

      {success && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">{success}</div>
      )}
      {actionError && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">{actionError}</div>
      )}

      <section className="bg-white border border-primary rounded-lg shadow-xs">
        {/* Filter bar */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 border-b border-gray-100">
          <div className="flex-1 min-w-[160px]">
            <select
              id="role-filter"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              aria-label="Filter by role"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer"
            >
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          <span className="self-center ml-auto text-xs text-gray-400 font-medium whitespace-nowrap">{filteredUsers.length} records</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "160px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "100px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-400 uppercase">
                <th className="text-left py-3 pl-5 pr-3 font-medium">Name</th>
                <th className="text-left py-3 px-3 font-medium">Email</th>
                <th className="text-left py-3 px-3 font-medium">Role</th>
                <th className="text-left py-3 px-3 font-medium">Status</th>
                <th className="text-left py-3 px-3 font-medium">Accreditation</th>
                <th className="text-left py-3 px-3 font-medium">Created</th>
                <th className="text-right py-3 px-3 pr-5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-400">No users found.</td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 pl-5 pr-3 text-gray-900 font-medium text-xs uppercase">{user.full_name}</td>
                  <td className="py-3 px-3 text-xs text-gray-500 break-all">{user.email}</td>
                  <td className="py-3 px-3">
                    {currentUser && user.id === currentUser.id ? (
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] capitalize">
                          {SYSTEM_ROLE_LABELS[user.role] || user.role}
                        </span>
                        {user.custom_role_id && (
                          <span className="block inline-block px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-medium">
                            {customRoles.find((r) => String(r.id) === String(user.custom_role_id))?.name || "Custom role"}
                          </span>
                        )}
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-gray-400">You — role locked</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label htmlFor={`role-${user.id}`} className="sr-only">Role for {user.full_name || user.email}</label>
                        <select
                          id={`role-${user.id}`}
                          value={user.custom_role_id ? `custom:${user.custom_role_id}` : `sys:${user.role}`}
                          disabled={savingId === user.id}
                          onChange={(e) => handleAssignRole(user, e.target.value)}
                          className="min-h-[36px] max-w-[170px] px-2.5 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <optgroup label="System roles">
                            {Object.entries(SYSTEM_ROLE_LABELS).map(([key, label]) => (
                              <option key={key} value={`sys:${key}`}>{label}</option>
                            ))}
                          </optgroup>
                          {customRoles.length > 0 && (
                            <optgroup label="Custom roles">
                              {customRoles.map((r) => (
                                <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {user.custom_role_id && (
                            <option value="clear-custom">Clear custom role…</option>
                          )}
                        </select>
                        {savingId === user.id && <span className="block text-[10px] text-gray-400">Saving…</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-1 rounded-full font-medium text-[10px] uppercase border ${
                      user.status === "active" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : user.status === "suspended" ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-gray-100 border-gray-200 text-gray-500"
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {user.role === "employer" ? (() => {
                      const status = latestByCompany[user.id]?.status || "not applied";
                      const styles = status === "approved"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : status === "pending"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : status === "rejected" || status === "revoked"
                            ? "bg-danger/10 border-danger/20 text-danger"
                            : "bg-gray-100 border-gray-200 text-gray-500";
                      return <span className={`inline-block px-2 py-1 rounded-full font-medium text-[10px] uppercase border ${styles}`}>{status}</span>;
                    })() : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="py-3 px-3 pr-5 text-right space-x-3">
                    <button onClick={() => handleToggleStatus(user)} className="text-xs text-gray-600 hover:text-gray-900 cursor-pointer transition-colors">
                      {user.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button onClick={() => setConfirmDeleteId(user.id)} className="text-xs text-danger hover:text-danger/80 font-bold cursor-pointer" title="Deactivate user">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirmDeleteId && (
        <ConfirmationModal
          message="Are you sure you want to deactivate this user?"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
          confirmLabel="Deactivate"
          danger
        />
      )}
    </div>
  );
}

export default UserManagement;
