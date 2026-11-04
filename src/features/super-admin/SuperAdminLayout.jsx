import { useLocation } from 'react-router-dom'
import TopNavLayout from '@/shared/components/TopNavLayout'

export default function SuperAdminLayout() {
  const { pathname } = useLocation()
  const fixedContent = ['/super-admin/users', '/super-admin/logs', '/super-admin/roles'].includes(pathname)

  return (
    <TopNavLayout
      role="super-admin"
      profileTo="/super-admin/profile"
      roleLabel="PESO Admin"
      homeTo="/super-admin"
      fixedContent={fixedContent}
    />
  )
}
