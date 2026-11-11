import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TopNavLayout from '@/shared/components/TopNavLayout'
import useAuth from '@/shared/hooks/useAuth'

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
  const [dismissedFor, setDismissedFor] = useState(null)
  const dismissed = dismissedFor === user?.id
  const notice = user?.role === 'employer' ? ACCREDITATION_NOTICE[user?.accreditation_status] : undefined

  return (
    <>
      {notice && !dismissed && (
        <div
          role="status"
          className={`w-full px-4 py-2.5 flex items-start sm:items-center gap-3 border-b ${
            notice.rejected ? 'bg-danger-soft border-danger/20' : 'bg-warning-soft border-warning/20'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${notice.rejected ? 'text-danger' : 'text-warning'}`}
            aria-hidden="true"
          />
          <p className={`flex-1 text-xs leading-relaxed ${notice.rejected ? 'text-danger' : 'text-warning'}`}>
            <span className="font-semibold">{notice.title}:</span> {notice.body}{' '}
            <Link to="/employer/accreditation" className="underline font-semibold hover:opacity-80">
              View accreditation →
            </Link>
          </p>
          <Button
            type="button"
            onClick={() => setDismissedFor(user?.id)}
            aria-label="Dismiss accreditation notice"
            className={`p-1 cursor-pointer shrink-0 ${notice.rejected ? 'text-danger hover:opacity-80' : 'text-warning hover:opacity-80'}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}
      <TopNavLayout
        role="employer"
        profileTo="/employer/company"
        roleLabel="Employer"
        homeTo="/employer"
      />
    </>
  )
}
