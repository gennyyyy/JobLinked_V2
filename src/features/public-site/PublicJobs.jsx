import { useSearchParams } from 'react-router-dom'
import PublicShell from '@/shared/components/PublicShell'
import BrowseJobs from '@/shared/components/BrowseJobs'

export default function PublicJobs() {
  const [searchParams] = useSearchParams()

  return (
    <PublicShell>
      <div className="bg-muted/60">
        <div className="page-container py-10">
          <div className="mb-8">
            <p className="eyebrow mb-3">Public employment bulletins</p>
            <h1 className="text-3xl font-semibold tracking-[-.04em]">Find openings in Santa Maria</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal.
            </p>
          </div>
          {/* Remounting on the query string re-seeds the search fields from the URL. */}
          <BrowseJobs
            key={searchParams.toString()}
            jobHref={(id) => `/jobs/${id}`}
            initialKeyword={searchParams.get('keyword') || ''}
            initialLocation={searchParams.get('location') || ''}
          />
        </div>
      </div>
    </PublicShell>
  )
}
