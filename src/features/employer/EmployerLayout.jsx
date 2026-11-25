import TopNavLayout from '@/shared/components/TopNavLayout'

export default function EmployerLayout() {
  return (
    <TopNavLayout
      role="employer"
      profileTo="/employer/company"
      roleLabel="Employer"
      homeTo="/employer"
    />
  )
}
