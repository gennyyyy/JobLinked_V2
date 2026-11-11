import { useState } from 'react'
import { Plus, X } from 'lucide-react'

// Tag-list field from the reference profile (education, experience, skills).
export default function TagField({ label, value, onChange, placeholder, help, error, required }) {
  const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean)
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const tag = draft.trim()
    if (!tag || tags.includes(tag)) { setDraft(''); return }
    onChange([...tags, tag].join(', '))
    setDraft('')
  }

  const removeTag = (tagToRemove) => onChange(tags.filter((tag) => tag !== tagToRemove).join(', '))

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-0.5 hover:bg-primary/15" aria-label={`Remove ${tag}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag()
            }
          }}
          placeholder={tags.length ? 'Add another…' : placeholder}
          aria-label={label}
          aria-invalid={!!error}
          className="min-w-[180px] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="button" onClick={addTag} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Add ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
