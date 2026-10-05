import PortalLayout from '../../shared/components/PortalLayout'

const navItems = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/accreditation', label: 'Accreditation' },
  { to: '/super-admin/job-posts', label: 'Job Posts' },
  { to: '/super-admin/roles', label: 'Roles' },
  { to: '/super-admin/users', label: 'Users' },
  { to: '/super-admin/logs', label: 'Logs' },
  { to: '/super-admin/settings', label: 'Settings' },
]

export default function SuperAdminLayout() {
  return (
    <PortalLayout
      navItems={navItems}
      badge="ADMIN"
      eyebrow="PESO · SANTA MARIA"
      subhead="Super Administrator"
      profileTo="/super-admin/profile"
      roleLabel="Super Admin"
    />
  )
}
