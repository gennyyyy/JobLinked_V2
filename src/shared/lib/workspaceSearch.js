import { PORTAL_NAV } from '../constants'

const PASSWORD_KEYWORDS = ['password', 'change password', 'security', 'credentials']

// ponytail: hand-maintained index — a new settings section needs one line here.
// Upgrade path: generate these from the rendered section headings if it ever drifts.
export const WORKSPACE_SECTIONS = [
  { title: 'Password settings', path: '/job-seeker/profile', sectionId: 'password-settings', keywords: PASSWORD_KEYWORDS, roles: ['job-seeker'] },
  { title: 'Personal & contact details', path: '/job-seeker/profile', sectionId: 'personal-details', keywords: ['name', 'phone', 'address', 'birthdate', 'contact', 'email'], roles: ['job-seeker'] },
  { title: 'Skills & competencies', path: '/job-seeker/profile', sectionId: 'skills', keywords: ['skills', 'competencies', 'tags'], roles: ['job-seeker'] },
  { title: 'Experience', path: '/job-seeker/profile', sectionId: 'experience', keywords: ['work history', 'jobs', 'employment'], roles: ['job-seeker'] },
  { title: 'Education', path: '/job-seeker/profile', sectionId: 'education', keywords: ['school', 'course', 'training', 'vocational'], roles: ['job-seeker'] },
  { title: 'My resumes', path: '/job-seeker/profile', sectionId: 'resumes', keywords: ['resume', 'cv', 'upload', 'pdf', 'docx'], roles: ['job-seeker'] },
  { title: 'Account overview', path: '/job-seeker/profile', sectionId: 'account-overview', keywords: ['account', 'email', 'name', 'workspace'], roles: ['job-seeker'] },
  { title: 'Notification preferences', path: '/job-seeker/profile', sectionId: 'notification-preferences', keywords: ['notifications', 'alerts', 'updates', 'announcements'], roles: ['job-seeker'] },
  { title: 'Privacy', path: '/job-seeker/profile', sectionId: 'privacy', keywords: ['privacy', 'data', 'terms'], roles: ['job-seeker'] },

  { title: 'Password settings', path: '/employer/company', sectionId: 'password-settings', keywords: PASSWORD_KEYWORDS, roles: ['employer'] },
  { title: 'Company details', path: '/employer/company', sectionId: 'company-details', keywords: ['company', 'business', 'industry', 'description'], roles: ['employer'] },
  { title: 'Contact & location', path: '/employer/company', sectionId: 'contact-location', keywords: ['address', 'barangay', 'contact', 'phone', 'location'], roles: ['employer'] },
  { title: 'Authorized representative', path: '/employer/company', sectionId: 'authorized-representative', keywords: ['representative', 'contact person', 'signatory'], roles: ['employer'] },

  { title: 'Password settings', path: '/super-admin/profile', sectionId: 'password-settings', keywords: PASSWORD_KEYWORDS, roles: ['super-admin'] },
  { title: 'Personal details', path: '/super-admin/profile', sectionId: 'personal-details', keywords: ['name', 'email', 'profile'], roles: ['super-admin'] },
  { title: 'Administrator access', path: '/super-admin/profile', sectionId: 'administrator-access', keywords: ['role', 'access', 'permissions'], roles: ['super-admin'] },
  { title: 'Account overview', path: '/super-admin/settings', sectionId: 'account-overview', keywords: ['account', 'email', 'workspace'], roles: ['super-admin'] },
  { title: 'Notification preferences', path: '/super-admin/settings', sectionId: 'notification-preferences', keywords: ['notifications', 'alerts', 'updates'], roles: ['super-admin'] },
  { title: 'Privacy', path: '/super-admin/settings', sectionId: 'privacy', keywords: ['privacy', 'data', 'terms'], roles: ['super-admin'] },
]

function scoreOf(entry, q) {
  const title = entry.title.toLowerCase()
  if (title === q) return 4
  if (title.startsWith(q)) return 3
  if (title.includes(q)) return 2
  if (entry.keywords.some((keyword) => keyword.includes(q))) return 1
  return 0
}

export function searchWorkspace(query, role) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return []

  const pages = PORTAL_NAV[role] || []
  const candidates = [
    ...pages.map((item) => ({ title: item.label, subtitle: 'Workspace page', href: item.path, keywords: [] })),
    ...WORKSPACE_SECTIONS
      .filter((section) => section.roles.includes(role))
      .map((section) => ({
        title: section.title,
        subtitle: `in ${pages.find((item) => item.path === section.path)?.label ?? 'Workspace'}`,
        href: `${section.path}#${section.sectionId}`,
        keywords: section.keywords,
      })),
  ]

  return candidates
    .map((entry) => ({ entry, score: scoreOf(entry, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .map(({ entry: { title, subtitle, href } }) => ({ title, subtitle, href }))
}
