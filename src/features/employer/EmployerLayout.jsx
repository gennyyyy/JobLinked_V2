import PortalLayout from '../../shared/components/PortalLayout'

const navItems = [
  { to: '/employer', label: 'Dashboard', end: true },
  { to: '/employer/job-posts', label: 'Job Posts' },
  { to: '/employer/applicants', label: 'Applicants' },
  { to: '/employer/employees', label: 'Employees' },
  { to: '/employer/accreditation', label: 'Accreditation' },
]

export default function EmployerLayout() {
  return (
    <PortalLayout
      navItems={navItems}
      badge="EMPLOYER"
      eyebrow="SANTA MARIA, BULACAN"
      subhead={(user) => user?.company_name || 'My Company'}
      profileTo="/employer/company"
      roleLabel="Employer"
    />
  )
}
