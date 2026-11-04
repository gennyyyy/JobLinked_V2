import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { listUsers, updateUser, listRoles, assignRole, assignCustomRole, inviteUser, listAuditLogs } from '@/shared/services/admin'
import useAuth from '@/shared/hooks/useAuth'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError, Pager, StatCard } from '@/shared/components/dashboard'
import useDialog from '@/shared/hooks/useDialog'
import { titleCase } from '@/shared/utils/titleCase'
import { EmptyState, Notice, PageHeading, Panel, SelectField, StatusBadge } from '@/shared/components/design'

const SYSTEM_ROLE_LABELS = { 'super-admin': 'Super Admin', employer: 'Employer', 'job-seeker': 'Job Seeker' }

const EMPTY_INVITE = {
  email: '', role: '', first_name: '', middle_name: '', last_name: '',
  suffix: '', phone: '', company_name: '',
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

  const inviteRef = useDialog(() => setShowInvite(false), showInvite)

  // Users arrive as the { data, total, page, pageSize } envelope (C2). Role and
  // search are filtered server-side (GET /admin/users accepts role/search/status)
  // so a query isn't trapped inside the current 25-row page.
  const loadReqRef = useRef(0)
  const loadUsers = useCallback((p) => {
    const params = { page: p }
    if (filterRole !== 'all') params.role = filterRole
    if (debouncedSearch) params.search = debouncedSearch
    const req = ++loadReqRef.current
    return listUsers(params).then((res) => {
      if (req !== loadReqRef.current) return // drop a superseded fetch
      setUsers(res.data)
      setTotal(res.total)
      setPageSize(res.pageSize)
    })
  }, [filterRole, debouncedSearch])

  useEffect(() => { loadUsers(page).catch((err) => setError(err.message || 'Failed to load users')) }, [loadUsers, page])

  // Debounce the search box (mirrors Jobs/JobPosts) so each keystroke doesn't refetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    Promise.all([
      listRoles().catch(() => []),
      listAuditLogs({ action: 'user.role.change', limit: 50 }).catch(() => []),
    ])
      .then(([roles, logs]) => {
        setCustomRoles(roles || [])
        setHistory(Array.isArray(logs) ? logs : [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSkeleton stats={0} table />
  if (error) return <InlineError message={error} />

  function openAccess(user) {
    setAccessTarget(user)
    setAccessRole(user.custom_role_id ? `custom:${user.custom_role_id}` : `sys:${user.role}`)
    setAccessStatus(user.status === 'active' ? 'active' : 'suspended')
    setAccessReason('')
    setAccessError('')
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
    { value: 'all', label: 'All Roles' },
    { value: 'super-admin', label: 'Super Admin' },
    { value: 'employer', label: 'Employer' },
    { value: 'job-seeker', label: 'Job Seeker' },
  ]
  const accessRoleOptions = [
    ...Object.entries(SYSTEM_ROLE_LABELS).map(([value, label]) => ({ value: `sys:${value}`, label })),
    ...customRoles.map((role) => ({ value: `custom:${role.id}`, label: role.name })),
  ]

  const jobSeekerCount = users.filter((row) => row.role === 'job-seeker').length
  const employerCount = users.filter((row) => row.role === 'employer').length
  const adminCount = users.filter((row) => row.role === 'super-admin').length
  const activeCount = users.filter((row) => row.status === 'active').length
  const suspendedCount = users.filter((row) => row.status !== 'active').length

  return (
    <div className="space-y-6 pb-12">
      <div>
        <PageHeading
          eyebrow="Accountable access. Clear responsibilities."
          title="User Management"
          description="Find registered users, assign their system roles, and manage account access."
          action={(
            <Button type="button" onClick={() => { setActionError(''); setShowInvite(true) }}>
              Add user
            </Button>
          )}
        />
      </div>

      <div>
        <Notice title="Frontend authorization preview">
          Role checks are enforced by the shared API for this session, not by the browser. Production must validate JWT sessions, permissions, tenant scope, and audit writes server-side.
        </Notice>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total system users" value={total} />
        <StatCard label="Job seekers" value={jobSeekerCount} />
        <StatCard label="Employers" value={employerCount} />
        <StatCard label="PESO administrators" value={adminCount} />
        <StatCard label="Active accounts" value={activeCount} />
        <StatCard label="Suspended accounts" value={suspendedCount} />
      </div>

      {success && <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">{success}</p>}
      {actionError && <InlineError message={actionError} />}

      <section className="surface p-0">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="sm:w-48">
            <SelectField
              id="role-filter"
              label="Filter by role"
              options={roleOptions}
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex-1 sm:min-w-[200px]">
            <Label htmlFor="user-search" className="mb-2 text-xs text-muted-foreground">Search</Label>
            <Input
              id="user-search"
              type="text"
              aria-label="Search users by name or email"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
              placeholder="Search by name or email…"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">{total} records</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {users.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No users found.</p>
          ) : (
            <Table className="table-fixed">
              <colgroup>
                <col style={{ width: '170px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '120px' }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last Updated</TableHead>
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openAccess(user)}
                        disabled={currentUser && user.id === currentUser.id}
                      >
                        Manage access
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="px-5"><Pager page={page} pageSize={pageSize} total={total} onChange={setPage} /></div>
      </section>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" onClick={() => setShowInvite(false)}>
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
            <SelectField
              id="access-role"
              label="Assigned role"
              options={accessRoleOptions}
              value={accessRole}
              onChange={(event) => setAccessRole(event.target.value)}
            />
            <SelectField
              id="access-status"
              label="Account status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
              ]}
              value={accessStatus}
              onChange={(event) => setAccessStatus(event.target.value)}
            />
            <div>
              <Label htmlFor="access-reason" className="mb-2 block text-xs text-muted-foreground">Reason</Label>
              <Textarea
                id="access-reason"
                rows={3}
                value={accessReason}
                onChange={(event) => { setAccessReason(event.target.value); setAccessError('') }}
                placeholder="Explain why this access change is needed."
              />
            </div>
            {accessError && <p role="alert" className="text-xs text-destructive">{accessError}</p>}
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setAccessTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={accessBusy}>{accessBusy ? 'Saving…' : 'Save access'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UserManagement
