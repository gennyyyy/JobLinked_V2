'use client'

import { useId, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { BARANGAYS } from '@/constants'
import { parseResumeText, readResume, type ResumeDetails } from '@/lib/resume-autofill'
import type { FileMetadata } from '@/types'

const labels: Record<keyof ResumeDetails, string> = {
  name: 'Full name', email: 'Email address', phone: 'Contact number', headline: 'Professional headline',
  address: 'Street address', barangay: 'Barangay', education: 'Education or training', experience: 'Work experience', skills: 'Skills',
}

export function ResumeAutofill({ onApply, fields, onResume }: {
  onApply: (details: ResumeDetails) => void
  fields: (keyof ResumeDetails)[]
  onResume?: (file: FileMetadata) => void
}) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState<ResumeDetails | null>(null)
  const [metadata, setMetadata] = useState<FileMetadata | null>(null)

  async function select(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    setStatus('Reading resume on your device…')
    setPreview(null)
    setMetadata(null)
    try {
      const details = parseResumeText(await readResume(file), BARANGAYS)
      const selected = Object.fromEntries(Object.entries(details).filter(([key]) => fields.includes(key as keyof ResumeDetails))) as ResumeDetails
      if (!Object.keys(selected).length) throw new Error('No supported details detected. Use clear headings such as Education, Experience, and Skills, or fill in the form manually.')
      setPreview(selected)
      setMetadata({ id: `file-${crypto.randomUUID()}`, name: file.name, size: file.size, type: file.type, addedAt: new Date().toISOString() })
      setStatus(`${Object.keys(selected).length} fields detected. Review below before applying.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this resume. Try another file or enter your details manually.')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return <section aria-label="Resume autofill" className="flex flex-col gap-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
    <div className="flex items-center gap-2"><FileText className="size-5 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">Autofill from your resume</h3></div>
    <Field data-invalid={!!error} data-disabled={busy}>
      <FieldLabel htmlFor={id}>Choose a resume to autofill</FieldLabel>
      <Input id={id} type="file" multiple={false} accept=".pdf,.docx,.txt" disabled={busy} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => { void select(event.target.files?.[0]); event.target.value = '' }} />
      <FieldDescription id={`${id}-help`}>One resume only · PDF, DOCX, or TXT · Up to 5 MB. Selecting another file replaces this selection. Read locally on your device, never uploaded. Use fictional details in this demo. Text-based resumes work best; scanned images are not supported.</FieldDescription>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
    <p role="status" className="text-xs text-muted-foreground">{busy && <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />}{status}</p>
    {preview && <>
      <p className="break-all text-xs font-medium">{metadata?.name}</p>
      <dl className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4">
        {Object.entries(preview).map(([key, value]) => <div key={key}><dt className="text-xs font-medium">{labels[key as keyof ResumeDetails]}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">Applying replaces only the fields shown above. Other details stay unchanged. Review and edit the form before saving.</p>
      <Button type="button" onClick={() => { onApply(preview); if (metadata) onResume?.(metadata); setPreview(null); setStatus('Resume details applied. Review the form before continuing or saving.') }}>Apply detected details</Button>
    </>}
  </section>
}
