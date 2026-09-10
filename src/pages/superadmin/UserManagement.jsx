import { useState, useEffect } from 'react';
import { getAllUsers, createUser, updateUser, deleteUser } from '../../data/users';
import { getAllRoles } from '../../data/roles';
import CustomSelect from '../../components/CustomSelect';

function UserManagement() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ 
    firstName: '', 
    middleInitial: '', 
    lastName: '', 
    suffix: '', 
    email: '', 
    roleId: '' 
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  function loadData() {
    const fetchedUsers = getAllUsers();
    const fetchedRoles = getAllRoles();
    setUsers(fetchedUsers);
    setRoles(fetchedRoles);
  }

  function handleCreateUser() {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.roleId) {
      setError('First name, last name, email, and role are required');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Invalid email address');
      return;
    }

    if (users.some((u) => u.email === formData.email)) {
      setError('Email already exists');
      return;
    }

    const fullName = [
      formData.firstName,
      formData.middleInitial && formData.middleInitial.length === 1 ? `${formData.middleInitial}.` : formData.middleInitial,
      formData.lastName,
      formData.suffix
    ].filter(Boolean).join(' ');

    try {
      createUser({
        firstName: formData.firstName,
        middleInitial: formData.middleInitial,
        lastName: formData.lastName,
        suffix: formData.suffix,
        fullName: fullName,
        email: formData.email,
        roleId: formData.roleId,
      });
      loadData();
      setFormData({ firstName: '', middleInitial: '', lastName: '', suffix: '', email: '', roleId: '' });
      setShowCreateForm(false);
      setError('');
      setSuccess('User created successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDeleteUser(userId) {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUser(userId);
      loadData();
      setSuccess('User deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  function handleChangeRole(userId, newRoleId) {
    updateUser(userId, { roleId: newRoleId });
    loadData();
    setSuccess('User role updated');
    setTimeout(() => setSuccess(''), 3000);
  }

  const filteredUsers = users.filter((u) => {
    const matchesRole = filterRole === 'all' || u.roleId === filterRole;
    const matchesSearch = 
      (u.fullName || u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className={`space-y-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          SYSTEM ADMINISTRATION
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          User Management
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Manage system users and assign them to roles
        </p>
      </header>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">All Users</h2>
          <p className="text-xs text-white/45 mt-0.5">
            {filteredUsers.length} {filterRole === 'all' ? 'total' : 'in selected role'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-primary bg-primary/10 border border-primary/20 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-primary bg-primary/10 border border-primary/20 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-2">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g., John"
                className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">Middle Initial</label>
              <input
                type="text"
                value={formData.middleInitial}
                onChange={(e) => setFormData({ ...formData, middleInitial: e.target.value.slice(0, 1).toUpperCase() })}
                placeholder="e.g., M"
                maxLength="1"
                className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="e.g., Doe"
                className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">Suffix</label>
              <input
                type="text"
                value={formData.suffix}
                onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                placeholder="e.g., Jr., Sr., III"
                className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-2">Email Address *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g., john@example.com"
              className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-2">Role *</label>
            <CustomSelect
              value={formData.roleId}
              onChange={(val) => setFormData({ ...formData, roleId: val })}
              options={[
                { value: '', label: 'Select a role...', disabled: true },
                ...roles.map((role) => ({
                  value: role.id,
                  label: role.name,
                })),
              ]}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleCreateUser}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Add User
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ firstName: '', middleInitial: '', lastName: '', suffix: '', email: '', roleId: '' });
                setError('');
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-white/60 shrink-0">Filter by role:</span>
          <div className="min-w-[180px]">
            <CustomSelect
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: 'all', label: 'All Roles' },
                ...roles.map((role) => ({
                  value: role.id,
                  label: role.name,
                })),
              ]}
            />
          </div>
        </div>
        <div className="flex-1 md:flex-initial">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full px-4 py-1.5 text-xs bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-white/[0.02] border border-white/[0.08] rounded-lg">
          <p className="text-white/40">No users found</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-4 text-white/60 font-medium">Name</th>
                  <th className="text-left px-4 py-4 text-white/60 font-medium">Email</th>
                  <th className="text-left px-4 py-4 text-white/60 font-medium">Role</th>
                  <th className="text-left px-4 py-4 text-white/60 font-medium">Status</th>
                  <th className="text-left px-4 py-4 text-white/60 font-medium">Created</th>
                  <th className="text-right px-4 py-4 text-white/60 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const userRole = roles.find((r) => r.id === user.roleId);
                  return (
                    <tr key={user.id} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 text-white font-medium">{user.fullName || user.name}</td>
                      <td className="px-4 py-4 text-white/60">{user.email}</td>
                      <td className="px-4 py-4">
                        <CustomSelect
                          value={user.roleId}
                          onChange={(newRoleId) => handleChangeRole(user.id, newRoleId)}
                          options={roles.map((role) => ({
                            value: role.id,
                            label: role.type === 'custom' ? `${role.name} (Custom)` : role.name,
                          }))}
                          className="text-xs"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-block px-2 py-1 bg-primary/20 text-primary rounded-full font-medium">
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/60">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-white/40 hover:text-primary transition-colors font-bold"
                          title="Delete user"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
