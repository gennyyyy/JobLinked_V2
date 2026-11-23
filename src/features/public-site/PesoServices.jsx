import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import PesoOfficeInfo from '@/shared/components/PesoOfficeInfo'
import landingBg from '@/assets/landing_page_bg.png'
import { PESO_SERVICES } from '@/shared/constants'

export default function PesoServices() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <header className="page-hero bg-cover bg-center border-b border-border" style={{ backgroundImage: `linear-gradient(180deg, rgba(247,250,255,0.88) 0%, rgba(247,250,255,0.72) 100%), url(${landingBg})` }}>
          <div className="page-container py-14 md:py-16">
            <div>
              <h1 className="display-heading text-navy">PESO Services</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">Explore employment programs, career guidance, and skills development information designed with your future in mind.</p>
            </div>
          </div>
        </header>
        <div className="page-container py-12 md:py-16">
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {PESO_SERVICES.map(({ title, what, who, how }) => (
              <li className="border-t border-border py-8" key={title}>
                <h2 className="text-lg font-semibold">{title}</h2>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">What it is</dt>
                    <dd className="mt-1 text-sm leading-7 text-muted-foreground">{what}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Who it’s for</dt>
                    <dd className="mt-1 text-sm leading-7 text-muted-foreground">{who}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">How to get it</dt>
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
