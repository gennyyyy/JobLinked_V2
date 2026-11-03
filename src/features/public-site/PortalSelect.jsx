import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, ShieldCheck, Users } from 'lucide-react'
import { PORTALS } from '@/shared/constants'
import PublicShell from '@/shared/components/PublicShell'

const icons = {
  'super-admin': ShieldCheck,
  employer: Building2,
  'job-seeker': Users,
}

const descriptions = {
  'super-admin': 'Full system administration: manage employers, accreditations, jobs, users, and settings.',
  employer: 'Post jobs, manage applicants, submit accreditation documents for PESO verification.',
  'job-seeker': 'Browse verified job openings, manage your profile, and track applications.',
}

export default function PortalSelect() {
  return (
    <PublicShell>
      <div className="bg-muted/60">
        <div className="page-container py-14">
          <div className="mx-auto max-w-4xl">
            <div className="mb-9 text-center">
              <p className="eyebrow mb-3">Portal selection</p>
              <h1 className="text-4xl font-semibold tracking-[-.045em]">Choose your role</h1>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Access the Santa Maria PESO platform according to your account type.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {PORTALS.map((portal) => {
                const Icon = icons[portal.key] || Users
                return (
                  <Link key={portal.key} to={portal.path} className="surface group flex flex-col p-6 transition-colors hover:border-primary/40">
                    <span className="soft-icon">
                      <Icon className="size-5" />
                    </span>
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">
                        {portal.key.replace('-', ' ')}
                      </span>
                      <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <h2 className="mt-2 text-xl font-semibold transition-colors group-hover:text-primary">{portal.name}</h2>
                    <p className="mt-3 text-xs leading-6 text-muted-foreground">{descriptions[portal.key]}</p>
                    <span className="mt-6 border-t pt-4 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                      Log in to portal →
                    </span>
                  </Link>
                )
              })}
            </div>
            <p className="mt-10 text-center text-xs text-muted-foreground">
              Don’t have an account yet?{' '}
              <Link to="/register" className="font-medium text-primary">Register here</Link>
            </p>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
