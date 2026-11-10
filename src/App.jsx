import { Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import StaticUrlRouter from './shared/lib/StaticUrlRouter'
import ProtectedRoute from './shared/components/ProtectedRoute'
import LoadingScreen from './shared/components/LoadingScreen'
import ErrorBoundary from './shared/components/ErrorBoundary'
import useAuth from './shared/hooks/useAuth'

import { lazyRoute, routeLoaders } from './shared/lib/routeLoaders'
import usePageTitle from './shared/lib/usePageTitle'

// Route-level code splitting: each page is its own chunk, so a visitor on the
// public site never downloads the admin / employer / seeker bundles. The
// loaders live in shared/lib/routeLoaders.js so links can warm them on hover.
const route = (path) => lazyRoute(routeLoaders[path])

const Landing = route('/')
const PublicJobs = route('/jobs')
const PublicJobDetail = route('/jobs/:id')
const Legal = route('/privacy')
const ForgotPassword = route('/forgot-password')
const ResetPassword = route('/reset-password')
const Login = route('/login')
const Register = route('/register')
const JobSeekerRegister = route('/register/job-seeker')
const EmployerRegister = route('/register/employer')
const EmployerStatus = route('/employer/status')
const CompleteRegistration = route('/complete-registration')
const AuthCallback = route('/auth/callback')
const AcceptInvite = route('/accept-invite')
const SuperAdminLayout = route('/super-admin')
const Accreditation = route('/super-admin/accreditation')
const JobPosts = route('/super-admin/job-posts')
const RoleManagement = route('/super-admin/roles')
const UserManagement = route('/super-admin/users')
const Settings = route('/super-admin/settings')
const Broadcast = route('/super-admin/broadcast')
const Reports = route('/super-admin/reports')
const Logs = route('/super-admin/logs')
const SuperAdminNotifications = route('/super-admin/notifications')
const SuperAdminProfile = route('/super-admin/profile')
const SuperAdminApplications = route('/super-admin/applications')
const SuperAdminEmployment = route('/super-admin/employment-tracking')
const EmployerLayout = route('/employer')
const EmployerJobPosts = route('/employer/job-posts')
const Applicants = route('/employer/applicants')
const Employees = route('/employer/employees')
const CompanyProfile = route('/employer/company')
const EmployerAccreditation = route('/employer/accreditation')
const JobSeekerLayout = route('/job-seeker')
const JobDetail = route('/job-seeker/jobs/:id')
const Applications = route('/job-seeker/applications')
const Employment = route('/job-seeker/employment')
const Profile = route('/job-seeker/profile')
const Jobs = route('/job-seeker/jobs')
const SavedJobs = route('/job-seeker/saved')
const JobSeekerSettings = route('/job-seeker/settings')
const NotificationsPage = route('/job-seeker/notifications')
// The three portal index dashboards share their parent path, so they cannot be
// keyed in routeLoaders — they stay inline.
const Dashboard = lazyRoute(() => import('./features/super-admin/Dashboard'))
const EmployerDashboard = lazyRoute(() => import('./features/employer/Dashboard'))
const JobSeekerDashboard = lazyRoute(() => import('./features/job-seeker/Dashboard'))

// The address bar is intentionally frozen: in-app navigation never rewrites the
// URL, but each navigation still pushes a history entry, so the browser's
// Back/Forward buttons walk through the pages you visited (StaticUrlRouter). The
// router is seeded from the URL the tab was loaded with, so an emailed
// /auth/callback, /reset-password or /complete-registration?role=… link lands on
// the right screen. Trade-off: page URLs are not bookmarkable/shareable.
const entryPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

function App() {
  return (
    <ErrorBoundary>
      <StaticUrlRouter entry={entryPath}>
        <PageTitle />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/jobs" element={<PublicRoute><PublicJobs /></PublicRoute>} />
            <Route path="/jobs/:jobId" element={<PublicRoute><PublicJobDetail /></PublicRoute>} />
            {/* New-design flow aliases for the portal roots. */}
            {/* New-design job-seeker flow: /jobseeker/<reference-section>. */}
            <Route path="/jobseeker" element={<Navigate to="/job-seeker" replace />} />
            <Route path="/jobseeker/dashboard" element={<Navigate to="/job-seeker" replace />} />
            <Route path="/jobseeker/profile" element={<Navigate to="/job-seeker/profile" replace />} />
            <Route path="/jobseeker/recommended" element={<Navigate to="/job-seeker/jobs" replace />} />
            <Route path="/jobseeker/saved" element={<Navigate to="/job-seeker/saved" replace />} />
            <Route path="/jobseeker/applications" element={<Navigate to="/job-seeker/applications" replace />} />
            <Route path="/jobseeker/employment-tracking" element={<Navigate to="/job-seeker/employment" replace />} />
            <Route path="/jobseeker/notifications" element={<Navigate to="/job-seeker/notifications" replace />} />
            <Route path="/jobseeker/settings" element={<Navigate to="/job-seeker/settings" replace />} />
            <Route path="/jobseeker/*" element={<Navigate to="/job-seeker" replace />} />
            {/* New-design admin flow: /admin/<reference-section> maps onto this app. */}
            <Route path="/admin" element={<Navigate to="/super-admin" replace />} />
            <Route path="/admin/dashboard" element={<Navigate to="/super-admin" replace />} />
            <Route path="/admin/profile" element={<Navigate to="/super-admin/profile" replace />} />
            <Route path="/admin/accreditation" element={<Navigate to="/super-admin/accreditation" replace />} />
            <Route path="/admin/users" element={<Navigate to="/super-admin/users" replace />} />
            <Route path="/admin/role-management" element={<Navigate to="/super-admin/roles" replace />} />
            <Route path="/admin/employment-tracking" element={<Navigate to="/super-admin/employment-tracking" replace />} />
            <Route path="/admin/jobs" element={<Navigate to="/super-admin/job-posts" replace />} />
            <Route path="/admin/applications" element={<Navigate to="/super-admin/applications" replace />} />
            <Route path="/admin/reports" element={<Navigate to="/super-admin/reports" replace />} />
            <Route path="/admin/announcements" element={<Navigate to="/super-admin/broadcast" replace />} />
            <Route path="/admin/audit" element={<Navigate to="/super-admin/logs" replace />} />
            <Route path="/admin/notifications" element={<Navigate to="/super-admin/notifications" replace />} />
            <Route path="/admin/settings" element={<Navigate to="/super-admin/settings" replace />} />
            <Route path="/admin/*" element={<Navigate to="/super-admin" replace />} />
            {/* Legal pages are not PublicRoute: portals link here, and a signed-in
                user must not be logged out just for reading the notice. */}
            <Route path="/privacy" element={<Legal title="Privacy notice" document="privacy" />} />
            <Route path="/terms" element={<Legal title="Terms of Use" document="terms" />} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/register/job-seeker" element={<PublicRoute><JobSeekerRegister /></PublicRoute>} />
            <Route path="/register/employer" element={<PublicRoute><EmployerRegister /></PublicRoute>} />
            {/* The only sign-in page: /login signs any role in and forwards to
                that role's workspace, so there is no portal chooser. Not wrapped
                in PublicRoute: that wrapper destroys a session on arrival, which
                raced the post-login redirect and forced a second sign-in. */}
            <Route path="/login" element={<Login />} />
            {/* NOT under PublicRoute: that wrapper destroys the session on
                arrival, and the whole point of this page is to keep the
                existing session alive while provisioning completes. */}
            <Route path="/complete-registration" element={<CompleteRegistration />} />
            <Route path="/signup" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/signup/jobseeker" element={<PublicRoute><JobSeekerRegister /></PublicRoute>} />
            <Route path="/signup/employer" element={<PublicRoute><EmployerRegister /></PublicRoute>} />
            {/* ADR-021 PublicRoute logs out every signed-in user, so the
                accreditation journey lives in the employer portal now; the old
                public URL just forwards into the portal. */}
            <Route path="/register/employer/status" element={<Navigate to="/employer/status" replace />} />

            <Route
              path="/super-admin"
              element={
                <ProtectedRoute role="super-admin">
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="accreditation" element={<Accreditation />} />
              <Route path="job-posts" element={<JobPosts />} />
              <Route path="roles" element={<RoleManagement />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="settings" element={<Settings />} />
              <Route path="broadcast" element={<Broadcast />} />
              <Route path="reports" element={<Reports />} />
              <Route path="logs" element={<Logs />} />
              <Route path="notifications" element={<SuperAdminNotifications />} />
              <Route path="profile" element={<SuperAdminProfile />} />
              <Route path="employment-tracking" element={<SuperAdminEmployment />} />
              <Route path="applications" element={<SuperAdminApplications />} />
            </Route>

            <Route
              path="/employer"
              element={
                <ProtectedRoute role="employer">
                  <EmployerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmployerDashboard />} />
              <Route path="job-posts" element={<EmployerJobPosts />} />
              <Route path="applicants" element={<Applicants />} />
              <Route path="employees" element={<Employees />} />
              <Route path="company" element={<CompanyProfile />} />
              <Route path="accreditation" element={<EmployerAccreditation />} />
              <Route path="status" element={<EmployerStatus />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route
              path="/job-seeker"
              element={
                <ProtectedRoute role="job-seeker">
                  <JobSeekerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<JobSeekerDashboard />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:jobId" element={<JobDetail />} />
              <Route path="saved" element={<SavedJobs />} />
              <Route path="applications" element={<Applications />} />
              <Route path="employment" element={<Employment />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<JobSeekerSettings />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </StaticUrlRouter>
      </ErrorBoundary>
  )
}

export default App

// Route metadata: one place sets document.title from the current path.
function PageTitle() {
  const { pathname } = useLocation()
  usePageTitle(pathname)
  return null
}

// ADR-021 rule 1: a session survives only inside its own portal — destroy it
// on arrival at a public route, then render the page as guest.
function PublicRoute({ children }) {
  const { user, loading, logout } = useAuth()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!loading && user && !done) {
      logout().then(() => setDone(true), () => setDone(true))
    }
  }, [loading, user, done, logout])

  if (loading) return <LoadingScreen />
  if (user && !done) return <LoadingScreen />
  return children
}
