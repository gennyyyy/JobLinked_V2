import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import PesoOfficeInfo from '@/shared/components/PesoOfficeInfo'
import PageHero from './PageHero'
import { RevealText } from '@/shared/components/design'
import { PESO_SERVICES } from '@/shared/constants'

export default function PesoServices() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <PageHero
          title="PESO Services"
          description="Explore employment programs, career guidance, and skills development information designed with your future in mind."
        />
        <div className="page-container py-12 md:py-16">
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {PESO_SERVICES.map(({ title, what, who, how }, index) => (
              <li className="border-t border-border pt-5" key={title}>
                <p className="text-xs font-semibold tracking-[0.16em] text-primary tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <RevealText as="h2" className="mt-2 text-lg font-semibold">{title}</RevealText>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What it is</dt>
                    <dd className="mt-1 text-sm leading-7 text-muted-foreground">{what}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Who it’s for</dt>
                    <dd className="mt-1 text-sm leading-7 text-muted-foreground">{who}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">How to get it</dt>
                    <dd className="mt-1 text-sm leading-7 text-muted-foreground">{how}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm leading-6 text-muted-foreground">Program information only. Confirm actual availability with official channels.</p>
          <div className="mt-4">
            <p className="text-sm leading-6 text-muted-foreground">Questions about a service? Contact the Santa Maria PESO office:</p>
            <PesoOfficeInfo className="text-sm" />
          </div>
        </div>
      </PublicShell>
    </>
  )
}
