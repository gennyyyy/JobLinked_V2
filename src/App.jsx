import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './features/public-site/Landing'
import PublicJobs from './features/public-site/PublicJobs'
import PublicJobDetail from './features/public-site/PublicJobDetail'
import PortalSelect from './features/public-site/PortalSelect'
import ForgotPassword from './features/auth/ForgotPassword'
import ResetPassword from './features/auth/ResetPassword'
import Login from './features/auth/Login'
import Register from './features/auth/Register'
import JobSeekerRegister from './features/auth/JobSeekerRegister'
import EmployerRegister from './features/auth/EmployerRegister'
import EmployerStatus from './features/auth/EmployerStatus'
import ProtectedRoute from './shared/components/ProtectedRoute'
import LoadingScreen from './shared/components/LoadingScreen'
import useAuth from './shared/hooks/useAuth'
import SuperAdminLayout from './features/super-admin/SuperAdminLayout'
import Dashboard from './features/super-admin/Dashboard'
import Accreditation from './features/super-admin/Accreditation'
import JobPosts from './features/super-admin/JobPosts'
import RoleManagement from './features/super-admin/RoleManagement'
import UserManagement from './features/super-admin/UserManagement'
import Settings from './features/super-admin/Settings'
import Reports from './features/super-admin/Reports'
import Logs from './features/super-admin/Logs'
import SuperAdminNotifications from './features/super-admin/Notifications'
import SuperAdminProfile from './features/super-admin/Profile'
import EmployerLayout from './features/employer/EmployerLayout'
import EmployerDashboard from './features/employer/Dashboard'
import EmployerJobPosts from './features/employer/JobPosts'
import Applicants from './features/employer/Applicants'
import Employees from './features/employer/Employees'
import CompanyProfile from './features/employer/CompanyProfile'
import EmployerAccreditation from './features/employer/EmployerAccreditation'
import JobSeekerLayout from './features/job-seeker/JobSeekerLayout'
import JobSeekerDashboard from './features/job-seeker/Dashboard'
import JobDetail from './features/job-seeker/JobDetail'
import Applications from './features/job-seeker/Applications'
import Employment from './features/job-seeker/Employment'
import Profile from './features/job-seeker/Profile'
import Jobs from './features/job-seeker/Jobs'
import NotificationsPage from './shared/components/NotificationsPage'

function App() {
  return (
    <BrowserRouter>
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
        <Route path="/register/job-seeker" element={<PublicRoute><JobSeekerRegister /></PublicRoute>} />
        <Route path="/register/employer" element={<PublicRoute><EmployerRegister /></PublicRoute>} />
        <Route path="/register/employer/status" element={<PublicRoute><EmployerStatus /></PublicRoute>} />

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
    </BrowserRouter>
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
