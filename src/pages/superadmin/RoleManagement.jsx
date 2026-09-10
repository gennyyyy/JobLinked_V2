import { useState } from 'react';
import { PREDEFINED_ROLES, AVAILABLE_PERMISSIONS, getCustomRoles, createCustomRole, deleteCustomRole } from '../../data/roles';

function RoleManagement() {
  const [roles, setRoles] = useState(() => [...PREDEFINED_ROLES, ...getCustomRoles()]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] });
  const [error, setError] = useState('');

  function loadRoles() {
    setRoles([...PREDEFINED_ROLES, ...getCustomRoles()]);
  }

  function handleCreateRole() {
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }
    if (formData.permissions.length === 0) {
      setError('Select at least one permission');
      return;
    }
    
    try {
      createCustomRole({
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
      });
      loadRoles();
      setFormData({ name: '', description: '', permissions: [] });
      setShowCreateForm(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDeleteRole(roleId) {
    if (window.confirm('Are you sure you want to delete this role?')) {
      deleteCustomRole(roleId);
      loadRoles();
    }
  }

  function handleTogglePermission(permId) {
    setFormData({
      ...formData,
      permissions: formData.permissions.includes(permId)
        ? formData.permissions.filter((p) => p !== permId)
        : [...formData.permissions, permId],
    });
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#0075A2] uppercase">
          SYSTEM ADMINISTRATION
        </p>
        <h1 className="mt-1 font-sans text-2xl md:text-3xl font-bold tracking-tight text-white">
          Role Management
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Create custom roles and manage system permissions
        </p>
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">All Roles</h2>
          <p className="text-xs text-white/45 mt-0.5">
            {roles.length} total ({PREDEFINED_ROLES.length} predefined, {getCustomRoles().length} custom)
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ Create Role'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-primary bg-primary/10 border border-primary/20 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-2">Role Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Content Moderator"
              className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose of this role"
              rows={2}
              className="w-full px-4 py-2.5 text-sm bg-[#272727] border border-white/[0.08] text-white placeholder:text-white/30 rounded-lg focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-3">Permissions *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label key={perm.id} className="flex items-start gap-3 p-3 bg-[#272727] border border-white/[0.08] rounded-lg cursor-pointer hover:border-white/[0.12] transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.id)}
                    onChange={() => handleTogglePermission(perm.id)}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-white">{perm.label}</p>
                    <p className="text-[11px] text-white/50">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleCreateRole}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Create Role
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ name: '', description: '', permissions: [] });
                setError('');
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-5 hover:border-white/[0.12] transition-colors group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{role.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    role.type === 'predefined'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-white/[0.1] text-white/60'
                  }`}>
                    {role.type === 'predefined' ? 'Predefined' : 'Custom'}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1">{role.description}</p>
              </div>
              {role.type === 'custom' && (
                <button
                  onClick={() => handleDeleteRole(role.id)}
                  className="text-white/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete role"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-xs text-white/60 mb-2">Permissions ({role.permissions.length})</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((permId) => {
                  const perm = AVAILABLE_PERMISSIONS.find((p) => p.id === permId);
                  return (
                    <span
                      key={permId}
                      className="text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-full"
                    >
                      {perm?.label || permId}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoleManagement;
