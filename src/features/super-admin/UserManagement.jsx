import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { listUsers, updateUser, listRoles, assignRole, assignCustomRole, inviteUser, listAuditLogs, listSeekerEducation, listSeekerExperience, listSeekerEmployment, listSeekerResumes } from '@/shared/services/admin'
import { signedUrl } from '@/shared/services/documents'
import useAuth from '@/shared/hooks/useAuth'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager } from '@/shared/components/dashboard'
import useDialog from '@/shared/hooks/useDialog'
import { titleCase } from '@/shared/utils/titleCase'
import { EmptyState, PageHeading, Panel, SearchInput, SelectField, StatusBadge, TextField } from '@/shared/components/design'

const SYSTEM_ROLE_LABELS = { 'super-admin': 'Super Admin', employer: 'Employer', 'job-seeker': 'Job Seeker' }

const EMPTY_INVITE = {
  email: '', role: '', first_name: '', middle_name: '', last_name: '',
  suffix: '', phone: '', company_name: '',
}

const formatDetailDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  : '—')

const detailPeriod = (start, end) => (start || end
  ? `${formatDetailDate(start)} – ${end ? formatDetailDate(end) : 'Present'}`
  : '—')

function DetailRecord({ items }) {
  return (
    <li className="rounded-xl border p-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-xs text-navy">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(0)
  const [total, setTotal] = useState(0)
  const [customRoles, setCustomRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE)
  const [inviting, setInviting] = useState(false)
  const [history, setHistory] = useState([])
  const [accessTarget, setAccessTarget] = useState(null)
  const [accessRole, setAccessRole] = useState('')
  const [accessStatus, setAccessStatus] = useState('active')
  const [accessReason, setAccessReason] = useState('')
  const [accessError, setAccessError] = useState('')
  const [accessBusy, setAccessBusy] = useState(false)
  const [accessConfirmed, setAccessConfirmed] = useState(false)
  const [detailUser, setDetailUser] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [viewingResumeId, setViewingResumeId] = useState(null)

  const inviteRef = useDialog(() => setShowInvite(false), showInvite)

  // Users arrive as the { data, total, page, pageSize } envelope (C2). Role and
  // search are filtered server-side (GET /admin/users accepts role/search/status)
  // so a query isn't trapped inside the current 25-row page.
  const loadReqRef = useRef(0)
  const loadUsers = useCallback((p) => {
    const params = { page: p }
    if (filterRole !== 'all') params.role = filterRole
    if (statusFilter) params.status = statusFilter.toLowerCase()
    if (debouncedSearch) params.search = debouncedSearch
    const req = ++loadReqRef.current
    return listUsers(params).then((res) => {
      if (req !== loadReqRef.current) return // drop a superseded fetch
      setUsers(res.data)
      setTotal(res.total)
      setPageSize(res.pageSize)
    })
  }, [filterRole, statusFilter, debouncedSearch])

  useEffect(() => { loadUsers(page).catch((err) => setError(err.message || 'Failed to load users')) }, [loadUsers, page])

  // Debounce the search box (mirrors Jobs/JobPosts) so each keystroke doesn't refetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    const loadAll = async () => {
      const first = await listUsers({ pageSize: 500, page: 1 })
      const all = [...(first?.data || [])]
      const total = first?.total || all.length
      const size = first?.pageSize || 500
      const pages = Math.ceil(total / size)
      for (let p = 2; p <= pages; p += 1) {
        const res = await listUsers({ pageSize: size, page: p })
        all.push(...(res?.data || []))
      }
      return all
    }
    Promise.all([
      listRoles().catch(() => []),
      listAuditLogs({ action: 'user.role.change', limit: 50 }).catch(() => []),
      loadAll().catch(() => []),
    ])
      .then(([roles, logs, everyone]) => {
        setCustomRoles(roles || [])
        setHistory(Array.isArray(logs) ? logs : [])
        setAllUsers(Array.isArray(everyone) ? everyone : (everyone?.data || []))
      })
      .finally(() => setLoading(false))
  }, [])

  // Admin seeker depth (Addendum A): the four child reads fire together when
  // the dialog opens, so tab switches are instant and there is one error line.
  useEffect(() => {
    if (!detailUser) return undefined
    let cancelled = false
    const id = detailUser.id
    Promise.all([
      listSeekerEducation(id), listSeekerExperience(id), listSeekerEmployment(id), listSeekerResumes(id),
    ])
      .then(([education, experience, employment, resumes]) => {
        if (!cancelled) setDetail({ education: education || [], experience: experience || [], employment: employment || [], resumes: resumes || [] })
      })
      .catch((err) => { if (!cancelled) setDetailError(err.message || 'Failed to load seeker details') })
    return () => { cancelled = true }
  }, [detailUser])

  if (loading) return <PageSkeleton stats={0} table />
  if (error) return <InlineError message={error} />

  function openAccess(user) {
    setAccessTarget(user)
    setAccessRole(user.custom_role_id ? `custom:${user.custom_role_id}` : `sys:${user.role}`)
    setAccessStatus(user.status === 'active' ? 'active' : 'suspended')
    setAccessReason('')
    setAccessError('')
    setAccessConfirmed(false)
  }

  async function confirmAccess(event) {
    event.preventDefault()
    if (!accessTarget) return
    if (accessReason.trim().length < 10) {
      setAccessError('Give a clear reason of at least 10 characters.')
      return
    }
    setAccessBusy(true)
    setAccessError('')
    try {
      if (accessRole.startsWith('custom:')) {
        const role = customRoles.find((item) => String(item.id) === accessRole.slice(7))
        if (!role) throw new Error('Custom role not found — refresh the page')
        if (accessTarget.role !== role.base_role) await assignRole(accessTarget.id, role.base_role)
        await assignCustomRole(accessTarget.id, role.id)
      } else if (accessRole.startsWith('sys:')) {
        const role = accessRole.slice(4)
        if (accessTarget.custom_role_id) await assignCustomRole(accessTarget.id, null)
        if (accessTarget.role !== role) await assignRole(accessTarget.id, role)
      }
      if (accessStatus !== accessTarget.status) await updateUser(accessTarget.id, { status: accessStatus })
      await loadUsers(page)
      setSuccess(`Access updated for ${accessTarget.full_name || accessTarget.email}.`)
      setAccessTarget(null)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setAccessError(err.message || 'Failed to update access')
    } finally {
      setAccessBusy(false)
    }
  }

  function openDetail(user) {
    setDetailUser(user)
    setDetail(null)
    setDetailError('')
  }

  // Same gesture rule as the seeker's own Profile: the tab opens inside the
  // click so popup blockers allow it, then receives the fetched blob URL.
  async function openResume(resume) {
    setViewingResumeId(resume.id)
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await signedUrl('resumes', resume.file_path)
      if (tab) tab.location.href = url
      // Do not revoke: tab may still be open (Task 12).
    } catch (err) {
      tab?.close()
      setDetailError(err.message || 'Could not open the resume')
    } finally {
      setViewingResumeId(null)
    }
  }

  // Invite (ADR-024): role select carries either a system role or `custom:<id>`;
  // a custom selection must also send its base_role (spec §5.1).
  const inviteBaseRole = inviteForm.role.startsWith('custom:')
    ? customRoles.find((r) => String(r.id) === inviteForm.role.slice(7))?.base_role
    : inviteForm.role

  function setInviteField(field, value) {
    setInviteForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleInvite(e) {
    e.preventDefault()
    setActionError('')
    setSuccess('')
    setInviting(true)
    try {
      const payload = {
        email: inviteForm.email,
        first_name: inviteForm.first_name,
        middle_name: inviteForm.middle_name,
        last_name: inviteForm.last_name,
        suffix: inviteForm.suffix,
        phone: inviteForm.phone,
      }
      if (inviteBaseRole === 'employer') payload.company_name = inviteForm.company_name
      if (inviteForm.role.startsWith('custom:')) {
        const role = customRoles.find((r) => String(r.id) === inviteForm.role.slice(7))
        if (!role) throw new Error('Custom role not found — refresh the page')
        payload.custom_role_id = Number(role.id)
        payload.role = role.base_role
      } else {
        payload.role = inviteForm.role
      }
      await inviteUser(payload)
      setSuccess(`Invite sent to ${inviteForm.email}`)
      setShowInvite(false)
      setInviteForm(EMPTY_INVITE)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setActionError(err.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const roleOptions = [
    { value: 'all', label: 'All roles' },
    { value: 'super-admin', label: SYSTEM_ROLE_LABELS['super-admin'] },
    { value: 'employer', label: SYSTEM_ROLE_LABELS.employer },
    { value: 'job-seeker', label: SYSTEM_ROLE_LABELS['job-seeker'] },
  ]
  const accessRoleOptions = [
    ...Object.entries(SYSTEM_ROLE_LABELS).map(([value, label]) => ({ value: `sys:${value}`, label })),
    ...customRoles.map((role) => ({ value: `custom:${role.id}`, label: role.name })),
  ]

  const statsUsers = allUsers.length ? allUsers : users
  const jobSeekerCount = statsUsers.filter((row) => row.role === 'job-seeker').length
  const employerCount = statsUsers.filter((row) => row.role === 'employer').length
  const adminCount = statsUsers.filter((row) => row.role === 'super-admin').length
  const activeCount = statsUsers.filter((row) => row.status === 'active').length
  const suspendedCount = statsUsers.filter((row) => row.status !== 'active').length
  const totalUsers = allUsers.length || total

  return (
    <div className="space-y-6 pb-12">
      <div>
        <PageHeading
          title="User Management"
          description="Find registered users, assign their system roles, and manage account access."
          action={(
            <Button type="button" onClick={() => { setActionError(''); setShowInvite(true) }}>
              Add user
            </Button>
          )}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Panel title="Total system users"><p className="text-2xl font-semibold text-navy">{totalUsers}</p></Panel>
        <Panel title="Job seekers"><p className="text-2xl font-semibold text-navy">{jobSeekerCount}</p></Panel>
        <Panel title="Employers"><p className="text-2xl font-semibold text-navy">{employerCount}</p></Panel>
        <Panel title="PESO administrators"><p className="text-2xl font-semibold text-navy">{adminCount}</p></Panel>
        <Panel title="Active accounts"><p className="text-2xl font-semibold text-navy">{activeCount}</p></Panel>
        <Panel title="Suspended accounts"><p className="text-2xl font-semibold text-navy">{suspendedCount}</p></Panel>
      </div>

      {success && <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">{success}</p>}
      {actionError && <InlineError message={actionError} />}

      <Panel
        title="System users"
        description="Your own elevated permissions cannot be modified. Job seeker and employer roles require an existing matching profile."
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput
            value={searchTerm}
            onChange={(value) => { setSearchTerm(value); setPage(1) }}
            label="Search users by name or email"
            placeholder="Search user ID, name, or email…"
          />
          <div className="sm:w-48">
            <SelectField
              id="role-filter"
              label="Assigned role"
              options={roleOptions}
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}
            />
          </div>
          <div className="sm:w-44">
            <SelectField
              id="status-filter"
              label="Account status"
              placeholder="All accounts"
              options={['Active', 'Suspended']}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Full name</TableHead>
                  <TableHead>Email address</TableHead>
                  <TableHead>Assigned role</TableHead>
                  <TableHead>Account status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="whitespace-normal text-[10px] text-muted-foreground">{user.id}</TableCell>
                    <TableCell className="whitespace-normal text-xs font-medium text-navy">{titleCase(user.full_name)}</TableCell>
                    <TableCell className="whitespace-normal break-all text-[11px] text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-navy">{SYSTEM_ROLE_LABELS[user.role] || user.role}</span>
                        {user.custom_role_id && (
                          <span className="text-[10px] text-primary">
                            {customRoles.find((role) => String(role.id) === String(user.custom_role_id))?.name || 'Custom role'}
                          </span>
                        )}
                        {currentUser && user.id === currentUser.id && (
                          <span className="text-[9px] uppercase tracking-[.14em] text-muted-foreground">You — role locked</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={user.status} /></TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {new Date(user.updated_at || user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.role === 'job-seeker' && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openDetail(user)}
                            aria-label={`View profile details for ${titleCase(user.full_name)}`}
                          >
                            View
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openAccess(user)}
                          disabled={currentUser && user.id === currentUser.id}
                        >
                          Manage access
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div><Pager page={page} pageSize={pageSize} total={total} onChange={setPage} /></div>
      </Panel>

      <Panel
        title="Role and access change history"
        description="Previous role, new role, responsible administrator, timestamp, and reason are retained."
      >
        {history.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {['User', 'Previous role', 'New role', 'Access', 'Administrator', 'Timestamp', 'Reason'].map((heading) => (
                  <TableHead key={heading}>{heading}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{users.find((row) => String(row.id) === String(log.entity_id))?.full_name || '—'}</TableCell>
                  <TableCell className="text-xs">{SYSTEM_ROLE_LABELS[log.details?.from] || log.details?.from || '—'}</TableCell>
                  <TableCell className="text-xs">{SYSTEM_ROLE_LABELS[log.details?.to] || log.details?.to || '—'}</TableCell>
                  <TableCell className="text-xs">—</TableCell>
                  <TableCell className="text-xs">{log.actor_name || '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(log.created_at).toLocaleString('en-PH')}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal break-words text-xs">{log.details?.reason || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No access changes yet" description="Confirmed role and account changes will appear here." />
        )}
      </Panel>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
          <form
            ref={inviteRef}
            onSubmit={handleInvite}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b pb-4">
              <div>
                <p className="eyebrow">Invite</p>
                <h2 id="invite-title" className="mt-2 text-lg font-semibold tracking-tight text-navy">Add user</h2>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Send an invitation email to onboard a new municipal user or partner.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowInvite(false)} aria-label="Close">
                <X aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="invite-email" className="mb-2 text-xs text-muted-foreground">Email</Label>
                <Input id="invite-email" type="email" required placeholder="e.g. juan.delacruz@example.com" value={inviteForm.email} onChange={(e) => setInviteField('email', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="invite-role" className="mb-2 text-xs text-muted-foreground">Role</Label>
                <select id="invite-role" required value={inviteForm.role} onChange={(e) => setInviteField('role', e.target.value)} className="form-select">
                  <option value="" disabled>Select a role…</option>
                  <optgroup label="System roles">
                    {Object.entries(SYSTEM_ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </optgroup>
                  {customRoles.length > 0 && (
                    <optgroup label="Custom roles">
                      {customRoles.map((r) => (
                        <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <Label htmlFor="invite-first" className="mb-2 text-xs text-muted-foreground">First name</Label>
                <Input id="invite-first" type="text" required placeholder="e.g. Juan" value={inviteForm.first_name} onChange={(e) => setInviteField('first_name', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="invite-middle" className="mb-2 text-xs text-muted-foreground">Middle name</Label>
                <Input id="invite-middle" type="text" placeholder="e.g. Santos (optional)" value={inviteForm.middle_name} onChange={(e) => setInviteField('middle_name', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="invite-last" className="mb-2 text-xs text-muted-foreground">Last name</Label>
                <Input id="invite-last" type="text" required placeholder="e.g. Dela Cruz" value={inviteForm.last_name} onChange={(e) => setInviteField('last_name', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="invite-suffix" className="mb-2 text-xs text-muted-foreground">Suffix</Label>
                <Input id="invite-suffix" type="text" placeholder="e.g. Jr., III (optional)" value={inviteForm.suffix} onChange={(e) => setInviteField('suffix', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="invite-phone" className="mb-2 text-xs text-muted-foreground">Phone</Label>
                <Input id="invite-phone" type="tel" placeholder="e.g. 0917 123 4567" value={inviteForm.phone} onChange={(e) => setInviteField('phone', e.target.value)} />
              </div>
              {inviteBaseRole === 'employer' && (
                <div className="sm:col-span-2">
                  <Label htmlFor="invite-company" className="mb-2 text-xs text-muted-foreground">Company name</Label>
                  <Input id="invite-company" type="text" required placeholder="e.g. San Miguel Corporation" value={inviteForm.company_name} onChange={(e) => setInviteField('company_name', e.target.value)} />
                </div>
              )}
            </div>

            {actionError && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-danger-soft px-4 py-3 text-xs text-destructive">{actionError}</p>}

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button type="submit" disabled={inviting}>{inviting ? 'Sending…' : 'Send invite'}</Button>
            </div>
          </form>
        </div>
      )}

      <Dialog open={!!accessTarget} onOpenChange={(open) => { if (!open) setAccessTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage {accessTarget?.full_name || accessTarget?.email}</DialogTitle>
            <DialogDescription>
              Confirm the role and account state before applying. Every change requires a reason and is audited.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmAccess} className="flex flex-col gap-5">
            <TextField label="User ID" readOnly value={accessTarget?.id || ''} />
            <SelectField
              id="access-role"
              label="Assigned system role"
              options={accessRoleOptions}
              value={accessRole}
              onChange={(event) => setAccessRole(event.target.value)}
            />
            <SelectField
              id="access-status"
              label="Account access"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
              ]}
              value={accessStatus}
              onChange={(event) => setAccessStatus(event.target.value)}
            />
            <div>
              <Label htmlFor="access-reason" className="mb-2 block text-xs text-muted-foreground">Reason for change</Label>
              <Textarea
                id="access-reason"
                rows={3}
                value={accessReason}
                onChange={(event) => { setAccessReason(event.target.value); setAccessError('') }}
                placeholder="Explain why this access change is needed."
              />
            </div>
            <Field orientation="horizontal">
              <Checkbox id="access-confirm" checked={accessConfirmed} onCheckedChange={(value) => setAccessConfirmed(value === true)} />
              <FieldLabel htmlFor="access-confirm">I confirm this role or permission change.</FieldLabel>
            </Field>
            {accessError && <p role="alert" className="text-xs text-destructive">{accessError}</p>}
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setAccessTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={accessBusy || !accessConfirmed}>{accessBusy ? 'Saving…' : 'Confirm access change'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailUser}
        onOpenChange={(open) => {
          if (!open) { setDetailUser(null); setDetail(null); setDetailError('') }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seeker profile — {detailUser?.full_name || detailUser?.email}</DialogTitle>
            <DialogDescription>Education, work experience, employment history, and resumes on file.</DialogDescription>
          </DialogHeader>
          {detailError && <InlineError message={detailError} />}
          {!detail && !detailError && (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading seeker records…</p>
          )}
          {detail && (
            <>
              <Tabs defaultValue="background">
                <TabsList>
                  <TabsTrigger value="background">Background</TabsTrigger>
                  <TabsTrigger value="experience">Experience</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                </TabsList>
                <TabsContent value="background" className="mt-2">
                  {detail.education.length ? (
                    <ul className="flex flex-col gap-3">
                      {detail.education.map((row) => (
                        <DetailRecord key={row.id} items={[
                          ['Level', row.level],
                          ['School', row.school],
                          ['Field', row.field],
                          ['Years', [row.start_year, row.end_year].filter(Boolean).join(' – ') || '—'],
                        ]} />
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">No education records.</p>
                  )}
                </TabsContent>
                <TabsContent value="experience" className="mt-2">
                  {detail.experience.length ? (
                    <ul className="flex flex-col gap-3">
                      {detail.experience.map((row) => (
                        <DetailRecord key={row.id} items={[
                          ['Company', row.company],
                          ['Position', row.position],
                          ['Period', detailPeriod(row.start_date, row.end_date)],
                          ['Description', row.description],
                        ]} />
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">No work experience records.</p>
                  )}
                </TabsContent>
                <TabsContent value="employment" className="mt-2">
                  {detail.employment.length ? (
                    <ul className="flex flex-col gap-3">
                      {detail.employment.map((row) => (
                        <DetailRecord key={row.id} items={[
                          ['Employer', row.employer_name],
                          ['Position', row.position],
                          ['Period', detailPeriod(row.start_date, row.end_date)],
                          ['Currently employed', row.is_current ? 'Yes' : 'No'],
                        ]} />
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">No employment history records.</p>
                  )}
                </TabsContent>
              </Tabs>
              <section className="border-t pt-4">
                <h3 className="text-xs font-semibold text-navy">Resumes</h3>
                {detail.resumes.length ? (
                  <ul className="mt-3 flex flex-col gap-3">
                    {detail.resumes.map((resume) => (
                      <li key={resume.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-navy">{resume.file_name}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">Uploaded {formatDetailDate(resume.uploaded_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {resume.is_active && <StatusBadge status="Active" />}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openResume(resume)}
                            disabled={viewingResumeId === resume.id}
                          >
                            {viewingResumeId === resume.id ? 'Opening…' : 'View'}
                            <span className="sr-only"> {resume.file_name} (opens in new tab)</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No resume on file.</p>
                )}
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UserManagement
