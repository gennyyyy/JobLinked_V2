import { useEffect, useState } from 'react'
import { getPublicStats } from '@/shared/services/jobs'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'

const REFRESH_INTERVAL = 30_000
const TOTAL_BARANGAYS = SANTA_MARIA_BARANGAYS.length

const STAT_ITEMS = [
  { key: 'openJobs', label: 'Open jobs' },
  { key: 'jobSeekers', label: 'Job seekers' },
  { key: 'employers', label: 'Employers' },
  { key: 'barangaysCovered', label: 'Barangays covered', format: () => TOTAL_BARANGAYS },
]

export default function CommunityStats() {
  const [stats, setStats] = useState(null)
  const [refreshError, setRefreshError] = useState('')

  useEffect(() => {
    let active = true
    let requestPending = false

    async function refresh() {
      if (requestPending) return
      requestPending = true
      try {
        const latestStats = await getPublicStats()
        if (!STAT_ITEMS.every(({ key }) => Number.isInteger(latestStats?.[key]))) {
          throw new Error('Invalid public stats response')
        }
        if (active) {
          setStats(latestStats)
          setRefreshError('')
        }
      } catch {
        if (active) setRefreshError('Live counts could not be refreshed.')
      } finally {
        requestPending = false
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void refresh()
    }

    void refresh()
    const intervalId = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  return (
    <section className="border-y bg-muted/60">
      <div className="page-container flex flex-col items-start justify-between gap-8 py-12 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow mb-2">A snapshot of our community</p>
          <h2 className="text-xl font-semibold tracking-tight">Local connections. Real potential.</h2>
          <p className="mt-2 text-[10px] text-muted-foreground">Platform counts only—not municipal employment statistics.</p>
        </div>
        <div className="flex w-full justify-between gap-8 sm:w-auto sm:gap-14">
          {STAT_ITEMS.map(({ key, label, format }) => (
            <div key={key}>
              <p className="text-3xl font-semibold tracking-tight text-primary" aria-label={`${label} count`}>
                {format ? format(stats?.[key]) : (stats ? stats[key].toLocaleString() : '—')}
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {refreshError && (
          <p role="status" className="text-xs text-muted-foreground">
            {refreshError}{stats ? ' Showing the last available counts.' : ''}
          </p>
        )}
      </div>
    </section>
  )
}
