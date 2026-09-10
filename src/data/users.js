export function getMockUsers() {
  return [
    {
      id: 'user-1',
      name: 'Maria Santos',
      email: 'maria.santos@peso.gov.ph',
      roleId: 'super-admin',
      status: 'active',
      createdAt: '2026-01-15T10:30:00Z',
    },
    {
      id: 'user-2',
      name: 'Juan dela Cruz',
      email: 'juan.delacruz@empresa.com',
      roleId: 'employer',
      status: 'active',
      createdAt: '2026-02-20T14:22:00Z',
    },
    {
      id: 'user-3',
      name: 'Anna Garcia',
      email: 'anna.garcia@gmail.com',
      roleId: 'job-seeker',
      status: 'active',
      createdAt: '2026-03-10T09:15:00Z',
    },
    {
      id: 'user-4',
      name: 'Carlos Reyes',
      email: 'carlos.reyes@company.com',
      roleId: 'employer',
      status: 'active',
      createdAt: '2026-03-18T11:45:00Z',
    },
    {
      id: 'user-5',
      name: 'Rosa Fernandez',
      email: 'rosa.fernandez@email.com',
      roleId: 'job-seeker',
      status: 'active',
      createdAt: '2026-04-05T16:30:00Z',
    },
    {
      id: 'user-6',
      name: 'Miguel Torres',
      email: 'miguel.torres@organization.com',
      roleId: 'employer',
      status: 'active',
      createdAt: '2026-04-12T13:20:00Z',
    },
    {
      id: 'user-7',
      name: 'Sofia Diaz',
      email: 'sofia.diaz@example.com',
      roleId: 'job-seeker',
      status: 'active',
      createdAt: '2026-05-08T10:00:00Z',
    },
    {
      id: 'user-8',
      name: 'Roberto Mendoza',
      email: 'roberto.mendoza@admin.gov.ph',
      roleId: 'super-admin',
      status: 'active',
      createdAt: '2026-05-15T08:45:00Z',
    },
  ];
}

export function getAllUsers() {
  try {
    const stored = localStorage.getItem('joblinked_users');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Fall through to mock data
  }
  return getMockUsers();
}

export function createUser(userData) {
  const users = getAllUsers();
  const newUser = {
    id: `user-${Date.now()}`,
    ...userData,
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  users.push(newUser);
  localStorage.setItem('joblinked_users', JSON.stringify(users));
  return newUser;
}

export function updateUser(userId, updates) {
  const users = getAllUsers();
  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex === -1) throw new Error('User not found');
  
  users[userIndex] = { ...users[userIndex], ...updates };
  localStorage.setItem('joblinked_users', JSON.stringify(users));
  return users[userIndex];
}

export function deleteUser(userId) {
  const users = getAllUsers();
  const filtered = users.filter((u) => u.id !== userId);
  localStorage.setItem('joblinked_users', JSON.stringify(filtered));
}

export function getUserById(userId) {
  return getAllUsers().find((u) => u.id === userId);
}

export function getUsersByRole(roleId) {
  return getAllUsers().filter((u) => u.roleId === roleId);
}
