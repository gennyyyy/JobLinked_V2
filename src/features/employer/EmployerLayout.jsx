import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import PortalLayout from '../../shared/components/PortalLayout'
import useAuth from '../../shared/hooks/useAuth'

const navItems = [
  { to: '/employer', label: 'Dashboard', end: true },
  { to: '/employer/job-posts', label: 'Job Posts' },
  { to: '/employer/applicants', label: 'Applicants' },
  { to: '/employer/employees', label: 'Employees' },
  { to: '/employer/notifications', label: 'Notifications' },
  { to: '/employer/accreditation', label: 'Accreditation' },
]

// Why posting is unavailable. Visibility only — no POST/publish behaviour here.
const ACCREDITATION_NOTICE = {
  pending: {
    rejected: false,
    title: 'Accreditation under review',
    body: 'PESO officers are reviewing your company credentials and permits. You can use the portal, but you cannot post job vacancies until your accreditation is approved.',
  },
  resubmission: {
    rejected: false,
    title: 'Additional documents required',
    body: 'PESO needs more documents before your accreditation can be approved. Upload them to keep your application moving.',
  },
  rejected: {
    rejected: true,
    title: 'Accreditation rejected',
    body: 'Your application did not meet the accreditation criteria. Review the PESO remarks and re-submit your documents.',
  },
  revoked: {
    rejected: true,
    title: 'Accreditation revoked',
    body: 'Your accreditation was revoked. Review the details on the accreditation page to learn what is needed to restore it.',
  },
}

export default function EmployerLayout() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const notice = user?.role === 'employer' ? ACCREDITATION_NOTICE[user?.accreditation_status] : undefined

  return (
    <>
      {notice && !dismissed && (
        <div
          role="status"
          className={`w-full px-4 py-2.5 flex items-start sm:items-center gap-3 border-b ${
            notice.rejected ? 'bg-danger/5 border-danger/20' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${notice.rejected ? 'text-danger' : 'text-amber-600'}`}
            aria-hidden="true"
          />
          <p className={`flex-1 text-xs leading-relaxed ${notice.rejected ? 'text-danger' : 'text-amber-800'}`}>
            <span className="font-semibold">{notice.title}:</span> {notice.body}{' '}
            <Link to="/employer/accreditation" className="underline font-semibold hover:opacity-80">
              View accreditation →
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss accreditation notice"
            className={`p-1 cursor-pointer shrink-0 ${notice.rejected ? 'text-danger hover:opacity-80' : 'text-amber-700 hover:text-amber-900'}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <PortalLayout
        navItems={navItems}
        badge="EMPLOYER"
        eyebrow="SANTA MARIA, BULACAN"
        subhead={(user) => user?.company_name || 'My Company'}
        profileTo="/employer/company"
        roleLabel="Employer"
      />
    </>
  )
}
