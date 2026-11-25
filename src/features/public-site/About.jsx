import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import PageHero from './PageHero'
import { AudienceCards } from './AudienceCards'

export default function About() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <PageHero
          title="About PESO Santa Maria"
          description="Three audiences, one shared platform for local opportunity."
        />
        <div className="page-container py-12 md:py-16">
          <div className="mx-auto max-w-[960px]">
            <AudienceCards headingTag="h2" />
          </div>
        </div>
      </PublicShell>
    </>
  )
}
