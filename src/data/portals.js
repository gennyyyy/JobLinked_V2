export const portals = [
  {
    key: 'super-admin',
    name: 'PESO Administrator',
    description: 'Oversee the entire platform, manage employers, and verify accreditations',
    initials: 'SA',
    badgeColor: 'bg-cyan-100 text-cyan-700',
    buttonColor: 'bg-primary hover:bg-primary/90',
    focusRingClass: 'focus:ring-primary',
    checkboxAccentClass: 'accent-primary',
    accentColor: '#0057B8',
    homePath: '/super-admin',
    path: '/super-admin/login',
    fields: [
      { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password' },
    ],
  },
  {
    key: 'employer',
    name: 'Employer',
    description: 'Post job openings and manage applicants for your business',
    initials: 'EM',
    badgeColor: 'bg-cyan-100 text-cyan-700',
    buttonColor: 'bg-primary hover:bg-primary/90',
    focusRingClass: 'focus:ring-primary',
    checkboxAccentClass: 'accent-primary',
    accentColor: '#0057B8',
    homePath: '/employer',
    path: '/employer/login',
    fields: [
      { name: 'email', label: 'Company Email', type: 'email', placeholder: 'Registration email' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password' },
    ],
  },
  {
    key: 'job-seeker',
    name: 'Job Seeker',
    description: 'Browse available jobs and submit applications',
    initials: 'JS',
    badgeColor: 'bg-cyan-100 text-cyan-700',
    buttonColor: 'bg-primary hover:bg-primary/90',
    focusRingClass: 'focus:ring-primary',
    checkboxAccentClass: 'accent-primary',
    accentColor: '#0057B8',
    homePath: '/job-seeker',
    path: '/job-seeker/login',
    fields: [
      { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password' },
    ],
  },
]

export function getPortal(key) {
  return portals.find((portal) => portal.key === key)
}
