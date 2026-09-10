export const PREDEFINED_ROLES = [
  {
    id: 'super-admin',
    name: 'PESO Administrator',
    description: 'Full system access, manage all users and roles',
    type: 'predefined',
    permissions: ['manage-roles', 'manage-users', 'manage-employers', 'manage-jobs', 'view-reports'],
    readonly: true,
  },
  {
    id: 'employer',
    name: 'Employer',
    description: 'Post jobs, manage applicants, view applications',
    type: 'predefined',
    permissions: ['post-jobs', 'manage-applicants', 'view-applications'],
    readonly: true,
  },
  {
    id: 'job-seeker',
    name: 'Job Seeker',
    description: 'Browse jobs, apply to positions, manage profile',
    type: 'predefined',
    permissions: ['browse-jobs', 'apply-jobs', 'manage-profile'],
    readonly: true,
  },
];

export const AVAILABLE_PERMISSIONS = [
  { id: 'manage-roles', label: 'Manage Roles', description: 'Create and edit roles' },
  { id: 'manage-users', label: 'Manage Users', description: 'Add and remove users' },
  { id: 'manage-employers', label: 'Manage Employers', description: 'Approve/reject employers' },
  { id: 'manage-jobs', label: 'Manage Jobs', description: 'Moderate job postings' },
  { id: 'view-reports', label: 'View Reports', description: 'Access analytics and reports' },
  { id: 'post-jobs', label: 'Post Jobs', description: 'Create job postings' },
  { id: 'manage-applicants', label: 'Manage Applicants', description: 'Review job applications' },
  { id: 'view-applications', label: 'View Applications', description: 'View own applications' },
  { id: 'browse-jobs', label: 'Browse Jobs', description: 'Search and view jobs' },
  { id: 'apply-jobs', label: 'Apply to Jobs', description: 'Submit job applications' },
  { id: 'manage-profile', label: 'Manage Profile', description: 'Edit own profile information' },
];

export function getCustomRoles() {
  try {
    const stored = localStorage.getItem('joblinked_custom_roles');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getAllRoles() {
  return [...PREDEFINED_ROLES, ...getCustomRoles()];
}

export function createCustomRole(role) {
  const customRoles = getCustomRoles();
  const newRole = {
    id: `custom-${Date.now()}`,
    ...role,
    type: 'custom',
    readonly: false,
    createdAt: new Date().toISOString(),
  };
  customRoles.push(newRole);
  localStorage.setItem('joblinked_custom_roles', JSON.stringify(customRoles));
  return newRole;
}

export function updateCustomRole(roleId, updates) {
  const customRoles = getCustomRoles();
  const roleIndex = customRoles.findIndex((r) => r.id === roleId);
  if (roleIndex === -1) throw new Error('Role not found');
  
  customRoles[roleIndex] = { ...customRoles[roleIndex], ...updates };
  localStorage.setItem('joblinked_custom_roles', JSON.stringify(customRoles));
  return customRoles[roleIndex];
}

export function deleteCustomRole(roleId) {
  const customRoles = getCustomRoles();
  const filtered = customRoles.filter((r) => r.id !== roleId);
  localStorage.setItem('joblinked_custom_roles', JSON.stringify(filtered));
}

export function getRoleById(roleId) {
  return getAllRoles().find((r) => r.id === roleId);
}
