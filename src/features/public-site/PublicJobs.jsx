import { useSearchParams } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import JobsBrowser from '@/shared/components/JobsBrowser'
import landingBg from '@/assets/landing_page_bg.png'

export default function PublicJobs() {
  const [searchParams] = useSearchParams()

  return (
    <PublicShell>
      <header className="page-hero bg-cover bg-center border-b border-border" style={{ backgroundImage: `linear-gradient(180deg, rgba(247,250,255,0.88) 0%, rgba(247,250,255,0.72) 100%), url(${landingBg})` }}>
        <div className="page-container py-14 md:py-16">
          <div>
            <h1 className="display-heading text-navy">Browse Jobs</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal.
            </p>
          </div>
        </div>
      </header>
      <div className="page-container py-10">
        {/* Remounting on the query string re-seeds the search fields from the URL. */}
        <JobsBrowser
          key={searchParams.toString()}
          jobHref={(id) => `/jobs/${id}`}
          initialQuery={searchParams.get('keyword') || ''}
          initialBarangay={searchParams.get('location') || ''}
        />
      </div>
    </PublicShell>
  )
}
