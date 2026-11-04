import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/shared/hooks/useAuth'
import TopNavLayout from '@/shared/components/TopNavLayout'
import Dashboard from '@/features/super-admin/Dashboard'
import Accreditation from '@/features/super-admin/Accreditation'
import UserManagement from '@/features/super-admin/UserManagement'
import Reports from '@/features/super-admin/Reports'
import JobPosts from '@/features/super-admin/JobPosts'
import Applications from '@/features/super-admin/Applications'
import Employment from '@/features/super-admin/Employment'
import Broadcast from '@/features/super-admin/Broadcast'
import Logs from '@/features/super-admin/Logs'
import Profile from '@/features/super-admin/Profile'
import AccountSettings from '@/shared/components/AccountSettings'
import RoleManagement from '@/features/super-admin/RoleManagement'
import EmployerDashboard from '@/features/employer/Dashboard'
import EmployerJobPosts from '@/features/employer/JobPosts'
import EmployerApplicants from '@/features/employer/Applicants'
import EmployerCompany from '@/features/employer/CompanyProfile'
import EmployerAccreditation from '@/features/employer/EmployerAccreditation'
import EmployerEmployees from '@/features/employer/Employees'
import { api } from '@/shared/lib/api'
import '@/index.css'

const user = { id: 'admin-1', full_name: 'Gabriel Mendoza', name: 'Gabriel Mendoza', email: 'admin@demo.joblinked.ph', role: 'super-admin' }
const now = Date.now()
const applications = Array.from({ length: 10 }, (_, i) => ({
  id: `a${i}`,
  status: i === 0 ? 'Placed' : i % 3 === 0 ? 'Accepted' : 'Pending',
  applied_at: new Date(now - (i % 14) * 86400000).toISOString(),
  referred_by: i < 4 ? 'staff-1' : null,
  seeker: { full_name: 'Maria Santos', barangay_district: 'Bagbaguin', email: 'maria@example.test' },
  job: { title: 'Administrative Assistant', employment_type: 'Full-time', employers: { company_name: 'Northfield Business Solutions' } },
}))
const jobs = Array.from({ length: 6 }, (_, i) => ({
  id: `j${i}`,
  title: i % 2 ? 'Administrative Assistant' : 'Warehouse Associate',
  status: ['published', 'draft', 'closed', 'published', 'published', 'pending'][i],
  location: 'Poblacion',
  employment_type: 'Full-time',
  vacancies: 2,
  deadline: '2026-12-31',
  remarks: i === 3 ? 'Duplicate of an existing posting.' : null,
  description: 'Support the daily operations of a local business.',
  requirements: 'At least 1 year of experience.\nWilling to work on-site.',
  created_at: new Date(now - i * 86400000).toISOString(),
  employers: { company_name: 'Northfield Business Solutions', accreditation_status: 'approved' },
}))
const MOCKS = {
  'admin/stats': { seekers: 8, employers: 6, pendingAccreditations: 2, jobs: 41, applications: 10, accreditedEmployers: 4, placedApplicants: 1, pendingJobs: 3, acceptedApplicants: 2 },
  'admin/accreditations': { data: [
    { id: 'acc1', status: 'pending', submitted_at: '2026-10-16T00:00:00Z', employers: { company_name: 'Alaga Community Pharmacy', barangay_district: 'Bagbaguin', industry: 'Healthcare' } },
    { id: 'acc2', status: 'pending', submitted_at: '2026-10-16T00:00:00Z', employers: { company_name: 'Lakbay Logistics', barangay_district: 'Cay Pombo', industry: 'Logistics' } },
    { id: 'acc3', status: 'approved', submitted_at: '2026-09-23T00:00:00Z', employers: { company_name: 'Northfield Business Solutions', barangay_district: 'Poblacion', industry: 'Business Services' } },
  ], total: 3, page: 1, pageSize: 100 },
  'admin/applications': { data: applications, total: applications.length, page: 1, pageSize: 500 },
  'admin/employees': applications.slice(0, 4),
  'admin/jobs': { data: jobs, total: jobs.length, page: 1, pageSize: 500 },
  'admin/users': { data: [
    { id: 'u1', full_name: 'Maria Santos', email: 'maria@example.test', role: 'job-seeker', status: 'active', created_at: '2026-01-05T00:00:00Z' },
    { id: 'u2', full_name: 'Northfield Business', email: 'hr@northfield.test', role: 'employer', status: 'active', created_at: '2026-01-06T00:00:00Z' },
    { id: 'u3', full_name: 'Gabriel Mendoza', email: 'admin@demo.joblinked.ph', role: 'super-admin', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  ], total: 3, page: 1, pageSize: 25 },
  'admin/roles': [],
  'admin/permissions': [],
  'admin/audit-logs': [
    { id: 'log1', action: 'accreditation.approved', entity: 'accreditations', entity_id: 'acc3', actor_name: 'Gabriel Mendoza', created_at: '2026-09-24T12:00:00Z' },
    { id: 'log2', action: 'job.publish', entity: 'job_vacancies', entity_id: 'j1', actor_name: 'Andrea Reyes', created_at: '2026-10-17T12:00:00Z' },
  ],
  'applications/a1/history': [
    { status: 'Applied', changed_at: '2026-01-05T00:00:00Z', remarks: null },
    { status: 'Placed', changed_at: '2026-02-01T00:00:00Z', remarks: 'Started on the 1st.' },
  ],
  'notifications/mine': [{ id: 'n1', is_read: false, title: 'Job fair', message: 'Saturday at the plaza', type: 'system', created_at: '2026-10-17T12:00:00Z' }],
}
api.get = async (path) => {
  const key = Object.keys(MOCKS).sort((a, b) => b.length - a.length).find((candidate) => String(path).includes(candidate))
  return key ? MOCKS[key] : []
}
api.post = async () => ({})
api.patch = async () => ({})
api.del = async () => ({})

const path = new URLSearchParams(window.location.search).get('page') || '/super-admin'
const isEmployer = path.startsWith('/employer')
const activeUser = isEmployer
  ? { id: 'company-1', full_name: 'Maria Santos', name: 'Maria Santos', email: 'employer@demo.joblinked.ph', role: 'employer' }
  : user

const employerApplications = applications.map((application, index) => ({
  ...application,
  id: `ea${index}`,
  status: ['Under Review', 'Interview', 'Accepted', 'Applied', 'Rejected', 'Applied', 'Under Review', 'Accepted', 'Applied', 'Rejected'][index],
  employer_notes: index === 1 ? 'Strong portfolio.' : null,
  interview_at: index === 1 ? '2026-11-12T10:00:00.000Z' : null,
  job: { id: index < 5 ? 'j1' : 'j2', title: index < 5 ? 'Administrative Assistant' : 'Warehouse Associate' },
}))
const employerMocks = {
  'applications/employers/me/dashboard': {
    jobs: [
      { id: 'j1', title: 'Administrative Assistant', status: 'published', location: 'Poblacion', vacancies: 2, applicants: 6 },
      { id: 'j2', title: 'Warehouse Associate', status: 'published', location: 'Bagbaguin', vacancies: 1, applicants: 3 },
      { id: 'j3', title: 'Cashier', status: 'draft', location: 'Poblacion', vacancies: 1, applicants: 0 },
    ],
    stats: { total_candidates: 9, new_this_week: 4, shortlisted: 3, placements: 1 },
    recent: employerApplications.slice(0, 5),
  },
  'applications/company/': employerApplications,
  'employers/company-1/jobs': {
    data: [
      { id: 'j1', title: 'Administrative Assistant', status: 'published', location: 'Poblacion', vacancies: 2, employment_type: 'Full-time', applicant_count: 6, deadline: '2026-12-31', created_at: '2026-10-01T00:00:00Z' },
      { id: 'j2', title: 'Warehouse Associate', status: 'published', location: 'Bagbaguin', vacancies: 1, employment_type: 'Full-time', applicant_count: 3, deadline: '2026-12-15', created_at: '2026-09-20T00:00:00Z' },
      { id: 'j3', title: 'Cashier', status: 'draft', location: 'Poblacion', vacancies: 1, employment_type: 'Part-time', applicant_count: 0, deadline: null, created_at: '2026-09-10T00:00:00Z' },
    ],
    total: 3,
    page: 1,
    pageSize: 25,
  },
  'documents/company/': [
    { id: 'd1', doc_type: 'Business Permit', file_name: 'permit.pdf', status: 'verified' },
    { id: 'd2', doc_type: 'SEC Registration', file_name: 'sec.pdf', status: 'pending' },
  ],
  'accreditations/company/': [
    { id: 'acc1', status: 'approved', submitted_at: '2026-01-05T00:00:00Z', decided_at: '2026-01-09T00:00:00Z', remarks: 'Documents verified.' },
    { id: 'acc2', status: 'pending', submitted_at: '2025-11-02T00:00:00Z', remarks: null },
  ],
  'seekers/me/education': [],
  'seekers/me/experience': [],
  'employers/me': {
    id: 'company-1',
    company_name: 'Northfield Business Solutions',
    accreditation_status: 'approved',
    industry: 'Business Services',
    barangay_district: 'Poblacion',
    city_municipality: 'Santa Maria',
    province_state: 'Bulacan',
    postal_code: '3022',
    company_email: 'hr@northfield.test',
    phone: '0917 000 0000',
    website: 'https://northfield.test',
    description: 'A local business services company.',
    first_name: 'Maria',
    last_name: 'Santos',
    email: 'employer@demo.joblinked.ph',
  },
}
const baseGet = api.get
api.get = async (requestPath) => {
  if (isEmployer) {
    const key = Object.keys(employerMocks).sort((a, b) => b.length - a.length).find((candidate) => String(requestPath).includes(candidate))
    if (key) return employerMocks[key]
  }
  return baseGet(requestPath)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthContext.Provider value={{ user: activeUser, logout: () => {}, refreshUser: async () => activeUser }}>
      {isEmployer ? (
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/employer" element={<TopNavLayout role="employer" profileTo="/employer/company" roleLabel="Employer" homeTo="/employer" />}>
              <Route index element={<EmployerDashboard />} />
              <Route path="job-posts" element={<EmployerJobPosts />} />
              <Route path="applicants" element={<EmployerApplicants />} />
              <Route path="company" element={<EmployerCompany />} />
              <Route path="accreditation" element={<EmployerAccreditation />} />
              <Route path="employees" element={<EmployerEmployees />} />
            </Route>
          </Routes>
        </MemoryRouter>
      ) : (
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/super-admin" element={<TopNavLayout role="super-admin" profileTo="/super-admin/profile" roleLabel="PESO Admin" homeTo="/super-admin" />}>
            <Route index element={<Dashboard />} />
            <Route path="accreditation" element={<Accreditation />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="roles" element={<RoleManagement />} />
            <Route path="employment-tracking" element={<Employment />} />
            <Route path="job-posts" element={<JobPosts />} />
            <Route path="applications" element={<Applications />} />
            <Route path="reports" element={<Reports />} />
            <Route path="broadcast" element={<Broadcast />} />
            <Route path="logs" element={<Logs />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>
        </Routes>
      </MemoryRouter>
      )}
    </AuthContext.Provider>
  </StrictMode>,
)
