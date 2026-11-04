import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, ClipboardCheck, Download, Handshake, Printer, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listAllApplications, listAllJobs, listUsers } from '@/shared/services/admin'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { Notice, PageHeading, Panel, StatCards, TextField } from '@/shared/components/design'
import { BarangayVacancyChart, EmploymentActivityChart, EmploymentTypeChart } from '@/shared/components/EmploymentCharts'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const quarterStart = () => {
  const date = new Date()
  date.setMonth(date.getMonth() - 3)
  return date.toISOString().slice(0, 10)
}

export default function Reports() {
  const [from, setFrom] = useState(quarterStart)
  const [to, setTo] = useState(today)
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      listAllJobs({ pageSize: 500 }),
      listAllApplications({ pageSize: 500 }),
      listUsers({ pageSize: 500 }),
    ])
      .then(([jobRows, applicationRows, userRows]) => {
        setJobs(jobRows.data || [])
        setApplications(applicationRows.data || [])
        setUsers(userRows.data || [])
      })
      .catch((err) => setError(err.message || 'Could not load report data.'))
      .finally(() => setLoading(false))
  }, [])

  const valid = !!from && !!to && from <= to && (new Date(to).getTime() - new Date(from).getTime()) / 86400000 <= 3660

  const report = useMemo(() => {
    const inRange = (value) => {
      if (!value) return true
      const day = String(value).slice(0, 10)
      return (!from || day >= from) && (!to || day <= to)
    }
    const periodApplications = applications.filter((application) => inRange(application.applied_at))
    const published = jobs.filter((job) => (job.status === 'published' || job.status === 'Published') && inRange(job.created_at))
    const placements = periodApplications.filter((application) => ['Placed', 'Hired'].includes(application.status))
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - 5 + index)
      const key = date.toISOString().slice(0, 7)
      const rows = periodApplications.filter((application) => String(application.applied_at || '').slice(0, 7) === key)
      return {
        month: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date),
        applications: rows.length,
        placements: rows.filter((application) => ['Placed', 'Hired'].includes(application.status)).length,
      }
    })
    const barangays = SANTA_MARIA_BARANGAYS.map((name) => {
      const rows = periodApplications.filter((application) => application.seeker?.barangay_district === name)
      return {
        name,
        seekers: users.filter((user) => user.role === 'job-seeker' && user.barangay_district === name).length,
        vacancies: published.filter((job) => job.location === name).length,
        applications: rows.length,
        placements: rows.filter((application) => ['Placed', 'Hired'].includes(application.status)).length,
      }
    })
    return {
      vacancies: published.length,
      openings: published.reduce((sum, job) => sum + (Number(job.vacancies) || 0), 0),
      applications: periodApplications.length,
      referrals: periodApplications.filter((application) => application.referred_by).length,
      placements: placements.length,
      months,
      barangays,
    }
  }, [applications, jobs, users, from, to])

  const employmentTypes = ['Full-time', 'Part-time', 'Contractual', 'Seasonal', 'Job Order']
    .map((name) => ({ name, value: jobs.filter((job) => job.employment_type === name && (job.status === 'published' || job.status === 'Published')).length }))

  function exportReport() {
    const rows = [
      ['DEMO DATA — Barangay', 'Registered residents (all time)', 'Currently published vacancies posted in period', 'Applications submitted in period', 'Current hired outcomes from those applications', 'Period start', 'Period end'],
      ...report.barangays.map((row) => [row.name, row.seekers, row.vacancies, row.applications, row.placements, from, to]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `joblinked-DEMO-barangay-report-${from}-to-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingScreen />

  return (
    <>
      <div className="print-title mb-5 hidden">
        <p className="text-xl font-semibold">JobLinked · Labor Market Report</p>
        <p className="text-xs">Provided data only.</p>
      </div>
      <PageHeading
        eyebrow="A more informed local picture"
        title="Insights that keep people at the center."
        description="Explore provided vacancies, referrals, and placement outcomes across Santa Maria’s 24 barangays."
        action={(
          <>
            <Button variant="outline" onClick={exportReport} disabled={!valid}>
              <Download data-icon="inline-start" />
              Download CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!valid}>
              <Printer data-icon="inline-start" />
              Print report
            </Button>
          </>
        )}
      />
      <div className="surface no-print mb-6">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <TextField label="Report period: from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          <TextField label="Report period: to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </div>
        {!valid && <p role="alert" className="mt-3 text-xs text-destructive">Select an ordered date range of no more than ten years.</p>}
      </div>

      {error && (
        <div className="mb-6">
          <Notice title="Report could not be generated" warning>{error}</Notice>
        </div>
      )}

      {valid && !error && (
        <>
      <p className="mb-5 text-xs text-muted-foreground">
        {new Date(from).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(to).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · Current records only
      </p>
      <StatCards
        stats={[
          { label: 'Published vacancy records', value: report.vacancies, icon: BriefcaseBusiness, note: `${report.openings} openings in these postings` },
          { label: 'applications', value: report.applications, icon: ClipboardCheck },
          { label: 'Recorded referrals', value: report.referrals, icon: Handshake, tone: 'teal' },
          { label: 'placements', value: report.placements, icon: Users, tone: 'teal' },
        ]}
      />
      <div className="mb-6">
        <Notice title="How to read this report">
          All data is provided. Applications are grouped by submission date; placements and referrals reflect their current outcome. Vacancy counts include currently published postings from approved employers posted in the selected period. Resident counts are all-time registrations, not municipal population data.
        </Notice>
      </div>
      <div className="mb-6 grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Applications & placement outcomes" description="Monthly submissions and their current hired outcomes.">
          <EmploymentActivityChart data={report.months} />
        </Panel>
        <Panel title="Opportunity by employment type" description="Currently published vacancy records.">
          <EmploymentTypeChart data={employmentTypes} />
        </Panel>
      </div>
      <div className="mb-6 grid items-start gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="Where opportunities are growing" description="Top six barangays by vacancy records.">
          <BarangayVacancyChart data={report.barangays} />
        </Panel>
        <Panel title="A clear view of the numbers" description="Definitions matter more than a headline number.">
          <dl className="flex flex-col gap-5 text-xs">
            <div>
              <dt className="font-semibold text-navy">Vacancy record ≠ opening</dt>
              <dd className="mt-2 leading-6 text-muted-foreground">One posting can include multiple openings. This period has {report.vacancies} postings with {report.openings} openings.</dd>
            </div>
            <div>
              <dt className="font-semibold text-navy">Referral marker</dt>
              <dd className="mt-2 leading-6 text-muted-foreground">An administrator recorded a referral. No external message or referral form was sent.</dd>
            </div>
            <div>
              <dt className="font-semibold text-navy">Placement outcome</dt>
              <dd className="mt-2 leading-6 text-muted-foreground">An employer marked an application Hired. This is not independently verified employment.</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <Panel title="Across all 24 barangays" description="Zero values are retained so every barangay remains represented.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barangay</TableHead>
              <TableHead>Residents*</TableHead>
              <TableHead>Vacancies</TableHead>
              <TableHead>Applications</TableHead>
              <TableHead>Placements</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.barangays.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium text-navy">{row.name}</TableCell>
                <TableCell>{row.seekers}</TableCell>
                <TableCell>{row.vacancies}</TableCell>
                <TableCell>{row.applications}</TableCell>
                <TableCell>{row.placements}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-4 text-[10px] leading-6 text-muted-foreground">
          *All-time provided registered residents. Other columns follow the selected period and definitions above. For platform review only.
        </p>
      </Panel>
        </>
      )}
    </>
  )
}
