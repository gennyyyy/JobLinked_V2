import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'

// Tag-list field from the reference profile (education, experience, skills).
// `value` is a comma-separated string (Work experience) or an array (skills);
// onChange emits the same shape. `suggestions` feeds a native <datalist>;
// `max` caps the chip count.
export default function TagField({ label, value, onChange, placeholder, help, error, required, suggestions, max }) {
  const listId = useId()
  const arrayMode = Array.isArray(value)
  const tags = (arrayMode ? value : String(value ?? '').split(','))
    .map((tag) => String(tag).trim())
    .filter(Boolean)
  const [draft, setDraft] = useState('')
  const limit = Number.isFinite(max) ? max : null

  const emit = (next) => onChange(arrayMode ? next : next.join(', '))

  const addTag = () => {
    const tag = draft.trim()
    const atLimit = limit != null && tags.length >= limit
    if (!tag || atLimit || tags.some((entry) => entry.toLowerCase() === tag.toLowerCase())) { setDraft(''); return }
    emit([...tags, tag])
    setDraft('')
  }

  const removeTag = (tagToRemove) => emit(tags.filter((tag) => tag !== tagToRemove))
  const helpText = [help, limit != null ? `Up to ${limit}.` : ''].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-sm font-medium leading-none text-foreground">
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-border bg-muted px-4 py-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
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
          list={suggestions ? listId : undefined}
          placeholder={tags.length ? 'Add another…' : placeholder}
          aria-label={label}
          aria-invalid={!!error}
          className="min-w-[180px] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="button" onClick={addTag} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Add ${label}`}>
          <Plus className="size-4" />
        </button>
      </div>
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      ) : null}
      {helpText ? <p className="mt-2 text-xs text-muted-foreground">{helpText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
