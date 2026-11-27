import TopNavLayout from '@/shared/components/TopNavLayout'

export default function SuperAdminLayout() {
  return (
    <TopNavLayout
      role="super-admin"
      roleLabel="PESO Admin"
      homeTo="/super-admin"
    />
  )
}
