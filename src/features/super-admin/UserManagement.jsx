import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { listUsers, updateUser, listAllAccreditations, listRoles, assignRole, assignCustomRole, inviteUser } from "../../shared/services/admin";
import { latestAccByCompany } from "../../shared/services/documents";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";
import { InlineError, Pager } from "../../shared/components/dashboard";
import useDialog from "../../shared/hooks/useDialog";
import { titleCase } from "../../shared/utils/titleCase";

const SYSTEM_ROLE_LABELS = { "super-admin": "Super Admin", employer: "Employer", "job-seeker": "Job Seeker" };

const EMPTY_INVITE = {
  email: "", role: "", first_name: "", middle_name: "", last_name: "",
  suffix: "", phone: "", company_name: "",
};

const INVITE_INPUT_CLASS = "w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all";

function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [total, setTotal] = useState(0);
  const [accreditations, setAccreditations] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviting, setInviting] = useState(false);

  const inviteRef = useDialog(() => setShowInvite(false), showInvite);

  // Users arrive as the { data, total, page, pageSize } envelope (C2). Role and
  // search are filtered server-side (GET /admin/users accepts role/search/status)
  // so a query isn't trapped inside the current 25-row page.
  const loadReqRef = useRef(0);
  const loadUsers = useCallback((p) => {
    const params = { page: p };
    if (filterRole !== "all") params.role = filterRole;
    if (debouncedSearch) params.search = debouncedSearch;
    const req = ++loadReqRef.current;
    return listUsers(params).then((res) => {
      if (req !== loadReqRef.current) return; // drop a superseded fetch
      setUsers(res.data);
      setTotal(res.total);
      setPageSize(res.pageSize);
    });
  }, [filterRole, debouncedSearch]);

  useEffect(() => { loadUsers(page).catch((err) => setError(err.message || "Failed to load users")); }, [loadUsers, page]);

  // Debounce the search box (mirrors Jobs/JobPosts) so each keystroke doesn't refetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    Promise.all([listAllAccreditations(), listRoles().catch(() => [])])
      .then(([accs, roles]) => {
        setAccreditations(accs.data);
        setCustomRoles(roles || []);
      })
      .catch((err) => setError(err.message || "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <InlineError message={error} />;

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
      await loadUsers(page);
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

  // Invite (ADR-024): role select carries either a system role or `custom:<id>`;
  // a custom selection must also send its base_role (spec §5.1).
  const inviteBaseRole = inviteForm.role.startsWith("custom:")
    ? customRoles.find((r) => String(r.id) === inviteForm.role.slice(7))?.base_role
    : inviteForm.role;

  function setInviteField(field, value) {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleInvite(e) {
    e.preventDefault();
    setActionError("");
    setSuccess("");
    setInviting(true);
    try {
      const payload = {
        email: inviteForm.email,
        first_name: inviteForm.first_name,
        middle_name: inviteForm.middle_name,
        last_name: inviteForm.last_name,
        suffix: inviteForm.suffix,
        phone: inviteForm.phone,
      };
      if (inviteBaseRole === "employer") payload.company_name = inviteForm.company_name;
      if (inviteForm.role.startsWith("custom:")) {
        const role = customRoles.find((r) => String(r.id) === inviteForm.role.slice(7));
        if (!role) throw new Error("Custom role not found — refresh the page");
        payload.custom_role_id = Number(role.id);
        payload.role = role.base_role;
      } else {
        payload.role = inviteForm.role;
      }
      await inviteUser(payload);
      setSuccess(`Invite sent to ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm(EMPTY_INVITE);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setActionError(err.message || "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

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
        <div role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">{actionError}</div>
      )}

      <section className="bg-white border border-primary rounded-lg shadow-xs">
        {/* Filter bar */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 border-b border-gray-100">
          <div className="flex-1 min-w-[160px]">
            <select
              id="role-filter"
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
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
              aria-label="Search users by name or email"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search by name or email…"
              className="w-full min-h-[38px] px-3.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-800 placeholder:text-gray-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          <span className="self-center ml-auto text-xs text-gray-500 font-medium whitespace-nowrap">{total} records</span>
          <button
            type="button"
            onClick={() => { setActionError(""); setShowInvite(true); }}
            className="shrink-0 min-h-[38px] px-4 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Add user
          </button>
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
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
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
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-500">No users found.</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 pl-5 pr-3 text-gray-900 font-medium text-xs">{titleCase(user.full_name)}</td>
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
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-gray-500">You — role locked</span>
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
                        {savingId === user.id && <span className="block text-[10px] text-gray-500">Saving…</span>}
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
                      // accreditations is a capped page (C2) — fall back to the
                      // denormalized employers.accreditation_status (kept in
                      // sync by trigger) when this company's latest row aged out.
                      const status = latestByCompany[user.id]?.status || user.accreditation_status || "not applied";
                      const styles = status === "approved"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : status === "pending"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : status === "rejected" || status === "revoked"
                            ? "bg-danger/10 border-danger/20 text-danger"
                            : "bg-gray-100 border-gray-200 text-gray-500";
                      return <span className={`inline-block px-2 py-1 rounded-full font-medium text-[10px] uppercase border ${styles}`}>{status}</span>;
                    })() : <span className="text-gray-500 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="py-3 px-3 pr-5 text-right space-x-3">
                    <button onClick={() => handleToggleStatus(user)} className="text-xs text-gray-600 hover:text-gray-900 cursor-pointer transition-colors">
                      {user.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pageSize={pageSize} total={total} onChange={setPage} />
      </section>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowInvite(false)}>
          <form
            ref={inviteRef}
            onSubmit={handleInvite}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto border border-primary rounded-lg shadow-xl p-5"
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-200">
              <div>
                <span className="font-mono text-[10px] tracking-widest text-primary uppercase">INVITE</span>
                <h2 id="invite-title" className="mt-1 text-xl font-bold text-gray-900">Add user</h2>
                <p className="mt-1 text-xs text-gray-500">Send an invitation email to onboard a new municipal user or partner.</p>
              </div>
              <button type="button" onClick={() => setShowInvite(false)} className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="invite-email" className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input id="invite-email" type="email" required placeholder="e.g. juan.delacruz@example.com" value={inviteForm.email} onChange={(e) => setInviteField("email", e.target.value)} className={INVITE_INPUT_CLASS} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="invite-role" className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select id="invite-role" required value={inviteForm.role} onChange={(e) => setInviteField("role", e.target.value)} className={`${INVITE_INPUT_CLASS} cursor-pointer`}>
                  <option value="" disabled>Select a role…</option>
                  <optgroup label="System roles">
                    {Object.entries(SYSTEM_ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </optgroup>
                  {customRoles.length > 0 && (
                    <optgroup label="Custom roles">
                      {customRoles.map((r) => (
                        <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="invite-first" className="block text-xs font-medium text-gray-700 mb-1">First name</label>
                <input id="invite-first" type="text" required placeholder="e.g. Juan" value={inviteForm.first_name} onChange={(e) => setInviteField("first_name", e.target.value)} className={INVITE_INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="invite-middle" className="block text-xs font-medium text-gray-700 mb-1">Middle name</label>
                <input id="invite-middle" type="text" placeholder="e.g. Santos (optional)" value={inviteForm.middle_name} onChange={(e) => setInviteField("middle_name", e.target.value)} className={INVITE_INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="invite-last" className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
                <input id="invite-last" type="text" required placeholder="e.g. Dela Cruz" value={inviteForm.last_name} onChange={(e) => setInviteField("last_name", e.target.value)} className={INVITE_INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="invite-suffix" className="block text-xs font-medium text-gray-700 mb-1">Suffix</label>
                <input id="invite-suffix" type="text" placeholder="e.g. Jr., III (optional)" value={inviteForm.suffix} onChange={(e) => setInviteField("suffix", e.target.value)} className={INVITE_INPUT_CLASS} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="invite-phone" className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input id="invite-phone" type="tel" placeholder="e.g. 0917 123 4567" value={inviteForm.phone} onChange={(e) => setInviteField("phone", e.target.value)} className={INVITE_INPUT_CLASS} />
              </div>
              {inviteBaseRole === "employer" && (
                <div className="sm:col-span-2">
                  <label htmlFor="invite-company" className="block text-xs font-medium text-gray-700 mb-1">Company name</label>
                  <input id="invite-company" type="text" required placeholder="e.g. San Miguel Corporation" value={inviteForm.company_name} onChange={(e) => setInviteField("company_name", e.target.value)} className={INVITE_INPUT_CLASS} />
                </div>
              )}
            </div>

            {actionError && <div className="mt-4 text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-lg">{actionError}</div>}

            <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
              <button type="button" onClick={() => setShowInvite(false)} className="px-5 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={inviting} className="px-5 py-2 text-xs font-medium rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50">
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
