import { useSearchParams } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import JobsBrowser from '@/shared/components/JobsBrowser'

export default function PublicJobs() {
  const [searchParams] = useSearchParams()

  return (
    <PublicShell>
      <div className="bg-muted/60">
        <div className="page-container py-10">
          {/* Remounting on the query string re-seeds the search fields from the URL. */}
          <JobsBrowser
            key={searchParams.toString()}
            jobHref={(id) => `/jobs/${id}`}
            eyebrow="Public employment bulletins"
            title="Find openings in Santa Maria"
            description="Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal."
            initialQuery={searchParams.get('keyword') || ''}
            initialBarangay={searchParams.get('location') || ''}
          />
        </div>
      </div>
    </PublicShell>
  )
}
