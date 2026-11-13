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
    <section className="bg-navy text-white">
      <div className="page-container flex flex-col gap-10 py-14 md:py-16 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-sm">
          <p className="eyebrow mb-3 text-white/70">A snapshot of our community</p>
          <h2 className="text-2xl font-semibold leading-[1.15] tracking-[-0.03em] text-white">Local connections. Real potential.</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">Platform counts only—not municipal employment statistics.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:flex sm:items-end sm:gap-12">
          {STAT_ITEMS.map(({ key, label, format }) => (
            <div key={key}>
              <p className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-white tabular-nums md:text-[46px]" aria-label={`${label} count`}>
                {format ? format(stats?.[key]) : (stats ? stats[key].toLocaleString() : '—')}
              </p>
              <p className="mt-2.5 text-xs text-white/70">{label}</p>
            </div>
          ))}
        </div>
        {refreshError && (
          <p role="status" className="text-xs text-white/70">
            {refreshError}{stats ? ' Showing the last available counts.' : ''}
          </p>
        )}
      </div>
    </section>
  )
}
