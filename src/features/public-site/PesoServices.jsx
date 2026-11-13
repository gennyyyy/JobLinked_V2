import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import { PESO_SERVICES } from '@/shared/constants'

export default function PesoServices() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <header className="page-hero">
          <div className="page-container py-14 md:py-16">
            <div>
              <p className="eyebrow mb-4">Support beyond the job search</p>
              <h1 className="display-heading text-navy">You don't have to take the next step alone.</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">Explore employment programs, career guidance, and skills development information designed with your future in mind.</p>
            </div>
          </div>
        </header>
        <div className="page-container py-12 md:py-16">
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {PESO_SERVICES.map(({ title, description }) => (
              <li className="border-t border-border py-6" key={title}>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm leading-6 text-muted-foreground">Program information only. Confirm actual availability with official channels.</p>
        </div>
      </PublicShell>
    </>
  )
}
