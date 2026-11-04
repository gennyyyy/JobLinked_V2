// One loader per route chunk. App.jsx builds its lazy components from this map,
// and links call prefetchRoute() on hover/focus so the chunk is already warm by
// the time the click lands — the Suspense fallback then never appears.
//
// The three portal *index* dashboards share their parent path (/super-admin,
// /employer, /job-seeker), so they stay as inline lazy() calls in App.jsx.
export const routeLoaders = {
  '/': () => import('../../features/public-site/Landing'),
  '/jobs': () => import('../../features/public-site/PublicJobs'),
  '/jobs/:id': () => import('../../features/public-site/PublicJobDetail'),
  '/portals': () => import('../../features/public-site/PortalSelect'),
  '/privacy': () => import('../../features/public-site/Legal'),
  '/terms': () => import('../../features/public-site/Legal'),
  '/forgot-password': () => import('../../features/auth/ForgotPassword'),
  '/reset-password': () => import('../../features/auth/ResetPassword'),
  '/login': () => import('../../features/auth/Login'),
  '/super-admin/login': () => import('../../features/auth/Login'),
  '/employer/login': () => import('../../features/auth/Login'),
  '/job-seeker/login': () => import('../../features/auth/Login'),
  '/register': () => import('../../features/auth/Register'),
  '/signup': () => import('../../features/auth/Register'),
  '/register/job-seeker': () => import('../../features/auth/JobSeekerRegister'),
  '/signup/jobseeker': () => import('../../features/auth/JobSeekerRegister'),
  '/register/employer': () => import('../../features/auth/EmployerRegister'),
  '/signup/employer': () => import('../../features/auth/EmployerRegister'),
  '/employer/status': () => import('../../features/auth/EmployerStatus'),
  '/auth/callback': () => import('../../features/auth/AuthCallback'),
  '/accept-invite': () => import('../../features/auth/AcceptInvite'),
  '/super-admin': () => import('../../features/super-admin/SuperAdminLayout'),
  '/super-admin/accreditation': () => import('../../features/super-admin/Accreditation'),
  '/super-admin/job-posts': () => import('../../features/super-admin/JobPosts'),
  '/super-admin/roles': () => import('../../features/super-admin/RoleManagement'),
  '/super-admin/users': () => import('../../features/super-admin/UserManagement'),
  '/super-admin/settings': () => import('../../features/super-admin/Settings'),
  '/super-admin/broadcast': () => import('../../features/super-admin/Broadcast'),
  '/super-admin/reports': () => import('../../features/super-admin/Reports'),
  '/super-admin/logs': () => import('../../features/super-admin/Logs'),
  '/super-admin/notifications': () => import('../../features/super-admin/Notifications'),
  '/super-admin/profile': () => import('../../features/super-admin/Profile'),
  '/super-admin/employment-tracking': () => import('../../features/super-admin/Employment'),
  '/super-admin/applications': () => import('../../features/super-admin/Applications'),
  '/employer': () => import('../../features/employer/EmployerLayout'),
  '/employer/job-posts': () => import('../../features/employer/JobPosts'),
  '/employer/applicants': () => import('../../features/employer/Applicants'),
  '/employer/employees': () => import('../../features/employer/Employees'),
  '/employer/company': () => import('../../features/employer/CompanyProfile'),
  '/employer/accreditation': () => import('../../features/employer/EmployerAccreditation'),
  '/employer/notifications': () => import('../../shared/components/NotificationsPage'),
  '/job-seeker': () => import('../../features/job-seeker/JobSeekerLayout'),
  '/job-seeker/jobs': () => import('../../features/job-seeker/Jobs'),
  '/job-seeker/jobs/:id': () => import('../../features/job-seeker/JobDetail'),
  '/job-seeker/saved': () => import('../../features/job-seeker/SavedJobs'),
  '/job-seeker/applications': () => import('../../features/job-seeker/Applications'),
  '/job-seeker/employment': () => import('../../features/job-seeker/Employment'),
  '/job-seeker/profile': () => import('../../features/job-seeker/Profile'),
  '/job-seeker/settings': () => import('../../features/job-seeker/Settings'),
  '/job-seeker/notifications': () => import('../../shared/components/NotificationsPage'),
}

const started = new Set()

function loaderFor(href) {
  const path = String(href || '').split('?')[0]
  if (routeLoaders[path]) return routeLoaders[path]
  // A detail link (/jobs/abc, /job-seeker/jobs/abc) warms its :id route.
  return routeLoaders[`${path.replace(/\/[^/]+$/, '')}/:id`]
}

export function prefetchRoute(href) {
  const load = loaderFor(href)
  if (!load || started.has(load)) return
  started.add(load)
  load().catch(() => { /* a failed prefetch just means a normal load later */ })
}
