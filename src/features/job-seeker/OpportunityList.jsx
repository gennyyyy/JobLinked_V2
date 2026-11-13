import JobsBrowser from '@/shared/components/JobsBrowser'

// Job-seeker variant of the shared browser: saved=true renders the collection.
export default function OpportunityList({ saved = false }) {
  return <JobsBrowser saved={saved} jobHref={(id) => `/job-seeker/jobs/${id}`} />
}
