import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import { AudienceCards } from './AudienceCards'

export default function About() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <header className="page-hero">
          <div className="page-container py-14 md:py-16">
            <div>
              <p className="eyebrow mb-4">One platform. A stronger community.</p>
              <h1 className="display-heading text-navy">Built around people, not paperwork.</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">Three audiences, one shared platform for local opportunity.</p>
            </div>
          </div>
        </header>
        <div className="page-container pb-14 pt-6 md:pb-16">
          <div className="mx-auto max-w-[960px]">
            <AudienceCards headingTag="h2" />
          </div>
        </div>
      </PublicShell>
    </>
  )
}
