import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { listAllAccreditations, listCompanies, updateUser, requestDocs } from '@/shared/services/admin'
import { signedUrl, updateAccreditation, updateDocumentStatus, listCompanyDocuments, latestAccByCompany } from '@/shared/services/documents'
import LoadingScreen from '@/shared/components/LoadingScreen'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import useDialog from '@/shared/hooks/useDialog'
import { InlineError, Pager, SectionCard } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, StatusBadge } from '@/shared/components/design'
import { formatFullAddress } from '@/shared/utils/address'
import { titleCase } from '@/shared/utils/titleCase'

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xs font-medium text-navy">{value || '—'}</dd>
    </div>
  )
}

function DetailModal({ accreditation, onClose }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const panelRef = useDialog(onClose)

  useEffect(() => {
    if (!accreditation) return
    listCompanyDocuments(accreditation.company_id)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [accreditation])

  async function handleViewDoc(doc) {
    setError('')
    try {
      const url = await signedUrl('documents', doc.file_path)
      window.open(url, '_blank')
    } catch (err) {
      setError(err.message || 'Could not open the document.')
    }
  }

  async function handleDocStatus(docId, status) {
    setError('')
    try {
      await updateDocumentStatus(docId, status)
      const updated = await listCompanyDocuments(accreditation.company_id)
      setDocs(updated)
    } catch (err) {
      setError(err.message || 'Failed to update the document status.')
    }
  }

  if (!accreditation) return null
  const company = accreditation.employers

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accreditation-detail-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl md:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b pb-4">
          <div className="min-w-0">
            <p className="eyebrow">Application documents</p>
            <h2 id="accreditation-detail-title" className="mt-2 truncate text-xl font-semibold tracking-tight text-navy">{titleCase(company?.company_name)}</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Submitted {new Date(accreditation.submitted_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        </div>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[.14em] text-teal">Company information</h3>
          <dl className="mt-3 grid grid-cols-1 gap-4 rounded-xl border bg-muted/50 p-4">
            <InfoRow label="Company Name" value={company?.company_name} />
            <InfoRow label="Barangay" value={company?.barangay_district} />
            <InfoRow label="Business Address" value={formatFullAddress(company)} />
            <InfoRow label="Contact Number" value={company?.phone} />
            <InfoRow label="Industry" value={company?.industry} />
          </dl>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[.14em] text-teal">Accreditation documents</h3>
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
                      <Badge
                        variant="secondary"
                        className={doc.status === 'verified'
                          ? 'bg-success-soft text-success'
                          : doc.status === 'rejected'
                            ? 'bg-danger-soft text-destructive'
                            : 'bg-warning-soft text-warning'}
                      >
                        {doc.status}
                      </Badge>
                      <Button type="button" variant="link" size="sm" onClick={() => handleViewDoc(doc)} className="h-auto p-0 text-xs">View</Button>
                      <Button type="button" variant="link" size="sm" onClick={() => handleDocStatus(doc.id, 'verified')} className="h-auto p-0 text-xs">Verify</Button>
                      <Button type="button" variant="link" size="sm" onClick={() => handleDocStatus(doc.id, 'rejected')} className="h-auto p-0 text-xs text-destructive">Reject</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        {error && <p role="alert" className="mt-3 text-[11px] text-destructive">{error}</p>}

        <div className="mt-8 flex justify-end border-t pt-5">
          <Button type="button" variant="outline" onClick={onClose}>Close Documents</Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Accreditation() {
  const [accs, setAccs] = useState([])
  const [accPage, setAccPage] = useState(1)
  const [accPageSize, setAccPageSize] = useState(0)
  const [accTotal, setAccTotal] = useState(0)
  const [companies, setCompanies] = useState([])
  const [companyPage, setCompanyPage] = useState(1)
  const [companyPageSize, setCompanyPageSize] = useState(0)
  const [companyTotal, setCompanyTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectError, setRejectError] = useState(false)
  const [requestingId, setRequestingId] = useState(null)
  const [requestNote, setRequestNote] = useState('')
  const [requestError, setRequestError] = useState('')
  const [viewingId, setViewingId] = useState(null)
  const [revoking, setRevoking] = useState(null)
  const [actionError, setActionError] = useState('')

  // Both lists arrive as the { data, total, page, pageSize } envelope (C2);
  // one effect drives both pagers.
  useEffect(() => {
    Promise.all([listAllAccreditations({ page: accPage }), listCompanies({ page: companyPage })])
      .then(([allAccs, comps]) => {
        setAccs(allAccs.data)
        setAccTotal(allAccs.total)
        setAccPageSize(allAccs.pageSize)
        setCompanies(comps.data)
        setCompanyTotal(comps.total)
        setCompanyPageSize(comps.pageSize)
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [accPage, companyPage])

  if (loading) return <LoadingScreen />
  if (error) return <InlineError message={error} />

  // accs is ordered by submitted_at desc, so the first row per company is its latest
  const pending = accs.filter((a) => a.status === 'pending')
  const latestByCompany = latestAccByCompany(accs)

  async function handleApprove(acc) {
    setActionError('')
    try {
      await updateAccreditation(acc.id, { status: 'approved', remarks: 'Account verified and accredited.' })
      setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: 'approved' } : a)))
      setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: 'approved' } : c)))
    } catch (err) {
      setActionError(err.message || 'Failed to accredit employer.')
    }
  }

  async function startReject(acc) {
    setRejectingId(acc.id)
    setRejectNote('')
    setRejectError(false)
  }

  async function confirmReject(acc) {
    const note = rejectNote.trim()
    if (!note) { setRejectError(true); return }
    setActionError('')
    try {
      await updateAccreditation(acc.id, { status: 'rejected', remarks: note })
      setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: 'rejected', remarks: note } : a)))
      setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: 'rejected' } : c)))
      setRejectingId(null)
      setRejectNote('')
      setRejectError(false)
    } catch (err) {
      setActionError(err.message || 'Failed to reject accreditation.')
    }
  }

  // Request-documents resubmission reuses the reject-modal remarks pattern:
  // PATCH accreditations/:id { status: 'resubmission', remarks }. Shape
  // matches the admin accreditation contract ({ status, remarks? }); if the
  // backend rejects the status, the row stays pending and the error shows.
  async function confirmRequestDocs(acc) {
    const note = requestNote.trim()
    if (!note) { setRequestError('Please list the documents required.'); return }
    try {
      await requestDocs(acc.id, note)
      setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: 'resubmission', remarks: note } : a)))
      setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: 'resubmission' } : c)))
      setRequestingId(null)
      setRequestNote('')
      setRequestError('')
    } catch (err) {
      setRequestError(err.message || 'Request failed — resubmission status rejected by the server.')
    }
  }

  async function toggleCompanyStatus(company) {
    const newStatus = company.status === 'suspended' ? 'active' : 'suspended'
    setActionError('')
    try {
      await updateUser(company.id, { status: newStatus })
      const updated = await listCompanies({ page: companyPage })
      setCompanies(updated.data)
      setCompanyTotal(updated.total)
      setCompanyPageSize(updated.pageSize)
    } catch (err) {
      setActionError(err.message || 'Failed to update employer status.')
    }
  }

  async function confirmRevoke() {
    const acc = latestByCompany[revoking.id]
    const remarks = 'Accreditation revoked by PESO.'
    setActionError('')
    try {
      await updateAccreditation(acc.id, { status: 'revoked', remarks })
      setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: 'revoked', remarks } : a)))
      setCompanies((prev) => prev.map((c) => (c.id === revoking.id ? { ...c, accreditation_status: 'revoked' } : c)))
      setRevoking(null)
    } catch (err) {
      setActionError(err.message || 'Failed to revoke accreditation.')
    }
  }

  async function reinstate(acc) {
    const remarks = 'Accreditation reinstated by PESO.'
    setActionError('')
    try {
      await updateAccreditation(acc.id, { status: 'approved', remarks })
      setAccs((prev) => prev.map((a) => (a.id === acc.id ? { ...a, status: 'approved', remarks } : a)))
      setCompanies((prev) => prev.map((c) => (c.id === acc.company_id ? { ...c, accreditation_status: 'approved' } : c)))
    } catch (err) {
      setActionError(err.message || 'Failed to reinstate accreditation.')
    }
  }

  const viewingAcc = viewingId ? pending.find((a) => a.id === viewingId) : null

  return (
    <>
      <PageHeading
        eyebrow="Employer directory"
        title="Accreditation management"
        description="Verify municipal employer applications and manage compliance statuses."
      />

      {actionError && <InlineError message={actionError} />}

      <div className="flex flex-col gap-6">
        <SectionCard
          className="p-0"
          title="Pending accreditation"
          subtitle="New submissions appear here first."
          action={<Badge variant="secondary" className="bg-warning-soft text-warning">{pending.length} PENDING</Badge>}
        >
          {pending.length === 0 ? (
            <EmptyState title="No employers currently waiting for accreditation verification." description="New submissions will appear here." />
          ) : (
            <ul className="flex flex-col divide-y">
              {pending.map((acc) => (
                <li key={acc.id} className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 lg:flex-row lg:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">{titleCase(acc.employers?.company_name)}</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {formatFullAddress(acc.employers) || 'Address not provided'}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Submitted {new Date(acc.submitted_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    {requestingId === acc.id ? (
                      <div className="flex w-full flex-col gap-2 sm:w-72">
                        <Label htmlFor={`request-docs-${acc.id}`} className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Documents required</Label>
                        <Textarea
                          id={`request-docs-${acc.id}`}
                          value={requestNote}
                          onChange={(e) => { setRequestNote(e.target.value); setRequestError('') }}
                          rows={2}
                          placeholder="List the missing or deficient documents…"
                          className="text-xs"
                        />
                        {requestError && <p className="text-[11px] text-destructive">{requestError}</p>}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={() => confirmRequestDocs(acc)} className="flex-1">Confirm Request</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setRequestingId(null); setRequestError('') }}>Cancel</Button>
                        </div>
                      </div>
                    ) : rejectingId === acc.id ? (
                      <div className="flex w-full flex-col gap-2 sm:w-72">
                        <Label htmlFor={`reject-note-${acc.id}`} className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Rejection reason</Label>
                        <Textarea
                          id={`reject-note-${acc.id}`}
                          value={rejectNote}
                          onChange={(e) => { setRejectNote(e.target.value); setRejectError(false) }}
                          rows={2}
                          placeholder="Reason for rejection or required changes..."
                          className="text-xs"
                        />
                        {rejectError && <p className="text-[11px] text-destructive">Please enter a rejection reason.</p>}
                        <div className="flex gap-2">
                          <Button type="button" variant="destructive" size="sm" onClick={() => confirmReject(acc)} className="flex-1">Confirm Rejection</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRejectingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setViewingId(acc.id)}>View Documents</Button>
                        <Button type="button" size="sm" onClick={() => handleApprove(acc)}>Accredit</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setRequestingId(acc.id); setRequestNote(''); setRequestError('') }}>Request Documents</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => startReject(acc)} className="text-destructive">Reject</Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager page={accPage} pageSize={accPageSize} total={accTotal} onChange={setAccPage} />
        </SectionCard>

        <SectionCard
          className="p-0"
          title={`Registered Employers (${companyTotal})`}
          subtitle="Account status and accreditation for every employer."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Accreditation</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="whitespace-normal text-xs font-medium text-navy">{titleCase(company.company_name)}</TableCell>
                  <TableCell className="whitespace-normal text-[11px] text-muted-foreground">{titleCase(company.full_name)}</TableCell>
                  <TableCell className="whitespace-normal break-all text-[11px] text-muted-foreground">{company.email}</TableCell>
                  <TableCell><StatusBadge status={company.status} /></TableCell>
                  <TableCell>
                    {/* Read directly from the employers row — kept in sync by documents.js */}
                    <StatusBadge status={company.accreditation_status || 'not applied'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {latestByCompany[company.id]?.status === 'approved' && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRevoking(company)} className="text-destructive">Revoke</Button>
                      )}
                      {latestByCompany[company.id]?.status === 'revoked' && (
                        <Button type="button" variant="link" size="sm" onClick={() => reinstate(latestByCompany[company.id])} className="h-auto p-0 text-xs">Reinstate</Button>
                      )}
                      <Button type="button" variant="link" size="sm" onClick={() => toggleCompanyStatus(company)} className={`h-auto p-0 text-xs ${company.status === 'suspended' ? '' : 'text-destructive'}`}>
                        {company.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager page={companyPage} pageSize={companyPageSize} total={companyTotal} onChange={setCompanyPage} />
        </SectionCard>
      </div>

      {viewingAcc && (
        <DetailModal
          accreditation={viewingAcc}
          onClose={() => setViewingId(null)}
        />
      )}

      {revoking && (
        <ConfirmationModal
          message={`Revoke accreditation for ${revoking.company_name}? They will no longer be able to post job vacancies until reinstated.`}
          confirmLabel="Revoke Accreditation"
          danger
          onConfirm={confirmRevoke}
          onCancel={() => setRevoking(null)}
        />
      )}
    </>
  )
}

export default Accreditation
