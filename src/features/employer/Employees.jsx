import { useEffect, useMemo, useState } from 'react'
import { Download, UserMinus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useAuth from '@/shared/hooks/useAuth'
import { listByCompany, updateApplicationStatus } from '@/shared/services/applications'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import SeekerProfileCard from '@/shared/components/SeekerProfileCard'
import { EmptyState, PageHeading, Panel, SearchInput, SelectField, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 8
const EMPLOYEE_STATUSES = ['Accepted', 'Terminated']

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

export default function Employees() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!user) return
    // user.id IS the employers row id — no separate lookup needed
    listByCompany(user.id)
      .then((list) => setEmployees((list || []).filter((application) => EMPLOYEE_STATUSES.includes(application.status))))
      .catch((err) => setError(err.message || 'Failed to load employees'))
      .finally(() => setLoading(false))
  }, [user])

  async function setStatus(id, status) {
    try {
      const updated = await updateApplicationStatus(id, status)
      setEmployees((prev) => prev
        .map((employee) => (employee.id === id ? { ...employee, ...(updated || {}), status } : employee))
        .filter((employee) => EMPLOYEE_STATUSES.includes(employee.status)))
      setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev))
    } catch (err) {
      setError(err.message || 'Failed to update the employee.')
    }
  }

  const employmentTypes = useMemo(
    () => [...new Set(employees.map((employee) => employee.job?.employment_type).filter(Boolean))],
    [employees],
  )

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return employees
      .filter((employee) => !statusFilter || employee.status === statusFilter)
      .filter((employee) => !typeFilter || employee.job?.employment_type === typeFilter)
      .filter((employee) => `${employee.seeker?.full_name || ''} ${employee.job?.title || ''}`.toLowerCase().includes(text))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
  }, [employees, query, statusFilter, typeFilter])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function exportCsv() {
    const rows = [
      ['Employee', 'Position', 'Employer approval', 'Date hired', 'Employment status', 'Last updated'],
      ...records.map((employee) => [
        employee.seeker?.full_name || '',
        employee.job?.title || '',
        employee.status === 'Accepted' ? 'Active' : employee.status,
        String(employee.updated_at || '').slice(0, 10),
        employee.status,
        String(employee.updated_at || '').slice(0, 10),
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'employee-tracking.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton stats={4} table label="Loading page." />
  if (error) return <InlineError message={error} />

  const stats = [
    ['Total employees', employees.length],
    ['Currently active', employees.filter((employee) => employee.status === 'Accepted').length],
    ['Resigned or separated', employees.filter((employee) => employee.status === 'Terminated').length],
    ['Positions represented', new Set(employees.map((employee) => employee.job?.title).filter(Boolean)).size],
  ]

  return (
    <>
      <PageHeading
        eyebrow="Beyond the hiring journey"
        title="Employees Tracking"
        description="Linked employment records, recorded milestones, and accountable updates. Separate from recruitment."
        action={(
          <Button variant="outline" disabled={!records.length} onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Download CSV
          </Button>
        )}
      />
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <Panel key={label} title={String(label)}>
            <p className="break-words text-lg font-semibold text-navy">{value}</p>
          </Panel>
        ))}
      </div>
      <Panel title="Employment records" description="Only records permitted for your current role are displayed.">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} label="Search employees" placeholder="Search employee or position…" />
          <div className="sm:w-48">
            <SelectField
              id="employee-status"
              label="Employment status"
              placeholder="All statuses"
              options={[
                { value: 'Accepted', label: 'Active' },
                { value: 'Terminated', label: 'Terminated' },
              ]}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            />
          </div>
          <div className="sm:w-44">
            <SelectField
              id="employee-type"
              label="Employment type"
              placeholder="All types"
              options={employmentTypes}
              value={typeFilter}
              onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}
            />
          </div>
        </div>
        {records.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Date hired</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <p className="font-medium text-navy">{titleCase(employee.seeker?.full_name)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{employee.seeker?.email}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{employee.job?.title}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(employee.updated_at)}</TableCell>
                  <TableCell><StatusBadge status={employee.status === 'Accepted' ? 'Active' : employee.status} /></TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(employee.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setSelected(employee)} aria-label={`View record for ${titleCase(employee.seeker?.full_name)}`}>
                        View record
                      </Button>
                      {employee.status === 'Accepted' ? (
                        <Button variant="ghost" onClick={() => setStatus(employee.id, 'Terminated')} className="text-destructive hover:bg-danger-soft">
                          <UserMinus data-icon="inline-start" />
                          Terminate
                        </Button>
                      ) : (
                        <Button variant="ghost" onClick={() => setStatus(employee.id, 'Accepted')} className="text-success hover:bg-success-soft">
                          <UserPlus data-icon="inline-start" />
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title={employees.length === 0 ? 'No employees yet' : 'No employees match your filters'}
            description={employees.length === 0
              ? 'Candidates you accept in the applicant tracker will appear here.'
              : 'Try adjusting your search or status filter to find employees.'}
          />
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Employee profile</DialogTitle>
                <DialogDescription>
                  {titleCase(selected.seeker?.full_name)} · {titleCase(selected.job?.title)} · {selected.status === 'Accepted' ? 'Active' : selected.status}
                </DialogDescription>
              </DialogHeader>
              <SeekerProfileCard applicant={selected} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
