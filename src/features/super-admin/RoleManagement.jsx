import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Pencil, Trash2, Lock, Users } from "lucide-react";
import { listRoles, createRole, updateRole, deleteRole, ROLE_PERMISSIONS } from "../../shared/services/admin";
import ConfirmationModal from "../../shared/components/ConfirmationModal";
import LoadingScreen from "../../shared/components/LoadingScreen";

// The 3 system roles are fixed by the DB enum + auth — read-only here.
// Custom roles (permission bundles) are added/edited below and assigned from
// the Users page only. Nothing on this page touches user assignment.
const SYSTEM_ROLES = [
  {
    key: "super-admin",
    label: "Super Admin",
    description: "Full system access: manage employers, accreditations, jobs, users, and settings.",
    capabilities: ["Everything below, plus Users, Roles, Reports, Logs, Settings"],
  },
  {
    key: "employer",
    label: "Employer",
    description: "Post jobs, manage applicants, submit accreditation documents.",
    capabilities: ["Job posts", "Applicants & employees", "Company profile", "Accreditation"],
  },
  {
    key: "job-seeker",
    label: "Job Seeker",
    description: "Browse jobs, manage profile, submit applications.",
    capabilities: ["Browse jobs", "Applications", "Profile & resume", "Employment history"],
  },
];

const BASE_ROLE_OPTIONS = SYSTEM_ROLES.map((r) => ({ key: r.key, label: r.label }));

const emptyForm = { name: "", description: "", base_role: "super-admin", permissions: [] };

function RoleManagement() {
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  // Create / edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [confirmRole, setConfirmRole] = useState(null);

  const load = useCallback(async () => {
    try {
      setCustomRoles(await listRoles());
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function showFlash(text) {
    setFlash(text);
    setTimeout(() => setFlash(""), 4000);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(role) {
    setEditingId(role.id);
    setForm({
      name: role.name,
      description: role.description || "",
      base_role: role.base_role || "super-admin",
      permissions: [...(role.permissions || [])],
    });
    setFormError("");
    setFormOpen(true);
  }

  function togglePermission(key) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Role name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        base_role: form.base_role,
        permissions: form.permissions,
      };
      if (editingId) {
        await updateRole(editingId, payload);
        showFlash(`Role "${payload.name}" updated.`);
      } else {
        await createRole(payload);
        showFlash(`Role "${payload.name}" created.`);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const role = confirmRole;
    setConfirmRole(null);
    try {
      await deleteRole(role.id);
      showFlash(`Role "${role.name}" deleted. Users holding it were untagged.`);
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete role");
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase font-semibold">
              SYSTEM ADMINISTRATION
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-gray-500 font-medium">Santa Maria PESO</span>
          </div>
          <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-gray-900">
            Roles
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Define roles and their permissions — assign them to people from the Users page
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover active:scale-[0.98] transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </header>

      {flash && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">{flash}</div>
      )}
      {error && (
        <div className="bg-white border border-rose-100 rounded-2xl p-5 flex items-start gap-3 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.08)]">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
            <Lock className="w-4 h-4 text-rose-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Role management hit a snag</p>
            <p className="text-sm text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {[
          { label: "System Roles", count: SYSTEM_ROLES.length, icon: Lock },
          { label: "Custom Roles", count: customRoles.length, icon: Shield },
          { label: "Permission Slots", count: ROLE_PERMISSIONS.length, icon: Users },
        ].map((c) => {
          const MetricIcon = c.icon;
          return (
            <div key={c.label} className="p-4 rounded-lg border bg-white border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-gray-900">{c.count}</p>
                <MetricIcon className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">{c.label}</p>
            </div>
          );
        })}
      </div>

      {/* System Roles — fixed by auth, read-only */}
      <section className="bg-white border border-primary rounded-lg p-5 md:p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">System Roles</h2>
            <p className="text-xs text-gray-500 mt-0.5">Locked by the platform — enforced by the API's ownership and role checks</p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2.5 py-1 rounded-full uppercase border font-semibold bg-gray-100 border-gray-200 text-gray-500 shrink-0">
            <Lock className="w-3 h-3" />
            Read-only
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SYSTEM_ROLES.map((role) => (
            <div key={role.key} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{role.label}</h3>
                  <p className="font-mono text-[10px] tracking-wider text-gray-400 uppercase">{role.key}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3 leading-relaxed">{role.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {role.capabilities.map((cap) => (
                  <span key={cap} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-gray-200 text-gray-600">
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Roles — the super-admin's catalog (assign from Users page) */}
      <section className="bg-white border border-primary rounded-lg p-5 md:p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Custom Roles ({customRoles.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">Roles you define — pick a base portal and the permissions it gets</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Role
          </button>
        </div>

        {customRoles.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="font-semibold text-gray-900 mb-1">No custom roles yet</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Create a role like "HR Officer" with the permissions you choose, then assign it to users from the Users page.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors cursor-pointer"
            >
              Create your first role
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customRoles.map((role) => (
              <article
                key={role.id}
                className="rounded-xl bg-white border border-gray-200 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(16,24,40,0.25)] transition-all p-5 flex flex-col min-h-[170px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{role.name}</h3>
                      <p className="font-mono text-[10px] tracking-wider text-gray-400 uppercase mt-0.5">
                        base · {BASE_ROLE_OPTIONS.find((b) => b.key === role.base_role)?.label || role.base_role}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mt-3 flex-1">
                  {role.description || "No description provided."}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(role.permissions || []).length === 0 ? (
                    <span className="text-[11px] text-gray-400 italic">No permissions selected</span>
                  ) : (
                    role.permissions.map((p) => (
                      <span key={p} className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                        {ROLE_PERMISSIONS.find((x) => x.key === p)?.label || p}
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => openEdit(role)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRole(role)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {/* Create / Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave} className="p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase font-semibold">
                    {editingId ? "Edit Role" : "New Role"}
                  </p>
                  <h2 className="text-lg font-bold text-gray-900 mt-0.5">
                    {editingId ? form.name || "Untitled role" : "Create a custom role"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label="Close"
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">{formError}</div>
              )}

              <div>
                <label htmlFor="role-name" className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Role Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="role-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. HR Officer, PESO Staff"
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                />
              </div>

              <div>
                <label htmlFor="role-desc" className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Description <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  id="role-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this role for?"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-primary transition-all"
                />
              </div>

              <div>
                <label htmlFor="role-base" className="block font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-1.5">
                  Base Portal <span className="text-rose-500">*</span>
                </label>
                <select
                  id="role-base"
                  value={form.base_role}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_role: e.target.value }))}
                  className="w-full min-h-[44px] px-4 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:bg-white focus:border-primary transition-all cursor-pointer"
                >
                  {BASE_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label} portal</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1.5">Which portal holders of this role use to sign in.</p>
              </div>

              <div>
                <p className="font-mono text-[11px] tracking-wider text-gray-600 uppercase font-semibold mb-2">
                  Permissions <span className="text-gray-400 font-normal lowercase">({form.permissions.length} selected)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROLE_PERMISSIONS.map((perm) => {
                    const checked = form.permissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                          checked
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.key)}
                          className="accent-[#0057B8] w-3.5 h-3.5"
                        />
                        {perm.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Permissions gate super-admin pages — they do not replace API role checks.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Create Role"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmRole && (
        <ConfirmationModal
          message={`Delete role "${confirmRole.name}"? Users assigned to it will be untagged.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmRole(null)}
          confirmLabel="Delete"
          danger
        />
      )}
    </div>
  );
}

export default RoleManagement;
