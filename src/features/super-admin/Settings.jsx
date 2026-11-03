import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { listReferenceData, addReferenceData, removeReferenceData } from '@/shared/services/admin'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import LoadingScreen from '@/shared/components/LoadingScreen'
import { InlineError, SectionCard } from '@/shared/components/dashboard'
import { PageHeading } from '@/shared/components/design'

const categoryLabels = { employment_type: 'Employment Types', education_level: 'Education Levels' }

function Settings() {
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newValues, setNewValues] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  useEffect(() => {
    Promise.all(Object.keys(categoryLabels).map((category) => listReferenceData(category)))
      .then(([employment, education]) => setCategories({ employment_type: employment, education_level: education }))
      .catch((err) => setError(err.message || 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return <InlineError message={error} />

  async function handleAddCategory(category) {
    const value = (newValues[category] || '').trim()
    if (!value) return
    await addReferenceData(category, value)
    const updated = await listReferenceData(category)
    setCategories((prev) => ({ ...prev, [category]: updated }))
    setNewValues((prev) => ({ ...prev, [category]: '' }))
  }

  async function handleRemoveCategory(category, id) {
    await removeReferenceData(id)
    const updated = await listReferenceData(category)
    setCategories((prev) => ({ ...prev, [category]: updated }))
    setConfirmDelete(null)
  }

  return (
    <>
      <PageHeading
        eyebrow="System settings"
        title="System Settings"
        description="Manage platform reference data: employment types and education levels."
      />
      <div className="flex flex-col gap-6">
        {Object.entries(categoryLabels).map(([category, label]) => (
          <SectionCard
            key={category}
            title={label}
            subtitle="Reference values available across the workspace."
          >
            <ul className="flex flex-col divide-y">
              {(categories[category] || []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <span className="text-xs font-medium text-navy">{item.value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete({ category, id: item.id, value: item.value })}
                    className="text-destructive"
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(event) => { event.preventDefault(); handleAddCategory(category) }}
              className="mt-5 flex flex-col gap-3 sm:flex-row"
            >
              <Input
                type="text"
                value={newValues[category] || ''}
                onChange={(e) => setNewValues((prev) => ({ ...prev, [category]: e.target.value }))}
                placeholder={`Add ${label.toLowerCase().replace(/s$/, '')}...`}
                aria-label={`Add ${label.toLowerCase().replace(/s$/, '')}`}
                className="flex-1"
              />
              <Button type="submit">
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </form>
          </SectionCard>
        ))}
      </div>
      {confirmDelete && (
        <ConfirmationModal
          message={`Remove "${confirmDelete.value}"?`}
          onConfirm={() => handleRemoveCategory(confirmDelete.category, confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
          confirmLabel="Remove"
          danger
        />
      )}
    </>
  )
}

export default Settings
