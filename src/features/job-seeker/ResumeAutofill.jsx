import { useId, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field'
import { buildFullName } from '@/shared/utils/names'
import { mapResumeText } from '@/shared/utils/resumeAutofill'

const LABELS = {
  name: 'Full name',
  phone: 'Contact number',
  headline: 'Professional headline',
  address: 'Street address',
  barangay: 'Barangay',
  education: 'Education or training',
  experience: 'Work experience',
  skills: 'Skills',
}

// 1:1 port of the reference resume-autofill panel. The file is parsed locally
// (PDF/DOCX) and only the previewed fields are written into the form.
export default function ResumeAutofill({ onApply }) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')

  async function select(file) {
    if (!file) return
    setBusy(true)
    setError('')
    setStatus('Reading resume on your device…')
    setPreview(null)
    try {
      const { extractResumeText } = await import('@/shared/lib/resumeText')
      const mapped = mapResumeText(await extractResumeText(file))
      const education = [mapped.education?.level, mapped.education?.school].filter(Boolean).join(' — ')
      const details = {
        name: buildFullName(mapped.firstName, mapped.middleName, mapped.lastName, mapped.suffix),
        phone: mapped.mobileNumber,
        barangay: mapped.barangayDistrict,
        address: mapped.streetAddress,
        education,
        skills: (mapped.skills || []).join(', '),
      }
      const detected = Object.fromEntries(Object.entries(details).filter(([, value]) => String(value || '').trim()))
      if (!Object.keys(detected).length) {
        throw new Error('No supported details detected. Use clear headings such as Education, Experience, and Skills, or fill in the form manually.')
      }
      setPreview(detected)
      setFileName(file.name)
      setStatus(`${Object.keys(detected).length} fields detected. Review below before applying.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this resume. Try another file or enter your details manually.')
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Resume autofill" className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" aria-hidden="true" /><h3 className="text-sm font-medium">Autofill from your resume</h3><span className="text-xs text-muted-foreground">Optional</span></div>
      <Field data-invalid={!!error} data-disabled={busy}>
        <FieldLabel htmlFor={id}>Choose a resume to autofill</FieldLabel>
        <Input
          id={id}
          type="file"
          multiple={false}
          accept=".pdf,.docx"
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          onChange={(event) => { void select(event.target.files?.[0]); event.target.value = '' }}
        />
        <FieldDescription id={`${id}-help`}>
          One resume only · PDF or DOCX · Up to 5 MB. Read locally on your device, never uploaded. Text-based resumes work best; scanned images are not supported.
        </FieldDescription>
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </Field>
      <p role="status" className="text-xs text-muted-foreground">
        {busy && <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />}{status}
      </p>
      {preview && (
        <>
          <p className="break-all text-xs font-medium">{fileName}</p>
          <dl className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4">
            {Object.entries(preview).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-medium">{LABELS[key]}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">Applying replaces only the fields shown above. Other details stay unchanged. Review and edit the form before saving.</p>
          <Button
            type="button"
            onClick={() => { onApply(preview); setPreview(null); setStatus('Resume details applied. Review the form before continuing or saving.') }}
          >
            Apply detected details
          </Button>
        </>
      )}
    </section>
  )
}
