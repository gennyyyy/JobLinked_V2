import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DIALOG_AI_NOTICE, MATCHING_NAME, matchModeLabel } from '@/shared/content/matching'

// 1:1 port of the reference preference-matching panel and its dialog. `compact`
// drops the full-width banner and renders just the trigger + state line, so the
// sidebar can host the matching affordance under the search field.
export default function PreferenceMatching({ prompt, onSubmit, compact = false, mode = null, busy = false }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const modeLabel = matchModeLabel(mode)

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Describe your ideal job</DialogTitle>
          <DialogDescription>
            Send your preferences to start the matching experience.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs leading-5 text-muted-foreground">
          {DIALOG_AI_NOTICE}
        </p>
        {/* The compact trigger has no header line, so the dialog carries the mode. */}
        {compact && (
          <p role="status" className="text-xs font-medium text-muted-foreground">{modeLabel}</p>
        )}
        <p className="rounded-lg bg-muted p-4 text-sm">
          Tell me about your preferred role, skills, location, or work arrangement. For example: “Entry level customer service, remote.”
        </p>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => { event.preventDefault(); if (!busy && draft.trim()) onSubmit(draft.trim()) }}
        >
          <Field>
            <FieldLabel htmlFor="job-preference-prompt">Your job preferences</FieldLabel>
            <Textarea id="job-preference-prompt" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What kind of job are you looking for?" maxLength={500} rows={4} required />
          </Field>
          <Button type="submit" disabled={!draft.trim() || busy}>
            <Send data-icon="inline-start" />
            Send preferences
          </Button>
          {prompt && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>View matching jobs</Button>
              <Button type="button" variant="ghost" onClick={() => { onSubmit(''); setDraft('') }}>Use standard matching</Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )

  if (compact) {
    // Deliberately quiet: one small text button inline with the search field.
    // A native <button> on purpose — the shared Button ships data-slot="button",
    // which a global stylesheet rule pins to a 44px minimum, and this control is
    // meant to stay barely-there. Active matching only tints it; the dialog
    // carries "Use standard matching" to get back.
    return (
      <>
        <button
          type="button"
          aria-label={MATCHING_NAME}
          aria-pressed={Boolean(prompt)}
          title={prompt ? 'Preference matching is on' : MATCHING_NAME}
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex h-full aspect-square shrink-0 items-center justify-center rounded-lg border border-border transition-colors',
            prompt ? 'bg-blue-soft text-primary border-primary' : 'text-muted-foreground hover:bg-muted hover:text-primary',
          )}
        >
          <span aria-hidden="true" className="text-[10px] font-semibold leading-none tracking-wide">AI</span>
        </button>
        {dialog}
      </>
    )
  }

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Job matching mode">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{modeLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {prompt ? `Your request: ${prompt}` : 'Normal search and ranking are active. The assistant is optional.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {prompt && (
          <Button variant="ghost" onClick={() => { onSubmit(''); setDraft('') }}>Use standard matching</Button>
        )}
        <Button variant="outline" onClick={() => setOpen(true)}>
          <MessageCircle data-icon="inline-start" />
          {MATCHING_NAME}
        </Button>
      </div>
      {dialog}
    </section>
  )
}
