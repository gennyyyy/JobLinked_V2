import TopNavLayout from '../../shared/components/TopNavLayout'
import { useLocation } from 'react-router-dom'

const navItems = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/accreditation', label: 'Accreditation' },
  { to: '/super-admin/job-posts', label: 'Job Posts' },
  { to: '/super-admin/notifications', label: 'Notifications' },
  {
    label: 'Administration',
    children: [
      { to: '/super-admin/users', label: 'Users' },
      { to: '/super-admin/roles', label: 'Roles' },
      { to: '/super-admin/reports', label: 'Reports' },
    ],
  },
  {
    label: 'System',
    children: [
      { to: '/super-admin/logs', label: 'Logs' },
      { to: '/super-admin/settings', label: 'Settings' },
      { to: '/super-admin/broadcast', label: 'Broadcast' },
    ],
  },
]

export default function SuperAdminLayout() {
  const { pathname } = useLocation()
  const fixedContent = ['/super-admin/users', '/super-admin/logs', '/super-admin/roles'].includes(pathname)

  return (
    <TopNavLayout
      navItems={navItems}
      profileTo="/super-admin/profile"
      roleLabel="Super Admin"
      homeTo="/super-admin"
      fixedContent={fixedContent}
    />
  )
}
