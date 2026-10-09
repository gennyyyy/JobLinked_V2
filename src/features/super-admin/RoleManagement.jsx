import { useState, useEffect } from "react";
import { listUsers, assignRole } from "../../shared/services/admin";
import useAuth from "../../shared/hooks/useAuth";
import LoadingScreen from "../../shared/components/LoadingScreen";

const ROLES = ["super-admin", "employer", "job-seeker"];

const ROLE_DESCRIPTIONS = {
  "super-admin": "Full system access: manage employers, accreditations, jobs, users, and settings.",
  employer: "Post jobs, manage applicants, submit accreditation documents.",
  "job-seeker": "Browse jobs, manage profile, submit applications.",
};

function RoleManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message || "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  async function handleAssignRole(user, role) {
    if (role === user.role) return;
    setActionError("");
    setSuccess("");
    setSavingId(user.id);
    try {
      await assignRole(user.id, role);
      const updated = await listUsers();
      setUsers(updated);
      setSuccess(`Role updated to ${role.replace("-", " ")} for ${user.full_name || user.email}.`);
    } catch (err) {
      setActionError(err.message || "Failed to assign role");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6 bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM ADMINISTRATION</p>
        </div>
        <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-dark-blue">Roles</h1>
        <p className="mt-2 text-sm text-gray-500">Roles in the system and what each can do</p>
      </header>

      <section className="bg-white border border-primary rounded-lg p-5">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">System Roles</h2>
          <p className="text-xs text-gray-500 mt-0.5">Roles are enforced by the API's ownership and role checks</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
          {ROLES.map((role) => (
            <div key={role} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-dark-blue capitalize">{role.replace("-", " ")}</h3>
              <p className="text-xs text-gray-500 mt-2">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-primary rounded-lg p-5">
        <div className="border-l-4 border-primary pl-4 mb-4">
          <h2 className="text-lg font-semibold text-dark-blue">Assign Roles ({users.length})</h2>
          <p className="text-xs text-gray-500 mt-0.5">Changing a role takes effect on the user's next session</p>
        </div>
        {success && (
          <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">{success}</div>
        )}
        {actionError && (
          <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 px-4 py-3 rounded-xl">{actionError}</div>
        )}
        {users.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isSelf = currentUser && u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {u.full_name}
                        {isSelf && <span className="ml-2 font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase">You — role locked</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500 break-all">{u.email}</td>
                      <td className="py-3 px-4">
                        {isSelf ? (
                          <span className="text-xs text-gray-500 capitalize">{u.role.replace("-", " ")}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <label htmlFor={`role-${u.id}`} className="sr-only">Role for {u.full_name || u.email}</label>
                            <select
                              id={`role-${u.id}`}
                              value={u.role}
                              disabled={savingId === u.id}
                              onChange={(e) => handleAssignRole(u, e.target.value)}
                              className="min-h-[38px] px-3 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r.replace("-", " ")}</option>
                              ))}
                            </select>
                            {savingId === u.id && <span className="text-[11px] text-gray-400">Saving…</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default RoleManagement;
