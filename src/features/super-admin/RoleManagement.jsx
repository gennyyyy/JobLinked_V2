import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Pencil, Trash2, Lock, X } from 'lucide-react'
import { listRoles, createRole, updateRole, deleteRole, listPermissions } from '@/shared/services/admin'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { H3, Panel, PageHeading, StatusBadge } from '@/shared/components/design'

// The 3 system roles are fixed by the DB enum + auth — read-only here.
// Custom roles (permission bundles) are added/edited below and assigned from
// the Users page only. Nothing on this page touches user assignment.
const SYSTEM_ROLES = [
  {
    key: 'super-admin',
    label: 'PESO Admin',
    description: 'Full system access: manage employers, accreditations, jobs, users, and settings.',
    capabilities: ['Users', 'Roles', 'Reports', 'Logs', 'Settings'],
  },
  {
    key: 'employer',
    label: 'Employer',
    description: 'Post jobs, manage applicants, submit accreditation documents.',
    capabilities: ['Job posts', 'Applicants & employees', 'Company profile', 'Accreditation'],
  },
  {
    key: 'job-seeker',
    label: 'Job Seeker',
    description: 'Browse jobs, manage profile, submit applications.',
    capabilities: ['Browse jobs', 'Applications', 'Profile & resume', 'Employment history'],
  },
]

const BASE_ROLE_OPTIONS = SYSTEM_ROLES.map((r) => ({ key: r.key, label: r.label }))

// Mirrors the reference design's permission matrix for the three fixed roles.
const MATRIX_PERMISSIONS = [
  { key: 'browse', label: 'Browse Jobs' },
  { key: 'apply', label: 'Submit Applications' },
  { key: 'jobs', label: 'Manage Job Postings' },
  { key: 'employees', label: 'Track Employees' },
  { key: 'accreditation', label: 'Review Accreditation' },
  { key: 'reports', label: 'Generate Reports' },
  { key: 'roles', label: 'Manage User Roles' },
]
const MATRIX_ROLES = ['super-admin', 'job-seeker', 'employer']
const MATRIX_LABELS = { 'super-admin': 'PESO Admin', 'job-seeker': 'Job Seeker', employer: 'Employer' }
const PERMISSION_MATRIX = {
  'super-admin': { browse: 'all', apply: 'none', jobs: 'all', employees: 'all', accreditation: 'all', reports: 'all', roles: 'all' },
  'job-seeker': { browse: 'all', apply: 'own', jobs: 'none', employees: 'own', accreditation: 'none', reports: 'none', roles: 'none' },
  employer: { browse: 'all', apply: 'none', jobs: 'company', employees: 'company', accreditation: 'none', reports: 'company', roles: 'none' },
}

const emptyForm = { name: '', description: '', base_role: 'super-admin', permissions: [] }

