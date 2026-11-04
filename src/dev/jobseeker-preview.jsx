import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/shared/hooks/useAuth'
import TopNavLayout from '@/shared/components/TopNavLayout'
import Dashboard from '@/features/job-seeker/Dashboard'
import Jobs from '@/features/job-seeker/Jobs'
import Applications from '@/features/job-seeker/Applications'
import Employment from '@/features/job-seeker/Employment'
import Profile from '@/features/job-seeker/Profile'
import SavedJobs from '@/features/job-seeker/SavedJobs'
import Settings from '@/features/job-seeker/Settings'
import { api } from '@/shared/lib/api'
import '@/index.css'

const user = {
  id: 'seeker-1',
  full_name: 'Maria Santos',
  name: 'Maria Santos',
  first_name: 'Maria',
  email: 'maria@demo.joblinked.ph',
  role: 'job-seeker',
  phone: '0917 000 0000',
  barangay_district: 'Bagbaguin',
  street_address: '12 Mabini Street',
  city_municipality: 'Santa Maria',
  province_state: 'Bulacan',
  headline: 'Customer service professional',
  skills: ['Microsoft Office', 'Communication', 'Organization'],
  preferred_position: 'Customer Service',
  preferred_location: 'Poblacion',
  education: 'Senior High School',
  experience: '2 years in retail',
}

const jobs = [
  {
    id: 'j1',
    title: 'Administrative Assistant',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    location: 'Poblacion',
    salary_min: 18000,
    salary_max: 22000,
    vacancies: 2,
    deadline: '2026-12-31',
    created_at: '2026-10-18T00:00:00Z',
    tags: ['Administration', 'Entry level'],
    description: 'Support the office with Microsoft Office, Communication, and Organization.',
    requirements: 'Microsoft Office. Communication. Organization.',
    employers: { company_name: 'Northfield Business Solutions', accreditation_status: 'approved' },
  },
  {
    id: 'j2',
    title: 'Warehouse Associate',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    location: 'Bagbaguin',
    salary_min: 14000,
    salary_max: 16000,
    vacancies: 1,
    deadline: '2026-12-15',
    created_at: '2026-09-20T00:00:00Z',
    tags: ['Logistics', 'Entry level'],
    description: 'Handle inbound stock and inventory records. MS Office and Communication.',
    requirements: 'Warehouse or logistics experience. Communication.',
    employers: { company_name: 'Lakbay Logistics', accreditation_status: 'approved' },
  },
  {
    id: 'j3',
    title: 'Cashier',
    employment_type: 'Part-time',
    work_arrangement: 'On-site',
    location: 'Poblacion',
    salary_min: 12000,
    salary_max: 14000,
    vacancies: 1,
    deadline: '2026-11-30',
    created_at: '2026-09-10T00:00:00Z',
    tags: ['Retail', 'Entry level'],
    description: 'Handle payments and customer inquiries. Customer Service.',
    requirements: 'Customer Service and Communication.',
    employers: { company_name: 'Alaga Community Pharmacy', accreditation_status: 'approved' },
  },
]

const applications = [
  { id: 'a1', status: 'Under Review', applied_at: '2026-10-05T00:00:00Z', job: { id: 'j1', title: 'Customer Service Associate', employers: { company_name: 'Northfield Business Solutions' } }, seeker: { full_name: 'Maria Santos', barangay_district: 'Bagbaguin' } },
  { id: 'a2', status: 'Interview', applied_at: '2026-09-28T00:00:00Z', job: { id: 'j2', title: 'Warehouse Associate', employers: { company_name: 'Lakbay Logistics' } }, seeker: { full_name: 'Maria Santos', barangay_district: 'Bagbaguin' } },
  { id: 'a3', status: 'Rejected', applied_at: '2026-09-12T00:00:00Z', job: { id: 'j3', title: 'Cashier', employers: { company_name: 'Alaga Community Pharmacy' } }, seeker: { full_name: 'Maria Santos', barangay_district: 'Bagbaguin' } },
]

const MOCKS = {
  'applications/mine': applications,
  'seekers/me/employment': [
    { id: 'e1', employer_name: 'Northfield Business Solutions', position: 'Customer Service Associate', start_date: '2026-02-01', is_current: true },
    { id: 'e2', employer_name: 'Lakbay Logistics', position: 'Warehouse Associate', start_date: '2024-01-15', end_date: '2025-12-31', is_current: false },
  ],
  'seekers/me/education': [],
  'seekers/me/experience': [],
  'files/resumes/mine': [],
  'notifications/mine': [
    { id: 'n1', is_read: false, title: 'You have an interview coming up', type: 'application', created_at: '2026-10-17T00:00:00Z' },
    { id: 'n2', is_read: false, title: 'Your application is under review', type: 'application', created_at: '2026-10-16T00:00:00Z' },
  ],
  jobs: { jobs, total: jobs.length, page: 1, pageSize: 10 },
}

api.get = async (requestPath) => {
  const key = Object.keys(MOCKS).sort((a, b) => b.length - a.length).find((candidate) => String(requestPath).includes(candidate))
  return key ? MOCKS[key] : []
}
api.post = async () => ({})
api.patch = async () => ({})
api.del = async () => ({})

const path = new URLSearchParams(window.location.search).get('page') || '/job-seeker'

// Seed a couple of saved jobs so the dashboard counters/cards match the demo.
try {
  window.localStorage.setItem('joblinked.savedJobs', JSON.stringify(['j1', 'j3']))
} catch { /* ignore */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthContext.Provider value={{ user, logout: () => {}, refreshUser: async () => user }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/job-seeker" element={<TopNavLayout role="job-seeker" profileTo="/job-seeker/profile" roleLabel="Job Seeker" homeTo="/job-seeker" />}>
            <Route index element={<Dashboard />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="applications" element={<Applications />} />
            <Route path="employment" element={<Employment />} />
            <Route path="profile" element={<Profile />} />
            <Route path="saved" element={<SavedJobs />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  </StrictMode>,
)
