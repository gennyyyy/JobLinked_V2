import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { listAllJobs, listAllApplications, listUsers } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, SectionCard, StatCard } from '@/shared/components/dashboard'
import { PageHeading, TextField } from '@/shared/components/design'
import { BarangayVacancyChart, EmploymentActivityChart, EmploymentTypeChart } from '@/shared/components/lazyCharts'

const REPORTS = [
  { id: 'referral', label: 'Referral', eyebrow: 'Referral activity', description: 'Track applicants referred through PESO services.' },
  { id: 'placement', label: 'Placement Summary', eyebrow: 'Employment outcomes', description: 'Review applicants marked as placed and their hiring details.' },
  { id: 'registration', label: 'Applicant Registration', eyebrow: 'Applicant growth', description: 'See job seeker registrations within the selected period.' },
  { id: 'vacancy', label: 'Vacancy Solicitation', eyebrow: 'Employer demand', description: 'Review vacancies posted by participating employers.' },
]
const PAGE_SIZE = 10
const dateValue = (value) => value ? new Date(value).toLocaleDateString() : '—'

function Reports() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [users, setUsers] = useState([])
  const [active, setActive] = useState('referral')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    // ponytail: the stat cards aggregate client-side, so the page asks for the
    // 500-row max; move these aggregations server-side when reports outgrow it.
    Promise.all([
      listAllJobs({ pageSize: 500 }),
      listAllApplications({ pageSize: 500 }),
      listUsers({ pageSize: 500 }),
    ])
      .then(([jobRows, applicationRows, userRows]) => {
        setJobs(jobRows.data)
        setApplications(applicationRows.data)
        setUsers(userRows.data)
      })
      .catch((err) => setError(err.message || 'Could not load report data.'))
      .finally(() => setLoading(false))
  }, [])

  const inRange = (value) => {
    if (!value) return true
    const day = value.slice(0, 10)
    return (!from || day >= from) && (!to || day <= to)
  }
  const seekers = users.filter((user) => user.role === 'job-seeker' && inRange(user.created_at))
  const vacancies = jobs.filter((job) => inRange(job.created_at))
  const periodApplications = applications.filter((application) => inRange(application.applied_at))
  const placed = periodApplications.filter((application) => application.status?.toLowerCase() === 'placed')

  const reportRows = active === 'placement'
    ? placed
    : active === 'registration'
      ? seekers
      : active === 'vacancy'
        ? vacancies
        : []
  const pages = Math.max(1, Math.ceil(reportRows.length / PAGE_SIZE))
  const visibleRows = reportRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const current = REPORTS.find((item) => item.id === active)

  const activityDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - 13 + index)
    const key = date.toISOString().slice(0, 10)
    const rows = periodApplications.filter((application) => String(application.applied_at || '').slice(0, 10) === key)
    return {
      month: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date),
      applications: rows.length,
      placements: rows.filter((application) => ['Placed', 'Hired', 'Accepted'].includes(application.status)).length,
    }
  })
  const employmentTypeData = ['Full-time', 'Part-time', 'Contractual', 'Seasonal', 'Job Order']
    .map((name) => ({ name, value: vacancies.filter((job) => (job.employment_type || '') === name).length }))
  const barangayData = Object.entries(
    vacancies.reduce((acc, job) => {
      const key = job.location || 'Unspecified'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {}),
  ).map(([name, count]) => ({ name, vacancies: count }))

  function downloadCSV() {
    const fields = active === 'placement'
      ? [['Applicant', 'Vacancy', 'Employer', 'Placed date'], placed.map((row) => [row.seeker?.full_name, row.job?.title, row.job?.employers?.company_name, row.applied_at])]
      : active === 'registration'
        ? [['Applicant', 'Email', 'Barangay', 'Registered'], seekers.map((row) => [row.full_name, row.email, row.barangay_district, row.created_at])]
        : active === 'vacancy'
          ? [['Vacancy', 'Employer', 'Location', 'Status', 'Posted'], vacancies.map((row) => [row.title, row.employers?.company_name, row.location, row.status, row.created_at])]
          : [['Referral', 'Status', 'Date'], []]
    const csv = [fields[0], ...fields[1]].map((row) => row.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${active}-report.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton stats={3} panels={2} />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="A more informed local picture"
        title="Insights that keep people at the center."
        description="Explore provided vacancies, referrals, and placement outcomes across Santa Maria's 24 barangays."
        action={(
          <Button type="button" variant="outline" onClick={downloadCSV}>
            <Download data-icon="inline-start" />
            Download CSV
          </Button>
        )}
      />

      <nav aria-label="Report types" className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        {REPORTS.map((report) => (
          <Button
            key={report.id}
            type="button"
            variant="outline"
            onClick={() => { setActive(report.id); setPage(1) }}
            aria-current={active === report.id ? 'page' : undefined}
            className={`h-auto flex-col items-start justify-start px-4 py-3 text-left ${active === report.id ? 'border-primary bg-blue-soft' : ''}`}
          >
            <span className={`block text-xs font-semibold ${active === report.id ? 'text-primary' : 'text-navy'}`}>{report.label}</span>
            <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{report.eyebrow}</span>
          </Button>
        ))}
      </nav>

      <div className="surface mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{current.eyebrow}</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy">{current.label}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{current.description}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <TextField label="From" type="date" aria-label="From date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} />
            </div>
            <div className="w-40">
              <TextField label="To" type="date" aria-label="To date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {active === 'placement' && (
          <>
            <StatCard label="Placed applicants" value={placed.length} />
            <StatCard label="Applications reviewed" value={periodApplications.length} />
            <StatCard label="Placement rate (of applications in period)" value={`${periodApplications.length ? Math.round(placed.length / periodApplications.length * 100) : 0}%`} />
          </>
        )}
        {active === 'registration' && (
          <>
            <StatCard label="New applicants" value={seekers.length} />
            <StatCard label="All applicants" value={users.filter((user) => user.role === 'job-seeker').length} />
            <StatCard label="Period" value={from || to ? 'Selected' : 'All time'} />
          </>
        )}
        {active === 'vacancy' && (
          <>
            <StatCard label="Vacancies posted" value={vacancies.length} />
            <StatCard label="Open vacancies" value={vacancies.filter((job) => job.status === 'published').length} />
            <StatCard label="Employers posting" value={new Set(vacancies.map((job) => job.company_id).filter(Boolean)).size} />
          </>
        )}
        {active === 'referral' && (
          <>
            <StatCard label="Referrals recorded" value="—" />
            <StatCard label="Applicants referred" value="—" />
            <StatCard label="Period" value={from || to ? 'Selected' : 'All time'} />
          </>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Local employment activity" subtitle="Last 14 days · applications and current outcomes">
          <EmploymentActivityChart data={activityDays} />
        </SectionCard>
        <SectionCard title="Vacancies by employment type" subtitle="Published vacancies in the selected period">
          <EmploymentTypeChart data={employmentTypeData} />
        </SectionCard>
      </div>
      <SectionCard className="mb-6" title="Vacancies by barangay" subtitle="Top six barangays in the selected period">
        <BarangayVacancyChart data={barangayData} />
      </SectionCard>

      <SectionCard className="p-0" title="Report details" subtitle={`${reportRows.length} records`}>
        {active === 'referral' ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-navy">Referral data is not available yet</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
              Once referral activity is recorded, this report will show applicants, referring source, and referral date.
            </p>
          </div>
        ) : reportRows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-navy">No records in this period</p>
            <p className="mt-1 text-xs text-muted-foreground">Adjust the date range to see more results.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                  {active === 'placement' && (
                    <>
                      <th scope="col" className="px-2 py-3 font-medium first:pl-0">Applicant</th>
                      <th scope="col" className="px-2 py-3 font-medium">Vacancy</th>
                      <th scope="col" className="px-2 py-3 font-medium">Employer</th>
                      <th scope="col" className="px-2 py-3 font-medium last:pr-0">Placed</th>
                    </>
                  )}
                  {active === 'registration' && (
                    <>
                      <th scope="col" className="px-2 py-3 font-medium first:pl-0">Applicant</th>
                      <th scope="col" className="px-2 py-3 font-medium">Email</th>
                      <th scope="col" className="px-2 py-3 font-medium">Barangay</th>
                      <th scope="col" className="px-2 py-3 font-medium last:pr-0">Registered</th>
                    </>
                  )}
                  {active === 'vacancy' && (
                    <>
                      <th scope="col" className="px-2 py-3 font-medium first:pl-0">Vacancy</th>
                      <th scope="col" className="px-2 py-3 font-medium">Employer</th>
                      <th scope="col" className="px-2 py-3 font-medium">Location</th>
                      <th scope="col" className="px-2 py-3 font-medium">Status</th>
                      <th scope="col" className="px-2 py-3 font-medium last:pr-0">Posted</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t transition-colors hover:bg-muted/50">
                    {active === 'placement' && (
                      <>
                        <th scope="row" className="px-2 py-3 text-left text-xs font-medium text-navy first:pl-0">{row.seeker?.full_name || '—'}</th>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.job?.title || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.job?.employers?.company_name || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground last:pr-0">{dateValue(row.applied_at)}</td>
                      </>
                    )}
                    {active === 'registration' && (
                      <>
                        <th scope="row" className="px-2 py-3 text-left text-xs font-medium text-navy first:pl-0">{row.full_name || '—'}</th>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.email || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.barangay_district || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground last:pr-0">{dateValue(row.created_at)}</td>
                      </>
                    )}
                    {active === 'vacancy' && (
                      <>
                        <th scope="row" className="px-2 py-3 text-left text-xs font-medium text-navy first:pl-0">{row.title || '—'}</th>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.employers?.company_name || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.location || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground">{row.status || '—'}</td>
                        <td className="px-2 py-3 text-xs text-muted-foreground last:pr-0">{dateValue(row.created_at)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {active !== 'referral' && reportRows.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  )
}

export default Reports
