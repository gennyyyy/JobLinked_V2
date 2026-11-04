import { Suspense, lazy } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// Recharts is ~423 kB raw. These wrappers keep it out of the first interactive
// render of the admin dashboard and reports: the stat cards and headings paint
// immediately, the chart chunk arrives when its panel renders.
// ponytail: one 260px fallback for every chart; give it a height prop if a
// taller chart ever causes a visible jump on slow connections.
function ChartFallback() {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">Loading chart…</span>
      <Skeleton className="h-[260px] w-full" />
    </div>
  )
}

const load = (name) => lazy(() => import('./EmploymentCharts').then((module) => ({ default: module[name] })))
const ActivityChart = load('EmploymentActivityChart')
const BarangayChart = load('BarangayVacancyChart')
const TypeChart = load('EmploymentTypeChart')

export function EmploymentActivityChart(props) {
  return <Suspense fallback={<ChartFallback />}><ActivityChart {...props} /></Suspense>
}

export function BarangayVacancyChart(props) {
  return <Suspense fallback={<ChartFallback />}><BarangayChart {...props} /></Suspense>
}

export function EmploymentTypeChart(props) {
  return <Suspense fallback={<ChartFallback />}><TypeChart {...props} /></Suspense>
}
