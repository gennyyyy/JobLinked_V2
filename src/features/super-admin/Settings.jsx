import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AccountSettings from '@/shared/components/AccountSettings'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import { PanelSkeleton } from '@/shared/components/Skeletons'
import { EmptyState, Panel, TextField } from '@/shared/components/design'
import { addReferenceData, listReferenceData, removeReferenceData } from '@/shared/services/admin'

// Only the two categories this page owns. `custom_role` rows belong to the
// Roles page; skills, barangays, and application statuses are code constants,
// not reference rows, so they are not listed here.
const CATEGORIES = [
  {
    category: 'employment_type',
    title: 'Employment types',
    description: 'Values offered when recording an employment type.',
    label: 'employment type',
  },
  {
    category: 'education_level',
    title: 'Education levels',
    description: 'Values offered when recording an education level.',
    label: 'education level',
  },
]

function ReferenceCategory({ category, title, description, label }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [value, setValue] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRow, setConfirmRow] = useState(null)
  const inputId = `${category}-value`

  useEffect(() => {
    let cancelled = false
    listReferenceData(category)
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []) })
      .catch((err) => { if (!cancelled) setError(err.message || `Failed to load ${title.toLowerCase()}`) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [category, title])

  async function handleAdd(event) {
    event.preventDefault()
    const next = value.trim()
    if (!next) { setFormError(`Enter a value for ${label}.`); return }
    setSaving(true)
    setFormError('')
    try {
      const created = await addReferenceData(category, next)
      setValue('')
      // The server orders by sort_order; a new row defaults to 0, so insert it
      // where a reload would show it instead of leaving the list out of order.
      setRows((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    } catch (err) {
      // A 409 duplicate arrives with the server's message ("Reference value
      // already exists"); show it verbatim next to the input.
      setFormError(err.message || `Failed to add the ${label}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    const row = confirmRow
    setConfirmRow(null)
    if (!row) return
    try {
      await removeReferenceData(row.id)
      setRows((prev) => prev.filter((item) => item.id !== row.id))
    } catch (err) {
      setError(err.message || `Failed to remove the ${label}`)
    }
  }

  if (loading) return <PanelSkeleton lines={2} label={`Loading ${title.toLowerCase()}…`} />

  return (
    <Panel title={title} description={description} className="h-[26rem]" contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {error && <p role="alert" className="mb-4 text-xs text-destructive">{error}</p>}
        {rows.length === 0 ? (
          !error && <EmptyState title={`No ${title.toLowerCase()} yet`} description={`Add the first ${label} below.`} className="min-h-0 py-8" />
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 break-words text-xs">{row.value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive"
                  aria-label={`Remove ${row.value}`}
                  onClick={() => setConfirmRow(row)}
                >
                  <Trash2 data-icon="inline-start" aria-hidden="true" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex shrink-0 flex-col gap-4 border-t pt-4">
        <TextField
          id={inputId}
          label={`New ${label}`}
          value={value}
          onChange={(event) => { setValue(event.target.value); if (formError) setFormError('') }}
          error={formError}
          placeholder={`e.g. ${rows[0]?.value || label}`}
        />
        <div>
          <Button type="submit" disabled={saving}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            {saving ? 'Adding…' : `Add ${label}`}
          </Button>
        </div>
      </form>

      {confirmRow && (
        <ConfirmationModal
          title="Remove value"
          message={`Remove "${confirmRow.value}" from ${title.toLowerCase()}?`}
          onConfirm={handleRemove}
          onCancel={() => setConfirmRow(null)}
          confirmLabel="Remove"
          danger
        />
      )}
    </Panel>
  )
}

export default function Settings() {
  return (
    <AccountSettings childrenBelow uniform>
      <div className="grid items-start gap-6 md:grid-cols-2">
        {CATEGORIES.map((item) => <ReferenceCategory key={item.category} {...item} />)}
      </div>
    </AccountSettings>
  )
}
