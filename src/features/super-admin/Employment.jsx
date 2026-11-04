import { useEffect, useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listEmployees } from '@/shared/services/admin'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, Panel, StatusBadge } from '@/shared/components/design'
import { titleCase } from '@/shared/utils/titleCase'

export default function Employment() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listEmployees()
      .then((rows) => setRecords(Array.isArray(rows) ? rows : rows?.data || []))
      .catch((err) => setError(err.message || 'Failed to load employment records'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton stats={0} table />
  if (error) return <InlineError message={error} />

  const active = records.filter((record) => record.status === 'Accepted').length
  const separated = records.filter((record) => record.status === 'Terminated').length
  const stats = [
    ['Total hired employees', records.length],
    ['Currently active employees', active],
    ['Probationary employees', 0],
    ['Regular employees', 0],
    ['Resigned or separated', separated],
  ]

  return (
    <>
      <PageHeading
        eyebrow="Beyond the hiring journey"
        title="Employment oversight"
        description="Linked employment records, recorded milestones, and accountable updates. Separate from recruitment."
      />
      <div className="my-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Panel key={label} title={String(label)}>
            <p className="break-words text-lg font-semibold text-navy">{value}</p>
          </Panel>
        ))}
      </div>
      <Panel title="Employment records" description="Only records permitted for your current role are displayed.">
        {records.length === 0 ? (
          <EmptyState title="No matching employment records" description="Accepted and terminated applications will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Employer</TableHead>
                <TableHead>Date hired</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="max-w-40 truncate text-[10px] text-muted-foreground" title={record.id}>{record.id}</TableCell>
                  <TableCell className="text-xs font-medium text-navy">{titleCase(record.seeker?.full_name)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{record.job?.title}</TableCell>
                  <TableCell className="text-[11px] uppercase text-muted-foreground">{record.job?.employers?.company_name}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{new Date(record.applied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                  <TableCell><StatusBadge status={record.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  )
}
