import { useState, useEffect } from 'react';
import { getAllUsers, createUser, updateUser, deleteUser } from '../../data/users';
import { getAllRoles } from '../../data/roles';
import CustomSelect from '../../components/CustomSelect';

function UserManagement() {
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
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    const fetchedUsers = getAllUsers();
    const fetchedRoles = getAllRoles();
    setUsers(fetchedUsers);
    setRoles(fetchedRoles);
  }

  function validate() {
    const e = {};
    if (!formData.firstName?.trim()) e.firstName = "First name is required";
    if (!formData.lastName?.trim()) e.lastName = "Last name is required";
    if (!formData.email?.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = "Invalid email address";
    if (!formData.roleId) e.roleId = "Role is required";
    return e;
  }

  function handleCreateUser() {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

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
      setErrors({});
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
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0057B8] uppercase">
          SYSTEM ADMINISTRATION
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
          User Management
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage system users and assign them to roles
        </p>
      </header>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
          <p className="text-xs text-gray-400 mt-0.5">
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
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => {
                  setFormData({ ...formData, firstName: e.target.value });
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                }}
                placeholder="e.g., John"
                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/50"
              />
              {errors.firstName && <p className="text-danger text-xs mt-1">{errors.firstName}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">Middle Initial</label>
              <input
                type="text"
                value={formData.middleInitial}
                onChange={(e) => setFormData({ ...formData, middleInitial: e.target.value.slice(0, 1).toUpperCase() })}
                placeholder="e.g., M"
                maxLength="1"
                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/50 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => {
                  setFormData({ ...formData, lastName: e.target.value });
                  if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
                }}
                placeholder="e.g., Doe"
                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/50"
              />
              {errors.lastName && <p className="text-danger text-xs mt-1">{errors.lastName}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">Suffix</label>
              <input
                type="text"
                value={formData.suffix}
                onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                placeholder="e.g., Jr., Sr., III"
                className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Email Address *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="e.g., john@example.com"
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/50"
            />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Role *</label>
            <CustomSelect
              value={formData.roleId}
              onChange={(val) => {
                setFormData({ ...formData, roleId: val });
                if (errors.roleId) setErrors((prev) => ({ ...prev, roleId: undefined }));
              }}
              options={[
                { value: '', label: 'Select a role...', disabled: true },
                ...roles.map((role) => ({
                  value: role.id,
                  label: role.name,
                })),
              ]}
            />
            {errors.roleId && <p className="text-danger text-xs mt-1">{errors.roleId}</p>}
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
                setErrors({});
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-gray-500 shrink-0">Filter by role:</span>
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
            className="w-full px-4 py-1.5 text-xs bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-lg focus:outline-none focus:border-primary/50"
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
                {filteredUsers.map((user) => {
                  return (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-gray-900 font-medium">{user.fullName || user.name}</td>
                      <td className="px-4 py-4 text-gray-500">{user.email}</td>
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
                      <td className="px-4 py-4 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-gray-400 hover:text-primary transition-colors font-bold"
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
