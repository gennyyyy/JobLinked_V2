import TopNavLayout from '@/shared/components/TopNavLayout'

export default function SuperAdminLayout() {
  return (
    <TopNavLayout
      role="super-admin"
      profileTo="/super-admin/profile"
      roleLabel="PESO Admin"
      homeTo="/super-admin"
    />
  )
}
