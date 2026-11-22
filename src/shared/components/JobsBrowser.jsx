import { useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import useAuth from '@/shared/hooks/useAuth'
import { listJobs } from '@/shared/services/jobs'
import { matchJobs } from '@/shared/services/ai'
import { getSavedJobIds, subscribeSavedJobs, toggleSavedJob } from '@/shared/lib/savedJobs'
import { PageHeading, EmptyState, SearchInput, SelectField } from '@/shared/components/design'
import { Button } from '@/components/ui/button'
import JobCard from '@/shared/components/JobCard'
import PreferenceMatching from './PreferenceMatching'
import { JobListSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'
import { experienceLevel, isJobOpen, jobType, matchJob, preferenceScore } from '@/shared/utils/jobDisplay'
import { MATCH_UNAVAILABLE, matchModeLabel } from '@/shared/content/matching'

const PAGE_SIZE = 15
// The list is filtered and ranked in memory, so it needs the whole published
// set. The API clamps pageSize to 100, hence the paged load below.
const LOAD_PAGE_SIZE = 100
const MAX_LOAD_PAGES = 10
const EMPTY_FILTERS = { barangay: '', field: '', type: '', salary: '', experience: '' }
const SALARY_OPTIONS = [
  { label: 'Below ₱15,000', value: '0-15000' },
  { label: '₱15,000 – ₱25,000', value: '15000-25000' },
  { label: '₱25,000 – ₱40,000', value: '25000-40000' },
  { label: '₱40,000 and above', value: '40000-10000000' },
]
const EXPERIENCE_OPTIONS = ['No experience', 'Entry level', '1–3 years', '3+ years']
// The only jobs that may enter the AI candidate pool, same rule as the list.
const isBrowsable = (job) => isJobOpen(job) && (!job.employers?.accreditation_status || job.employers.accreditation_status === 'approved')

// 1:1 port of the reference opportunities page, shared by the public bulletin,
// Browse Jobs and Saved jobs (saved=true renders the collection variant).
export default function JobsBrowser({
  saved = false,
  jobHref,
  eyebrow,
  title,
  description,
  initialQuery = '',
  initialBarangay = '',
}) {
  const { user } = useAuth()
  const [query, setQuery] = useState(initialQuery)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, barangay: initialBarangay })
  const [matchingPrompt, setMatchingPrompt] = useState('')
  const [ranking, setRanking] = useState(null)
  const [matchNotice, setMatchNotice] = useState('')
  const [matchBusy, setMatchBusy] = useState(false)
  // Every explicit submit bumps the nonce: re-sending the same prompt on the
  // same page/filters must still dispatch a request (retry after a failure).
  const [matchNonce, setMatchNonce] = useState(0)
  const matchSeq = useRef(0)
  const [page, setPage] = useState(1)
  const [jobs, setJobs] = useState([])
  const [savedIds, setSavedIds] = useState(() => getSavedJobIds())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => subscribeSavedJobs(() => setSavedIds(getSavedJobIds())), [])

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const collected = []
      const seen = new Set()
      for (let pageNumber = 1; pageNumber <= MAX_LOAD_PAGES; pageNumber += 1) {
        const result = await listJobs({ page: pageNumber, pageSize: LOAD_PAGE_SIZE, order: 'created_at.desc' })
        if (cancelled) return
        const rows = Array.isArray(result?.jobs) ? result.jobs : []
        // A stubbed endpoint that repeats the same page must not loop.
        const fresh = rows.filter((job) => !seen.has(job.id))
        if (!fresh.length) break
        fresh.forEach((job) => seen.add(job.id))
        collected.push(...fresh)
        const total = Number(result?.total)
        if (!Number.isFinite(total) || collected.length >= total) break
      }
      setJobs(collected)
    }

    loadAll()
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load jobs') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Only the structured field is a field; legacy rows without one stay under
  // "All fields" instead of inventing a category out of their tags.
  const fieldOptions = useMemo(
    () => [...new Set(jobs.map((job) => job.field).filter(Boolean))].sort(),
    [jobs],
  )
  const typeOptions = useMemo(
    () => [...new Set(jobs.map(jobType).filter(Boolean))].sort(),
    [jobs],
  )

  // The AI may only rank the jobs that already pass the open + accredited gate.
  const candidates = useMemo(
    () => jobs.filter((job) => (saved ? savedIds.includes(job.id) : isBrowsable(job))),
    [jobs, saved, savedIds],
  )

  // Local sequence guard: prompt/page/filter changes and explicit resubmits
  // invalidate an in-flight ranking, so a late response can never reorder a
  // list the user has moved on from. Turning matching off clears the ranking
  // instantly in applyMatching.
  useEffect(() => {
    if (saved || !matchingPrompt || !candidates.length) return
    const seq = (matchSeq.current += 1)
    matchJobs(matchingPrompt, candidates.map((job) => job.id))
      .then((result) => {
        if (seq !== matchSeq.current) return
        setRanking({
          mode: result?.mode ?? null,
          order: new Map((result?.ranking ?? []).map((id, index) => [String(id), index])),
          reasons: new Map((result?.reasons ?? []).map(({ jobId, reason }) => [String(jobId), reason])),
        })
        setMatchNotice('')
      })
      .catch(() => {
        if (seq !== matchSeq.current) return
        setRanking(null)
        setMatchNotice(MATCH_UNAVAILABLE)
      })
      .finally(() => { if (seq === matchSeq.current) setMatchBusy(false) })
  }, [saved, matchingPrompt, candidates, matchNonce])

  function updateFilter(name, value) {
    setFilters((previous) => ({ ...previous, [name]: value }))
    setPage(1)
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setQuery('')
    setPage(1)
  }

  function applyMatching(prompt) {
    // Bump first: a request already in flight for the previous prompt must not
    // land after this one. Clearing happens on this render, not one frame later.
    matchSeq.current += 1
    setMatchingPrompt(prompt)
    setPage(1)
    setMatchNotice('')
    if (prompt) {
      setMatchBusy(candidates.length > 0)
      setMatchNonce((nonce) => nonce + 1)
    } else {
      setRanking(null)
      setMatchBusy(false)
    }
  }

  const records = useMemo(() => {
    const text = query.toLowerCase()
    const [salaryLow, salaryHigh] = filters.salary ? filters.salary.split('-').map(Number) : [null, null]
    const rank = ranking?.order
    return candidates
      .filter((job) => `${job.title} ${job.employers?.company_name || ''}`.toLowerCase().includes(text))
      .filter((job) => (!filters.barangay || job.location === filters.barangay))
      .filter((job) => (!filters.field || job.field === filters.field))
      .filter((job) => (!filters.type || jobType(job) === filters.type))
      .filter((job) => (!filters.experience || experienceLevel(job) === filters.experience))
      .filter((job) => {
        if (salaryLow === null) return true
        const min = Number(job.salary_min)
        if (!Number.isFinite(min)) return false
        const max = Number.isFinite(Number(job.salary_max)) ? Number(job.salary_max) : min
        return max >= salaryLow && min <= salaryHigh
      })
      .sort((a, b) => {
        // Unknown ids (NaN when both are absent from ranking) sort last and fall
        // through to the standard order, so the fallback is never a reshuffle.
        const byRank = rank
          ? (rank.get(String(a.id)) ?? Infinity) - (rank.get(String(b.id)) ?? Infinity) || 0
          : 0
        if (byRank) return byRank
        return saved
          ? String(b.created_at).localeCompare(String(a.created_at))
          : (matchingPrompt ? preferenceScore(b, matchingPrompt) - preferenceScore(a, matchingPrompt) : 0)
            || matchJob(b, user).score - matchJob(a, user).score
      })
  }, [candidates, saved, query, filters, matchingPrompt, user, ranking])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = saved ? 1 : Math.min(page, pages)
  const visible = saved ? records : records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSave(id) {
    setSavedIds(toggleSavedJob(id))
  }

  const filterFields = (prefix) => (
    <div className="flex flex-col gap-4">
      <SelectField
        id={`${prefix}-barangay`}
        label="Barangay"
        placeholder="All barangays"
        options={SANTA_MARIA_BARANGAYS}
        value={filters.barangay}
        onChange={(event) => updateFilter('barangay', event.target.value)}
      />
      <SelectField
        id={`${prefix}-field`}
        label="Job field"
        placeholder="All fields"
        options={fieldOptions}
        value={filters.field}
        onChange={(event) => updateFilter('field', event.target.value)}
      />
      <SelectField
        id={`${prefix}-type`}
        label="Employment type"
        placeholder="All types"
        options={typeOptions}
        value={filters.type}
        onChange={(event) => updateFilter('type', event.target.value)}
      />
      <SelectField
        id={`${prefix}-salary`}
        label="Monthly salary"
        placeholder="Any salary"
        options={SALARY_OPTIONS}
        value={filters.salary}
        onChange={(event) => updateFilter('salary', event.target.value)}
      />
      <SelectField
        id={`${prefix}-experience`}
        label="Experience level"
        placeholder="Any experience"
        options={EXPERIENCE_OPTIONS}
        value={filters.experience}
        onChange={(event) => updateFilter('experience', event.target.value)}
      />
      <button type="button" onClick={resetFilters} className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-primary">
        Reset all filters
      </button>
    </div>
  )

  return (
    <>
      <PageHeading
        eyebrow={saved ? 'Your collection' : (eyebrow || 'Built around your skills')}
        title={saved ? 'Keep good opportunities close.' : (title || 'Browse Jobs')}
        description={saved
          ? 'Your saved vacancies, together in one place. Closed roles may no longer accept applications.'
          : (description || 'Explore local roles ranked by the skills you have added to your profile.')}
      />
      <div className="flex flex-col gap-7 lg:flex-row">
        {!saved && (
          <aside className="surface h-fit w-full shrink-0 lg:sticky lg:top-[90px] lg:z-10 lg:max-h-[calc(100vh-110px)] lg:w-[235px] lg:self-start lg:overflow-y-auto">
            {/* Search + AI live in the same floating panel as the filters, so the
                whole refinement stack rides along while the results scroll. */}
            <div className="mb-4 flex items-center gap-2">
              <SearchInput
                value={query}
                onChange={(value) => { setQuery(value); setPage(1) }}
                label="Search your recommendations"
                placeholder="Search jobs…"
              />
              <PreferenceMatching
                compact
                prompt={matchingPrompt}
                mode={ranking?.mode ?? null}
                busy={matchBusy}
                onSubmit={applyMatching}
              />
            </div>
            <div className="mb-4 flex items-center gap-2 border-t pt-4">
              <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Narrow your search</h2>
            </div>
            {filterFields('sidebar')}
          </aside>
        )}
        <div className="min-w-0 flex-1">
          {saved && (
            <div className="mb-5 max-w-lg">
              <SearchInput
                value={query}
                onChange={(value) => { setQuery(value); setPage(1) }}
                label="Search saved opportunities"
                placeholder="Search saved opportunities…"
              />
            </div>
          )}
          <p className="mb-4 text-xs text-muted-foreground" aria-live="polite">
            {records.length} {saved ? 'saved opportunities' : 'matching vacancies'}
          </p>
          {matchingPrompt && (
            <p role="status" className="mb-4 text-xs text-muted-foreground">{matchModeLabel(ranking?.mode)}</p>
          )}
          {matchNotice && (
            <p role="status" className="mb-4 text-xs text-muted-foreground">{matchNotice}</p>
          )}
          {loading ? (
            <JobListSkeleton count={4} />
          ) : error ? (
            <InlineError message={error} />
          ) : records.length ? (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  href={jobHref(job.id)}
                  showMatch={!saved && Boolean(user?.skills?.length)}
                  match={matchJob(job, user)}
                  matchReason={ranking?.reasons.get(String(job.id))}
                  saved={savedIds.includes(job.id)}
                  canSave={user?.role === 'job-seeker'}
                  onToggleSave={toggleSave}
                />
              ))}
            </div>
          ) : matchingPrompt ? (
            <EmptyState
              title="No matching opportunities in this view."
              description="Nothing matched that request. Clear it to go back to skills-based ranking."
              action={<Button variant="outline" onClick={() => applyMatching('')}>Clear matching</Button>}
            />
          ) : (
            <EmptyState
              title={saved ? 'Make room for your next chapter.' : 'No matching opportunities in this view.'}
              description={saved
                ? 'Tap the bookmark on a vacancy to save it here, or clear your search.'
                : 'Try another search or explore all local vacancies.'}
              href="/jobs"
            />
          )}
        </div>
      </div>
      {!saved && records.length > 0 && (
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} align="center" />
      )}
    </>
  )
}
