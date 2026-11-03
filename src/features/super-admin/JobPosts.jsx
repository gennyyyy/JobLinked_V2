import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { listAllJobs, editJob, publishJob, unpublishJob } from '@/shared/services/admin'
import { changeJobStatus } from '@/shared/services/jobs'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { InlineError, Pager } from '@/shared/components/dashboard'
import { EmptyState, PageHeading, Panel, StatusBadge, TextField } from '@/shared/components/design'

// Minimal admin edit modal (prefill → PATCH admin/jobs/:id). The employer
// JobForm lives inside the employer page and can't be imported without
// dragging employer logic along — this covers admin corrections.
function EditModal({ job, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: job.title || '',
    location: job.location || '',
    vacancies: job.vacancies || 1,
    deadline: job.deadline ? job.deadline.split('T')[0] : '',
    description: job.description || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title.trim()) { setError('Job title is required'); return }
    setError('')
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        location: form.location.trim() || null,
        vacancies: Number(form.vacancies) || 1,
        deadline: form.deadline || null,
        description: form.description.trim(),
      }
      const updated = await editJob(job.id, payload)
      onSaved(updated || { ...job, ...payload })
    } catch (err) {
      setError(err.message || 'Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl md:p-6">
        <p className="eyebrow">Edit job post</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-navy">Correct listing</h2>
        <div className="mt-5 flex flex-col gap-4">
          <TextField
            id="edit-title"
            label="Job title"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            id="edit-location"
            label="Location"
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="edit-vacancies"
              label="Vacancies"
              type="number"
              min="1"
              value={form.vacancies}
              onChange={(e) => setForm({ ...form, vacancies: e.target.value })}
            />
            <TextField
              id="edit-deadline"
              label="Deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          <TextField
            id="edit-description"
            label="Description"
            multiline
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function JobPosts() {
  const [jobs, setJobs] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [confirmArchiveId, setConfirmArchiveId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState('')

  // Jobs arrive as the { data, total, page, pageSize } envelope (C2).
  useEffect(() => {
    listAllJobs({ page })
      .then((res) => { setJobs(res.data); setTotal(res.total); setPageSize(res.pageSize) })
      .catch((err) => setError(err.message || 'Failed to load jobs'))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <LoadingScreen />
  if (error) return <InlineError message={error} />

  async function handleAction(job, action) {
    try {
      await changeJobStatus(job.id, action)
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: action, remarks: null } : j)))
    } catch (err) {
      setError(err.message)
    }
  }

  // Admin publish/unpublish (POST admin/jobs/:id/publish|unpublish).
  // 404 = backend item missing → graceful error state, no invented fallback.
  async function handlePublishToggle(job) {
    setActionError('')
    try {
      const updated = job.status === 'published' ? await unpublishJob(job.id) : await publishJob(job.id)
      const next = updated?.status || (job.status === 'published' ? 'draft' : 'published')
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, ...updated, status: next } : j)))
    } catch (err) {
      setActionError(err.message || 'Failed to update publish state')
    }
  }

  async function confirmArchive() {
    await handleAction(jobs.find((j) => j.id === confirmArchiveId), 'archived')
    setConfirmArchiveId(null)
  }

  const isExpired = (j) => Boolean(j.deadline) && new Date(j.deadline) < new Date() && j.status !== 'archived'
  const filtered = jobs.filter((j) => {
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'expired' ? isExpired(j) : j.status === statusFilter
    const matchesSearch = !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.employers?.company_name?.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const statusLabel = (status) => {
    const map = { draft: 'Draft', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', published: 'Published', closed: 'Closed', archived: 'Archived' }
    return map[status] || status
  }

  return (
    <>
      <PageHeading
        eyebrow="Central bulletin"
        title="All Municipal Job Postings"
        description="Monitor active job listings from accredited Santa Maria employers."
      />

      {actionError && <InlineError message={actionError} />}

      <Panel
        title="Job postings"
        description="Publish or unpublish a listing to control what job seekers can see."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="sm:w-56">
            <Label htmlFor="job-status-filter" className="mb-2 text-xs text-muted-foreground">Status</Label>
            <select
              id="job-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="expired">Expired (past deadline)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex-1 sm:min-w-[200px]">
            <Label htmlFor="job-search" className="mb-2 text-xs text-muted-foreground">Search</Label>
            <Input
              id="job-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or company…"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">{filtered.length} records</p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No job posts found." description="Try another status filter or search term." />
        ) : (
          <Table className="table-fixed">
            <colgroup>
              <col />
              <col style={{ width: '180px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '140px' }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Job Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="whitespace-normal text-xs font-medium text-navy">{post.title}</TableCell>
                  <TableCell className="truncate text-[11px] uppercase text-muted-foreground">{post.employers?.company_name}</TableCell>
                  <TableCell className="truncate text-[11px] text-muted-foreground">{post.location}</TableCell>
                  <TableCell>
                    <StatusBadge status={statusLabel(post.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    {post.status === 'published' ? (
                      <Button variant="outline" size="sm" onClick={() => handlePublishToggle(post)}>Unpublish</Button>
                    ) : (
                      post.status !== 'archived' && (
                        <Button size="sm" onClick={() => handlePublishToggle(post)}>Publish</Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pager page={page} pageSize={pageSize} total={total} onChange={setPage} />
      </Panel>

      {editing && (
        <EditModal
          job={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)))
            setEditing(null)
          }}
        />
      )}

      {confirmArchiveId && (
        <ConfirmationModal
          message="Are you sure you want to archive this job post?"
          onConfirm={confirmArchive}
          onCancel={() => setConfirmArchiveId(null)}
          confirmLabel="Archive"
          danger
        />
      )}
    </>
  )
}

export default JobPosts
