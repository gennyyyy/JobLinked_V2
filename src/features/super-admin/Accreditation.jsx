import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { listAllAccreditations } from '@/shared/services/admin'
import { listCompanyDocuments, signedUrl, updateAccreditation, updateDocumentStatus } from '@/shared/services/documents'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { CompanyMark, EmptyState, H3, PageHeading, Panel, SelectField, StatusBadge } from '@/shared/components/design'
import { formatFullAddress } from '@/shared/utils/address'
import { titleCase } from '@/shared/utils/titleCase'

const PAGE_SIZE = 10
const STATUS_OPTIONS = [
  { value: 'all', label: 'All review states' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'resubmission', label: 'Resubmission Requested' },
]
const STATUS_LABELS = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  resubmission: 'Resubmission Requested',
  revoked: 'Revoked',
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs font-medium text-navy">{value || '—'}</dd>
    </div>
  )
}

function ReviewModal({ accreditation, onClose, onDecided }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const company = accreditation.employers

  useEffect(() => {
    if (!accreditation) return
    listCompanyDocuments(accreditation.company_id)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [accreditation])

  async function viewDoc(doc) {
    setError('')
    try {
      const url = await signedUrl('documents', doc.file_path)
      window.open(url, '_blank')
    } catch (err) {
      setError(err.message || 'Could not open the document.')
    }
  }

  async function setDocStatus(docId, status) {
    setError('')
    try {
      await updateDocumentStatus(docId, status)
      setDocs(await listCompanyDocuments(accreditation.company_id))
    } catch (err) {
      setError(err.message || 'Failed to update the document status.')
    }
  }

  async function decide(status) {
    const note = reason.trim()
    if (status !== 'approved' && note.length < 10) {
      setError('Give a clear reason of at least 10 characters so the employer knows what to do next.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await updateAccreditation(accreditation.id, {
        status,
        remarks: status === 'approved' ? (note || 'Account verified and accredited.') : note,
      })
      onDecided(accreditation.id, status, note)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update the accreditation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!accreditation} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titleCase(company?.company_name)}</DialogTitle>
          <DialogDescription>
            {company?.industry || 'Employer'} · {titleCase(company?.barangay_district) || 'Santa Maria'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <StatusBadge status={STATUS_LABELS[accreditation.status] || accreditation.status} />
          <dl className="grid grid-cols-1 gap-4 rounded-xl bg-muted p-4 sm:grid-cols-2">
            <InfoRow label="Business address" value={formatFullAddress(company)} />
            <InfoRow label="Contact number" value={company?.phone} />
            <InfoRow label="Company email" value={company?.company_email} />
            <InfoRow label="Submitted" value={new Date(accreditation.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </dl>

          <section>
            <H3 className="text-sm font-semibold text-navy" animated={false}>Accreditation documents</H3>
            <div className="mt-3 rounded-xl border bg-muted/50 p-4">
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No documents uploaded.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-navy">{doc.doc_type}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{doc.file_name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={doc.status === 'verified' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Pending Review'} />
                        <Button type="button" variant="link" size="sm" onClick={() => viewDoc(doc)} className="h-auto p-0 text-xs">View</Button>
                        <Button type="button" variant="link" size="sm" onClick={() => setDocStatus(doc.id, 'verified')} className="h-auto p-0 text-xs">Verify</Button>
                        <Button type="button" variant="link" size="sm" onClick={() => setDocStatus(doc.id, 'rejected')} className="h-auto p-0 text-xs text-destructive">Reject</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <div>
            <Label htmlFor="accreditation-reason" className="mb-2 block text-xs font-medium text-navy">Review feedback / reason</Label>
            <Textarea
              id="accreditation-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain what the employer needs to do next. Required for rejection or resubmission."
            />
            <p className="mt-1 text-[10px] text-muted-foreground">A reason is required for rejection or resubmission. Approval feedback is optional.</p>
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={busy || accreditation.status === 'approved'} onClick={() => decide('approved')}>
              <CheckCircle2 data-icon="inline-start" />
              Approve
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => decide('resubmission')}>
              <RotateCcw data-icon="inline-start" />
              Request documents
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => decide('rejected')}>
              <XCircle data-icon="inline-start" />
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Accreditation() {
  const [accs, setAccs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    listAllAccreditations({ pageSize: 500 })
      .then((result) => setAccs(result.data || []))
      .catch((err) => setError(err.message || 'Failed to load accreditations'))
      .finally(() => setLoading(false))
  }, [])

  const records = useMemo(() => {
    const text = query.toLowerCase()
    return accs
      .filter((item) => statusFilter === 'all' || item.status === statusFilter)
      .filter((item) => {
        const haystack = `${item.employers?.company_name || ''} ${item.employers?.barangay_district || ''} ${item.employers?.industry || ''}`.toLowerCase()
        return haystack.includes(text)
      })
      .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || String(b.submitted_at).localeCompare(String(a.submitted_at)))
  }, [accs, query, statusFilter])

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleDecided(id, status, remarks) {
    setAccs((prev) => prev.map((item) => (item.id === id ? { ...item, status, remarks } : item)))
  }

  if (loading) return <PageSkeleton table label="Loading page." />
  if (error) return <InlineError message={error} />

  return (
    <>
      <PageHeading
        eyebrow="Build trust in every opportunity"
        title="A thoughtful review, a stronger community."
        description="Review employer accreditation, provide actionable feedback, and maintain a clear decision history."
      />
      <Panel
        title="Employer accreditation"
        description="Pending submissions are shown first. All documents are provided metadata records."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="accreditation-search" className="mb-2 block text-xs text-muted-foreground">Search records</Label>
            <Input
              id="accreditation-search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1) }}
              placeholder="Search local employers…"
            />
          </div>
          <div className="sm:w-56">
            <SelectField
              id="accreditation-status"
              label="Accreditation status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            />
          </div>
        </div>

        {records.length === 0 ? (
          <EmptyState title="Your review queue is clear." description="No employers match these filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employer</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CompanyMark initials={String(item.employers?.company_name || 'E').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()} />
                      <div>
                        <p className="font-medium text-navy">{titleCase(item.employers?.company_name)}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {titleCase(item.employers?.barangay_district) || 'Santa Maria'} · {item.employers?.industry || 'Employer'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(item.submitted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell>{item.documents?.length ? `${item.documents.length} documents` : 'View documents'}</TableCell>
                  <TableCell><StatusBadge status={STATUS_LABELS[item.status] || item.status} /></TableCell>
                  <TableCell>
                    <Button variant="outline" onClick={() => setViewing(item)} aria-label={`Review ${titleCase(item.employers?.company_name)}`}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={currentPage} pageSize={PAGE_SIZE} total={records.length} onChange={setPage} />
      </Panel>

      {viewing && <ReviewModal accreditation={viewing} onClose={() => setViewing(null)} onDecided={handleDecided} />}
    </>
  )
}
