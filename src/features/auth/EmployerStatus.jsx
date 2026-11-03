import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getEmployer } from '@/shared/services/auth'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { LinkButton } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'
import useAuth from '@/shared/hooks/useAuth'

function StatusNode({ done, rejected, label, sub }) {
  return (
    <li className="relative pb-8 pl-8 last:pb-0">
      <div className="absolute left-0 top-1">
        {done ? (
          <span className={`flex size-5 items-center justify-center rounded-full border ${rejected ? 'border-danger/30 bg-danger/15 text-danger' : 'border-primary/30 bg-primary/15 text-primary'}`}>
            <span className={`size-2 rounded-full ${rejected ? 'bg-danger' : 'bg-primary'}`} />
          </span>
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full border border-border bg-card">
            <span className="size-1.5 rounded-full bg-border" />
          </span>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </li>
  )
}

export default function EmployerStatus() {
  const { user } = useAuth()
  const [employer, setEmployer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    getEmployer()
      .then((data) => setEmployer(data))
      .catch((err) => setError(err.message || 'Failed to load status'))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) return <p className="py-8 text-center text-sm text-muted-foreground">Please sign in to view your accreditation status.</p>
  if (loading) return <LoadingScreen />
  if (error) return <p className="py-8 text-center text-sm text-danger">{error}</p>

  if (!employer || !employer.accreditation_status) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>No application found</CardTitle>
          <CardDescription>You haven’t submitted an employer accreditation application yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <LinkButton href="/register/employer">Register as Employer →</LinkButton>
        </CardContent>
      </Card>
    )
  }

  const status = employer.accreditation_status
  const isApproved = status === 'approved'
  const isRejected = status === 'rejected'
  const isRevoked = status === 'revoked'
  const remarks = employer.accreditation_remarks || null

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">Accreditation status</p>
            <CardTitle className="mt-1 text-2xl">{titleCase(employer.company_name)}</CardTitle>
          </div>
          <Badge variant="secondary" className={isApproved ? 'bg-success-soft text-success' : isRejected || isRevoked ? 'bg-danger-soft text-destructive' : 'bg-blue-soft text-primary'}>
            {status === 'pending' ? 'Under Review' : status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {(isRejected || isRevoked) && remarks && (
          <div className="mb-6 rounded-xl border border-danger/20 bg-danger/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-danger">Action required</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{remarks}</p>
          </div>
        )}
        <ol className="relative mt-2">
          <span className="absolute bottom-4 left-[9px] top-3 w-px bg-border" aria-hidden="true" />
          <StatusNode done label="Application Submitted" sub={<p className="text-xs text-muted-foreground">Credentials and documents successfully received.</p>} />
          <StatusNode done label="Under PESO Review" sub={<p className="text-xs text-muted-foreground">Santa Maria PESO officers are evaluating business credentials and permit compliance.</p>} />
          {!isRejected && !isRevoked && (
            <StatusNode done={isApproved} label="Municipal Accreditation Approved" sub={isApproved ? <p className="text-xs text-success">Accreditation granted. Your employer portal is active and you can now post verified job openings.</p> : undefined} />
          )}
          {(isRejected || isRevoked) && (
            <StatusNode done rejected label={isRevoked ? 'Accreditation Revoked' : 'Accreditation Rejected'} sub={<p className="text-xs text-danger">{remarks || (isRevoked ? 'Accreditation was revoked by PESO.' : 'Application did not meet accreditation criteria.')}</p>} />
          )}
        </ol>
        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
          {isApproved && <LinkButton href="/employer">Access Employer Portal →</LinkButton>}
          {isRejected && <LinkButton href="/register/employer">Re-submit Documents</LinkButton>}
          <Link to="/" className="text-center text-xs text-muted-foreground transition-colors hover:text-primary">Back to Home</Link>
        </div>
      </CardContent>
    </Card>
  )
}
