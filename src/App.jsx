import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import PublicJobs from './pages/PublicJobs'
import PublicJobDetail from './pages/PublicJobDetail'
import PortalSelect from './pages/PortalSelect'
import Login from './pages/Login'
import Register from './pages/Register'
import JobSeekerRegister from './pages/JobSeekerRegister'
import EmployerRegister from './pages/EmployerRegister'
import EmployerStatus from './pages/EmployerStatus'
import ProtectedRoute from './components/ProtectedRoute'
import SuperAdminLayout from './layouts/SuperAdminLayout'
import Dashboard from './pages/superadmin/Dashboard'
import Accreditation from './pages/superadmin/Accreditation'
import Employees from './pages/superadmin/Employees'
import JobPosts from './pages/superadmin/JobPosts'
import RoleManagement from './pages/superadmin/RoleManagement'
import UserManagement from './pages/superadmin/UserManagement'
import EmployerLayout from './layouts/EmployerLayout'
import EmployerDashboard from './pages/employer/Dashboard'
import EmployerJobPosts from './pages/employer/JobPosts'
import Applicants from './pages/employer/Applicants'
import CompanyProfile from './pages/employer/CompanyProfile'
import EmployerAccreditation from './pages/employer/EmployerAccreditation'
import JobSeekerLayout from './layouts/JobSeekerLayout'
import Jobs from './pages/job-seeker/Jobs'
import JobDetail from './pages/job-seeker/JobDetail'
import Applications from './pages/job-seeker/Applications'
import Profile from './pages/job-seeker/Profile'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/jobs" element={<PublicJobs />} />
        <Route path="/jobs/:jobId" element={<PublicJobDetail />} />
        <Route path="/portals" element={<PortalSelect />} />
        <Route path="/super-admin/login" element={<Login portalKey="super-admin" />} />
        <Route path="/employer/login" element={<Login portalKey="employer" />} />
        <Route path="/job-seeker/login" element={<Login portalKey="job-seeker" />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/job-seeker" element={<JobSeekerRegister />} />
        <Route path="/register/employer" element={<EmployerRegister />} />
        <Route path="/register/employer/status" element={<EmployerStatus />} />

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
          <Route path="employees" element={<Employees />} />
          <Route path="job-posts" element={<JobPosts />} />
          <Route path="roles" element={<RoleManagement />} />
          <Route path="users" element={<UserManagement />} />
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
          <Route path="company" element={<CompanyProfile />} />
          <Route path="accreditation" element={<EmployerAccreditation />} />
        </Route>

        <Route
          path="/job-seeker"
          element={
            <ProtectedRoute role="job-seeker">
              <JobSeekerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Jobs />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          <Route path="applications" element={<Applications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