function RoleManagement() {
  const [customRoles, setCustomRoles] = useState([])
  const [permissionCatalog, setPermissionCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  // Create / edit modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [confirmRole, setConfirmRole] = useState(null)

  // Permission catalog is server-owned (GET /admin/permissions) — one fetch with
  // the roles so the single loading gate covers both, no second loader.
  const load = useCallback(async () => {
    try {
      const [roles, permissions] = await Promise.all([listRoles(), listPermissions()])
      setCustomRoles(roles)
      setPermissionCatalog(permissions)
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  function showFlash(text) {
    setFlash(text)
    setTimeout(() => setFlash(''), 4000)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(role) {
    setEditingId(role.id)
    setForm({
      name: role.name,
      description: role.description || '',
      base_role: role.base_role || 'super-admin',
      permissions: [...(role.permissions || [])],
    })
    setFormError('')
    setFormOpen(true)
  }

  function togglePermission(key) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Role name is required.'); return }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        base_role: form.base_role,
        permissions: form.permissions,
      }
      if (editingId) {
        await updateRole(editingId, payload)
        showFlash(`Role "${payload.name}" updated.`)
      } else {
        await createRole(payload)
        showFlash(`Role "${payload.name}" created.`)
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      setFormError(err.message || 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const role = confirmRole
    setConfirmRole(null)
    try {
      await deleteRole(role.id)
      showFlash(`Role "${role.name}" deleted. Users holding it were untagged.`)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to delete role')
    }
  }

  if (loading) return <PageSkeleton stats={0} table />

  return (
    <div className="space-y-6 pb-12">
      <PageHeading
        eyebrow="Clear responsibilities"
        title="Role Management"
        description="Manage role definitions here. Assign roles to individual accounts in User Management."
        action={(
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            New Role
          </Button>
        )}
      />

      {flash && <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-xs text-success">{flash}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <Panel
        title="Predefined roles"
        description="The three system roles define each account’s workspace and access."
        action={<span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-[10px] uppercase tracking-[.14em] text-muted-foreground"><Lock className="size-3" aria-hidden="true" />Read-only</span>}
      >
          <ul className="grid gap-4 md:grid-cols-3">
            {SYSTEM_ROLES.map((role) => (
              <li key={role.key} className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <span className="soft-icon size-9"><Shield className="size-4" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-navy">{role.label}</h2>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground">{role.key}</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{role.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {role.capabilities.map((cap) => (
                    <span key={cap} className="rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">{cap}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission</TableHead>
                  {MATRIX_ROLES.map((role) => <TableHead key={role}>{MATRIX_LABELS[role]}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MATRIX_PERMISSIONS.map((permission) => (
                  <TableRow key={permission.key}>
                    <TableCell className="text-xs">{permission.label}</TableCell>
                    {MATRIX_ROLES.map((role) => (
                      <TableCell key={role} className="text-xs text-muted-foreground">{PERMISSION_MATRIX[role][permission.key]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>

        <Panel
          title="Custom roles"
          description="Additional role definitions, separate from the three predefined roles."
        >
          {customRoles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="soft-icon"><Shield className="size-5" aria-hidden="true" /></span>
              <p className="text-sm font-semibold text-navy">No custom roles yet</p>
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                Create a Custom Role with the permissions you choose, then assign it to users from the Users page.
              </p>
              <Button type="button" variant="outline" onClick={openCreate}>Create your first role</Button>
            </div>
          ) : (
            <ul className="grid content-start gap-4 md:grid-cols-2">
              {customRoles.map((role) => (
                <li key={role.id} className="flex flex-col rounded-xl border p-5">
                  <div className="flex items-start gap-3">
                    <span className="soft-icon size-9"><Shield className="size-4" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <H3 className="truncate text-sm font-semibold text-navy">{role.name}</H3>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                        base · {BASE_ROLE_OPTIONS.find((b) => b.key === role.base_role)?.label || role.base_role}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-[11px] leading-5 text-muted-foreground">
                    {role.description || 'No description provided.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(role.permissions || []).length === 0 ? (
                      <span className="text-[10px] italic text-muted-foreground">No permissions selected</span>
                    ) : (
                      role.permissions.map((p) => (
                        <StatusBadge key={p} status={permissionCatalog.find((x) => x.key === p)?.label || p} />
                      ))
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(role)}>
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRole(role)} className="text-destructive">
                      <Trash2 data-icon="inline-start" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      {/* Create / Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-xl">
            <form onSubmit={handleSave} className="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{editingId ? 'Edit role' : 'New role'}</p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-navy">
                    {editingId ? form.name || 'Untitled role' : 'Create a custom role'}
                  </h2>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setFormOpen(false)} aria-label="Close">
                  <X aria-hidden="true" />
                </Button>
              </div>

              {formError && <p role="alert" className="rounded-xl border border-destructive/20 bg-danger-soft px-4 py-3 text-xs text-destructive">{formError}</p>}

              <div>
                <Label htmlFor="role-name" className="mb-2 flex-col items-start gap-1 text-xs text-muted-foreground">
                  Role Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. HR Officer, PESO Staff"
                />
              </div>

              <div>
                <Label htmlFor="role-desc" className="mb-2 flex-col items-start gap-1 text-xs text-muted-foreground">
                  Description <span className="font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="role-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this role for?"
                />
              </div>

              <div>
                <Label htmlFor="role-base" className="mb-2 flex-col items-start gap-1 text-xs text-muted-foreground">
                  Base Portal <span className="text-destructive">*</span>
                </Label>
                <select
                  id="role-base"
                  value={form.base_role}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_role: e.target.value }))}
                  className="form-select"
                >
                  {BASE_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label} portal</option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-muted-foreground">Which portal holders of this role use to sign in.</p>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs text-muted-foreground">
                  Permissions <span className="font-normal">({form.permissions.length} selected)</span>
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissionCatalog.map((perm) => {
                    const checked = form.permissions.includes(perm.key)
                    return (
                      <label
                        key={perm.key}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[11px] ${checked ? 'border-primary/30 bg-blue-soft font-medium text-primary' : 'text-muted-foreground hover:bg-muted/60'}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => togglePermission(perm.key)} className="size-3.5 accent-primary" />
                        {perm.label}
                      </label>
                    )
                  })}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Permissions gate the super-admin API as well as its pages (ADR-042): an account holding this role may only call what the bundle allows. An empty bundle reaches nothing; an account with no custom role keeps full access.</p>
              </fieldset>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Role'}</Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmRole && (
        <ConfirmationModal
          message={`Delete role "${confirmRole.name}"? Users assigned to it will be untagged.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmRole(null)}
          confirmLabel="Delete"
          danger
        />
      )}
    </div>
  )
}

export default RoleManagement
