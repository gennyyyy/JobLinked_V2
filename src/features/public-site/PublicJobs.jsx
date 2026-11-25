import { useSearchParams } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import PageHero from './PageHero'
import JobsBrowser from '@/shared/components/JobsBrowser'

export default function PublicJobs() {
  const [searchParams] = useSearchParams()

  return (
    <PublicShell>
      <PageHero
        title="Browse Jobs"
        description="Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal."
      />
      <div className="page-container py-12 md:py-16">
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
