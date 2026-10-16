import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './shared/components/ProtectedRoute'
import LoadingScreen from './shared/components/LoadingScreen'
import ErrorBoundary from './shared/components/ErrorBoundary'
import useAuth from './shared/hooks/useAuth'

// Route-level code splitting: each page is its own chunk, so a visitor on the
// public site never downloads the admin / employer / seeker bundles.
const Landing = lazy(() => import('./features/public-site/Landing'))
const PublicJobs = lazy(() => import('./features/public-site/PublicJobs'))
const PublicJobDetail = lazy(() => import('./features/public-site/PublicJobDetail'))
const PortalSelect = lazy(() => import('./features/public-site/PortalSelect'))
const ForgotPassword = lazy(() => import('./features/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./features/auth/ResetPassword'))
const Login = lazy(() => import('./features/auth/Login'))
const Register = lazy(() => import('./features/auth/Register'))
const JobSeekerRegister = lazy(() => import('./features/auth/JobSeekerRegister'))
const EmployerRegister = lazy(() => import('./features/auth/EmployerRegister'))
const EmployerStatus = lazy(() => import('./features/auth/EmployerStatus'))
const AuthCallback = lazy(() => import('./features/auth/AuthCallback'))
const AcceptInvite = lazy(() => import('./features/auth/AcceptInvite'))
const SuperAdminLayout = lazy(() => import('./features/super-admin/SuperAdminLayout'))
const Dashboard = lazy(() => import('./features/super-admin/Dashboard'))
const Accreditation = lazy(() => import('./features/super-admin/Accreditation'))
const JobPosts = lazy(() => import('./features/super-admin/JobPosts'))
const RoleManagement = lazy(() => import('./features/super-admin/RoleManagement'))
const UserManagement = lazy(() => import('./features/super-admin/UserManagement'))
const Settings = lazy(() => import('./features/super-admin/Settings'))
const Broadcast = lazy(() => import('./features/super-admin/Broadcast'))
const Reports = lazy(() => import('./features/super-admin/Reports'))
const Logs = lazy(() => import('./features/super-admin/Logs'))
const SuperAdminNotifications = lazy(() => import('./features/super-admin/Notifications'))
const SuperAdminProfile = lazy(() => import('./features/super-admin/Profile'))
const EmployerLayout = lazy(() => import('./features/employer/EmployerLayout'))
const EmployerDashboard = lazy(() => import('./features/employer/Dashboard'))
const EmployerJobPosts = lazy(() => import('./features/employer/JobPosts'))
const Applicants = lazy(() => import('./features/employer/Applicants'))
const Employees = lazy(() => import('./features/employer/Employees'))
const CompanyProfile = lazy(() => import('./features/employer/CompanyProfile'))
const EmployerAccreditation = lazy(() => import('./features/employer/EmployerAccreditation'))
const JobSeekerLayout = lazy(() => import('./features/job-seeker/JobSeekerLayout'))
const JobSeekerDashboard = lazy(() => import('./features/job-seeker/Dashboard'))
const JobDetail = lazy(() => import('./features/job-seeker/JobDetail'))
const Applications = lazy(() => import('./features/job-seeker/Applications'))
const Employment = lazy(() => import('./features/job-seeker/Employment'))
const Profile = lazy(() => import('./features/job-seeker/Profile'))
const Jobs = lazy(() => import('./features/job-seeker/Jobs'))
const NotificationsPage = lazy(() => import('./shared/components/NotificationsPage'))

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/jobs" element={<PublicRoute><PublicJobs /></PublicRoute>} />
            <Route path="/jobs/:jobId" element={<PublicRoute><PublicJobDetail /></PublicRoute>} />
            <Route path="/portals" element={<PublicRoute><PortalSelect /></PublicRoute>} />
            <Route path="/super-admin/login" element={<Login portalKey="super-admin" />} />
            <Route path="/employer/login" element={<Login portalKey="employer" />} />
            <Route path="/job-seeker/login" element={<Login portalKey="job-seeker" />} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/register/job-seeker" element={<PublicRoute><JobSeekerRegister /></PublicRoute>} />
            <Route path="/register/employer" element={<PublicRoute><EmployerRegister /></PublicRoute>} />
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
              <Route path="notifications" element={<NotificationsPage title="Notifications" subtitle="Reviews, accreditations, and system updates" />} />
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
              <Route path="applications" element={<Applications />} />
              <Route path="employment" element={<Employment />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<NotificationsPage title="Notifications" subtitle="Application updates and system announcements" />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App

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
