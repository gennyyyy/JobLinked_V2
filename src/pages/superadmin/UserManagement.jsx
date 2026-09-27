import { useState, useEffect } from "react";
import { listUsers, updateUser } from "../../services/admin";
import CustomSelect from "../../components/CustomSelect";
import ConfirmationModal from "../../components/ConfirmationModal";
import LoadingScreen from "../../components/LoadingScreen";

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message || "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-16 text-center text-sm text-danger">{error}</div>;

  async function handleChangeRole(userId, newRole) {
    await updateUser(userId, { role: newRole });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    setSuccess("User role updated");
    setTimeout(() => setSuccess(""), 3000);
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
    <div className="space-y-8 animate-fade-in bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">SYSTEM ADMINISTRATION</p>
        </div>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-dark-blue">User Management</h1>
        <p className="mt-2 text-sm text-gray-500">Manage system users and assign them to roles</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm border-t-4 border-primary">
        <div className="border-l-4 border-primary pl-4 mb-6">
          <h2 className="text-lg font-semibold text-dark-blue">All Users</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filteredUsers.length} total</p>
        </div>

        {success && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg mb-4">{success}</div>
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-gray-500 shrink-0">Filter by role:</span>
            <div className="min-w-[180px]">
              <CustomSelect value={filterRole} onChange={setFilterRole} options={roleOptions} />
            </div>
          </div>
          <div className="flex-1 md:flex-initial">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-4 py-1.5 text-xs bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-400">No users found</p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-4 text-gray-500 font-medium">Name</th>
                    <th className="text-left px-4 py-4 text-gray-500 font-medium">Email</th>
                    <th className="text-left px-4 py-4 text-gray-500 font-medium">Role</th>
                    <th className="text-left px-4 py-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-4 text-gray-500 font-medium">Created</th>
                    <th className="text-right px-4 py-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-4 text-gray-900 font-medium">{user.full_name}</td>
                      <td className="px-4 py-4 text-gray-500">{user.email}</td>
                      <td className="px-4 py-4">
                        <CustomSelect
                          value={user.role}
                          onChange={(newRole) => handleChangeRole(user.id, newRole)}
                          options={roleOptions.filter((r) => r.value !== "all")}
                          className="text-xs"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2 py-1 rounded-full font-medium text-[10px] uppercase border ${
                          user.status === "active" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : user.status === "suspended" ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-gray-100 border-gray-200 text-gray-500"
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-4 text-right space-x-2">
                        <button onClick={() => handleToggleStatus(user)} className="text-xs text-gray-600 hover:text-gray-900">
                          {user.status === "active" ? "Suspend" : "Activate"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(user.id)} className="text-xs text-danger hover:text-danger font-bold" title="Deactivate user">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
    </div>
  );
}

export default UserManagement;
