import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

// 1:1 port of the reference preference-matching panel and its dialog.
export default function PreferenceMatching({ prompt, onSubmit }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  return (
    <section className="mb-6 flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Job matching mode">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{prompt ? 'Preference matching' : 'Standard matching · no AI'}</p>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Describe your ideal job</DialogTitle>
            <DialogDescription>
              Opening this chat does not change your matches. Send your preferences to start the matching experience. No actual AI service is connected.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-muted p-4 text-sm">
            Tell me about your preferred role, skills, location, or work arrangement. For example: “Entry level customer service, remote.”
          </p>
          {prompt && (
            <p role="status" className="text-sm text-muted-foreground">
              Assistant: Your request is applied to the jobs on this page using keyword overlap. You can refine it below or return to standard matching.
            </p>
          )}
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onSubmit(draft.trim()) }}
          >
            <Field>
              <FieldLabel htmlFor="job-preference-prompt">Your job preferences</FieldLabel>
              <Textarea id="job-preference-prompt" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What kind of job are you looking for?" maxLength={1000} rows={4} required />
            </Field>
            <Button type="submit" disabled={!draft.trim()}>
              <Send data-icon="inline-start" />
              Send preferences
            </Button>
            {prompt && <Button type="button" variant="outline" onClick={() => setOpen(false)}>View matching jobs</Button>}
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
