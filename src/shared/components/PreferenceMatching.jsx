import { useState } from 'react'
import { MessageCircle, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// 1:1 port of the reference preference-matching panel and its dialog. `compact`
// drops the full-width banner and renders just the trigger + state line, so the
// sidebar can host the AI affordance under the search field.
export default function PreferenceMatching({ prompt, onSubmit, compact = false, mode = null, busy = false }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  // `mode` is the server's last ranking verdict: null until a request settles,
  // then 'ai' when the model ranked or 'deterministic' on the fallback path.
  const modeLabel = mode === 'ai' ? 'AI ranking active' : 'Standard matching · no AI'

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
          Your request is processed by an AI provider to rank vacancies. Never include personal details; your name and resume are never sent.
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
    // Deliberately quiet: one small icon button inline with the search field.
    // A native <button> on purpose — the shared Button ships data-slot="button",
    // which a global stylesheet rule pins to a 44px minimum, and this control is
    // meant to stay barely-there. Active matching only tints it; the dialog
    // carries "Use standard matching" to get back.
    return (
      <>
        <button
          type="button"
          aria-label="AI job matching"
          aria-pressed={Boolean(prompt)}
          title={prompt ? 'Preference matching is on' : 'AI job matching'}
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors lg:size-7',
            prompt ? 'bg-blue-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-primary',
          )}
        >
          <Sparkles className="size-4 lg:size-[15px]" />
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
          AI job matching
        </Button>
      </div>
      {dialog}
    </section>
  )
}
