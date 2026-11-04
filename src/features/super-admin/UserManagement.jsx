import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { listUsers, updateUser, listRoles, assignRole, assignCustomRole, inviteUser } from '@/shared/services/admin'
import useAuth from '@/shared/hooks/useAuth'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { InlineError, Pager, StatCard } from '@/shared/components/dashboard'
import useDialog from '@/shared/hooks/useDialog'
import { titleCase } from '@/shared/utils/titleCase'
import { Notice, PageHeading, SelectField, StatusBadge } from '@/shared/components/design'

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
  const [savingId, setSavingId] = useState(null)
  const [filterRole, setFilterRole] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE)
  const [inviting, setInviting] = useState(false)

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
    listRoles()
      .then((roles) => setCustomRoles(roles || []))
      .catch(() => setCustomRoles([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return <InlineError message={error} />

  // Role assignment lives ONLY here (the Roles page manages definitions).
  // - sys:<role>   → cross-table system-role move (+ clears any custom tag)
  // - custom:<id>  → ensures the account sits in the role's base portal, then tags
  // - plain clear  → removes the custom tag only
  async function handleAssignRole(user, value) {
    if (value === `sys:${user.role}` && !user.custom_role_id) return
    setActionError('')
    setSuccess('')
    setSavingId(user.id)
    try {
      if (value.startsWith('custom:')) {
        const role = customRoles.find((r) => String(r.id) === value.slice(7))
        if (!role) throw new Error('Custom role not found — refresh the page')
        if (user.role !== role.base_role) await assignRole(user.id, role.base_role)
        await assignCustomRole(user.id, role.id)
        setSuccess(`Role "${role.name}" assigned to ${user.full_name || user.email}.`)
      } else if (value.startsWith('sys:')) {
        const role = value.slice(4)
        if (user.custom_role_id) await assignCustomRole(user.id, null)
        if (user.role !== role) await assignRole(user.id, role)
        setSuccess(`Role set to ${SYSTEM_ROLE_LABELS[role] || role} for ${user.full_name || user.email}.`)
      } else if (value === 'clear-custom') {
        await assignCustomRole(user.id, null)
        setSuccess(`Custom role cleared for ${user.full_name || user.email}.`)
      }
      await loadUsers(page)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setActionError(err.message || 'Failed to assign role')
    } finally {
      setSavingId(null)
    }
  }

  async function handleToggleStatus(user) {
    const newStatus = user.status === 'active' ? 'suspended' : 'active'
    await updateUser(user.id, { status: newStatus })
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)))
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

  const jobSeekerCount = users.filter((row) => row.role === 'job-seeker').length
  const employerCount = users.filter((row) => row.role === 'employer').length
  const adminCount = users.filter((row) => row.role === 'super-admin').length
  const activeCount = users.filter((row) => row.status === 'active').length
  const suspendedCount = users.filter((row) => row.status !== 'active').length

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
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

      <div className="shrink-0">
        <Notice title="Frontend authorization preview">
          Role checks are enforced by the shared API for this session, not by the browser. Production must validate JWT sessions, permissions, tenant scope, and audit writes server-side.
        </Notice>
      </div>

      <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total system users" value={total} />
        <StatCard label="Job seekers" value={jobSeekerCount} />
        <StatCard label="Employers" value={employerCount} />
        <StatCard label="PESO administrators" value={adminCount} />
        <StatCard label="Active accounts" value={activeCount} />
        <StatCard label="Suspended accounts" value={suspendedCount} />
      </div>

      {success && <p className="shrink-0 rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">{success}</p>}
      {actionError && <InlineError message={actionError} />}

      <section className="surface flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {/* Filter bar */}
        <div className="flex shrink-0 flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end">
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
        <div className="min-h-0 flex-1 overflow-auto">
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
                      {currentUser && user.id === currentUser.id ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-navy">{SYSTEM_ROLE_LABELS[user.role] || user.role}</span>
                          {user.custom_role_id && (
                            <span className="text-[10px] text-primary">
                              {customRoles.find((r) => String(r.id) === String(user.custom_role_id))?.name || 'Custom role'}
                            </span>
                          )}
                          <span className="text-[9px] uppercase tracking-[.14em] text-muted-foreground">You — role locked</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`role-${user.id}`} className="sr-only">Role for {user.full_name || user.email}</Label>
                          <select
                            id={`role-${user.id}`}
                            value={user.custom_role_id ? `custom:${user.custom_role_id}` : `sys:${user.role}`}
                            disabled={savingId === user.id}
                            onChange={(e) => handleAssignRole(user, e.target.value)}
                            className="form-select h-9 max-w-[170px] px-2 text-[11px]"
                          >
                            <optgroup label="System roles">
                              {Object.entries(SYSTEM_ROLE_LABELS).map(([key, label]) => (
                                <option key={key} value={`sys:${key}`}>{label}</option>
                              ))}
                            </optgroup>
                            {customRoles.length > 0 && (
                              <optgroup label="Custom roles">
                                {customRoles.map((r) => (
                                  <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {user.custom_role_id && (
                              <option value="clear-custom">Clear custom role…</option>
                            )}
                          </select>
                          {savingId === user.id && <span className="text-[10px] text-muted-foreground">Saving…</span>}
                        </div>
                      )}
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
                        size="sm"
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="shrink-0 px-5"><Pager page={page} pageSize={pageSize} total={total} onChange={setPage} /></div>
      </section>

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
    </div>
  )
}

export default UserManagement
