import { PageHeading } from '@/shared/components/design'
import JobsBrowser from '@/shared/components/JobsBrowser'

// Job-seeker variant of the shared browser: saved=true renders the collection.
export default function OpportunityList({ saved = false }) {
  return (
    <>
      {saved ? (
        <PageHeading title="Saved jobs" />
      ) : (
        <PageHeading
          title="Browse Jobs"
          eyebrow="Built around your skills"
          description="Explore local roles ranked by the skills you have added to your profile."
        />
      )}
      <JobsBrowser saved={saved} jobHref={(id) => `/job-seeker/jobs/${id}`} />
    </>
  )
}