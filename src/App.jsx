import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import PublicJobs from './pages/PublicJobs'
import PublicJobDetail from './pages/PublicJobDetail'
import PortalSelect from './pages/PortalSelect'
import Login from './pages/Login'
import Register from './pages/Register'
import EmployerRegister from './pages/EmployerRegister'
import EmployerStatus from './pages/EmployerStatus'
import ProtectedRoute from './components/ProtectedRoute'
import SuperAdminLayout from './layouts/SuperAdminLayout'
import Dashboard from './pages/superadmin/Dashboard'
import Accreditation from './pages/superadmin/Accreditation'
import JobPosts from './pages/superadmin/JobPosts'
import RoleManagement from './pages/superadmin/RoleManagement'
import UserManagement from './pages/superadmin/UserManagement'
import EmployerLayout from './layouts/EmployerLayout'
import EmployerDashboard from './pages/employer/Dashboard'
import EmployerJobPosts from './pages/employer/JobPosts'
import Applicants from './pages/employer/Applicants'

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
        <Route path="/register" element={<Register />} />
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
