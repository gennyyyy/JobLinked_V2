import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Tag-list field from the reference profile (education, experience, skills).
// `value` is a comma-separated string (Work experience) or an array (skills);
// onChange emits the same shape. `suggestions` feeds a native <datalist>;
// `max` caps the chip count. `tile` opts into a 2:1 box whose chips scroll
// above a bottom-pinned input; other callers keep the horizontal strip.
export default function TagField({ label, value, onChange, placeholder, help, error, required, suggestions, max, labelClassName, tile = false }) {
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
  const chips = tags.map((tag) => (
    <span
      key={tag}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0 text-xs font-medium',
        tile ? 'border border-border bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
      )}
    >
      {tag}
      <button
        type="button"
        onClick={() => removeTag(tag)}
        className={cn('flex size-6 shrink-0 items-center justify-center rounded-full p-0', tile ? 'hover:bg-secondary' : 'hover:bg-primary/15')}
        aria-label={`Remove ${tag}`}
      >
        <X className="size-3.5" />
      </button>
    </span>
  ))
  const input = (
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
  )
  const addButton = (
    <button type="button" onClick={addTag} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Add ${label}`}>
      <Plus className="size-4" />
    </button>
  )

  return (
    <div className="flex flex-col">
      <label className={cn('text-sm font-medium leading-none text-foreground', tile ? 'mb-1' : 'mb-2', labelClassName)}>
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {tile && helpText ? <p className="mb-2 text-xs text-muted-foreground">{helpText}</p> : null}
      {tile ? (
        <div className="flex aspect-[2/1] flex-col rounded-control border border-input bg-background p-3">
          <div className="flex min-h-0 flex-1 flex-wrap content-start items-start gap-2 overflow-y-auto">
            {chips}
          </div>
          <div className="mt-2 flex shrink-0 items-center gap-2 border-t border-border pt-2">
            {input}
            {addButton}
          </div>
        </div>
      ) : (
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-control border border-input bg-background px-3 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          {chips}
          {input}
          {addButton}
        </div>
      )}
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
        </datalist>
      ) : null}
      {!tile && helpText ? <p className="mt-2 text-xs text-muted-foreground">{helpText}</p> : null}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
