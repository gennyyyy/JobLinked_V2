import PortalLayout from '../../shared/components/PortalLayout'

const navItems = [
  { to: '/job-seeker', label: 'Dashboard', end: true },
  { to: '/job-seeker/jobs', label: 'Browse Jobs' },
  { to: '/job-seeker/applications', label: 'My Applications' },
  { to: '/job-seeker/employment', label: 'Employment' },
  { to: '/job-seeker/notifications', label: 'Notifications' },
]

export default function JobSeekerLayout() {
  return (
    <PortalLayout
      navItems={navItems}
      badge="SEEKER"
      eyebrow="PESO · SANTA MARIA"
      subhead={(user) => user?.name || 'Job Seeker'}
      profileTo="/job-seeker/profile"
      roleLabel="Job Seeker"
      homeTo="/job-seeker"
    />
  )
}
