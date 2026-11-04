import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, FileText, Save, Trash2, UploadCloud, UserRound } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import { listResumes, uploadResume, setActiveResume, deleteResume, validateFile, signedUrl } from '@/shared/services/documents'
import { buildFullName } from '@/shared/utils/names'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import { PageHeading, Panel, TextField, SelectField, Notice, EmptyState } from '@/shared/components/design'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'
import TagField from './TagField'
import ResumeAutofill from './ResumeAutofill'

const PHONE_PATTERN = /^(\+63|0)[\d\s-]{9,15}$/
const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

const EMPTY_FORM = { name: '', phone: '', headline: '', barangay: '', address: '', education: '', experience: '', skills: '' }

function formFromUser(user) {
  if (!user) return EMPTY_FORM
  return {
    name: user.full_name || buildFullName(user.first_name, user.middle_name, user.last_name, user.suffix),
    phone: user.phone || '',
    headline: user.headline || '',
    barangay: user.barangay_district || '',
    address: user.street_address || '',
    education: user.education_summary || '',
    experience: user.experience_summary || '',
    skills: (user.skills || []).join(', '),
  }
}

function ResumeLinks({ resume }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let live = true
    let objectUrl = ''
    signedUrl('resumes', resume.file_path)
      .then((value) => {
        if (live) { objectUrl = value; setUrl(value) } else URL.revokeObjectURL(value)
      })
      .catch(() => {})
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [resume.file_path])
  if (!url) return null
  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline' })}>
        <Eye data-icon="inline-start" />View<span className="sr-only"> (opens in new tab)</span>
      </a>
      <a href={url} download={resume.file_name} className={buttonVariants({ variant: 'outline' })}>Download</a>
    </>
  )
}

const fileSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

function Profile() {
  const { user, refreshUser } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => formFromUser(user))
  const [errors, setErrors] = useState({})
  const [picture, setPicture] = useState(null)
  const [resumes, setResumes] = useState([])
  const [draft, setDraft] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [resumeStatus, setResumeStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    if (!userId) return
    listResumes(userId)
      .then((rows) => setResumes(rows || []))
      .catch((err) => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <PageSkeleton stats={0} panels={2} />
  if (error) return <InlineError message={error} />

  const skills = splitList(form.skills)
  // A stored barangay the official list no longer carries stays selectable so
  // opening the page cannot silently blank the saved address.
  const barangays = form.barangay && !SANTA_MARIA_BARANGAYS.includes(form.barangay)
    ? [...SANTA_MARIA_BARANGAYS, form.barangay]
    : SANTA_MARIA_BARANGAYS
  const completion = Math.round(([
    form.name, form.phone, form.barangay, form.address,
    form.education, form.experience, skills.length, resumes.length,
  ].filter(Boolean).length / 8) * 100)

  function setField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  function validate() {
    const next = {}
    if (form.name.trim().length < 3) next.name = 'Enter your full name.'
    if (!PHONE_PATTERN.test(form.phone.trim())) next.phone = 'Enter a valid Philippine contact number.'
    if (form.headline.trim().length < 5) next.headline = 'Add a short professional headline.'
    if (!form.barangay) next.barangay = 'Choose your barangay.'
    if (form.address.trim().length < 5) next.address = 'Enter your address.'
    if (form.education.trim().length < 5) next.education = 'Add your education or training.'
    if (!skills.length) next.skills = 'Add at least one skill, separated by commas.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile(user.id, {
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        headline: form.headline.trim(),
        barangay_district: form.barangay,
        street_address: form.address.trim(),
        education_summary: form.education.trim(),
        experience_summary: form.experience.trim(),
        skills,
      })
      if (refreshUser) await refreshUser(user)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  function applyAutofill(details) {
    setForm((previous) => {
      const next = { ...previous }
      for (const [key, value] of Object.entries(details)) {
        if (value && key in next) next[key] = value
      }
      return next
    })
  }

  function pickResume(event) {
    const file = event.target.files?.[0] ?? event.dataTransfer?.files?.[0]
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) { setUploadError(validationError); setDraft(null); return }
    setUploadError('')
    setDraft(file)
  }

  async function handleResumeUpload() {
    if (!draft) return
    setUploading(true)
    setResumeStatus('Uploading…')
    try {
      await uploadResume(userId, draft)
      setResumes(await listResumes(userId))
      setDraft(null)
      setResumeStatus('Resume uploaded.')
      setTimeout(() => setResumeStatus(''), 3000)
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
      setResumeStatus('')
    } finally {
      setUploading(false)
    }
  }

  async function handleSetActiveResume(resumeId) {
    await setActiveResume(userId, resumeId)
    setResumes((previous) => previous.map((resume) => ({ ...resume, is_active: resume.id === resumeId })))
  }

  async function handleDeleteResume(resume) {
    await deleteResume(resume.id, resume.file_path)
    setResumes((previous) => previous.filter((row) => row.id !== resume.id))
    setPendingDelete(null)
  }

  function handlePicture(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { event.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => setPicture(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  return (
    <>
      <PageHeading
        eyebrow="Introduce yourself"
        title="Your story, your next step."
        description="Give local employers a clear picture of your experience and the skills you bring."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-6" noValidate>
          <ResumeAutofill onApply={applyAutofill} />
          <Panel title="Personal & contact details" description="Use the information employers need to reach you.">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {picture ? <img src={picture} alt="Profile preview" className="size-full object-cover" /> : <UserRound className="size-8" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="profile-picture" className="text-sm font-semibold text-foreground">Profile picture</label>
                <p className="text-xs leading-5 text-muted-foreground">Upload a clear face photo. The preview is kept in memory until refresh.</p>
                <input id="profile-picture" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90" onChange={handlePicture} />
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Full name" required value={form.name} onChange={(event) => setField('name', event.target.value)} error={errors.name} />
                <TextField label="Contact number" required type="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} error={errors.phone} />
              </div>
              <TextField label="Professional headline" required value={form.headline} onChange={(event) => setField('headline', event.target.value)} error={errors.headline} />
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField label="Barangay" placeholder="Select barangay" options={barangays} value={form.barangay} onChange={(event) => setField('barangay', event.target.value)} error={errors.barangay} />
                <TextField label="Street or local address" required value={form.address} onChange={(event) => setField('address', event.target.value)} error={errors.address} />
              </div>
            </div>
          </Panel>
          <Panel title="Education, experience & skills" description="These details power simple, transparent skill matching.">
            <div className="flex flex-col gap-5">
              <TagField label="Education or training" required value={form.education} onChange={(value) => setField('education', value)} placeholder="Type a qualification and press Enter" error={errors.education} />
              <TagField label="Work experience" value={form.experience} onChange={(value) => setField('experience', value)} placeholder="Type a role or experience and press Enter" help="Add internships, volunteer work, or previous roles as separate tags." />
              <TagField label="Your skills" required value={form.skills} onChange={(value) => setField('skills', value)} placeholder="Type a skill and press Enter" help="Add each skill as a separate tag." error={errors.skills} />
            </div>
          </Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-[11px] text-muted-foreground">{saved ? 'Profile saved.' : 'Changes are saved to your JobLinked account.'}</p>
            <Button type="submit" disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? 'Saving…' : 'Save my profile'}
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-5">
          <Panel title="A profile that feels like you">
            <div className="soft-icon mb-4">
              <UserRound className="size-5" />
            </div>
            <p className="text-sm font-semibold text-navy">{form.name || 'Job Seeker'}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">{form.headline || 'Add a professional headline to introduce yourself.'}</p>
            <p className="mt-4 text-xs font-medium text-teal">{completion}% complete</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
            </div>
          </Panel>
          <Notice title="Share only what is needed">
            Your profile is not a public directory entry. Applicant details are limited to the receiving employer and authorized PESO personnel.
          </Notice>
        </div>
      </div>

      <div className="mt-8 border-t border-border pt-8">
        <div className="mb-6">
          <Notice title="Your resume stays private">
            Only you, authorized PESO personnel, and the employers you apply to can open the resume attached to your application.
          </Notice>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="My resumes">
            {resumes.length ? (
              <ul className="flex flex-col gap-4">
                {resumes.map((resume) => (
                  <li className="rounded-xl border p-4" key={resume.id}>
                    <div className="flex items-start gap-3">
                      <span className="soft-icon"><FileText className="size-5" /></span>
                      <div className="min-w-0 flex-1">
                        <h2 className="break-all text-sm font-medium">{resume.file_name}</h2>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {resume.is_active ? 'Active resume · ' : ''}Added {new Date(resume.uploaded_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ResumeLinks resume={resume} />
                      {!resume.is_active && (
                        <Button type="button" variant="ghost" onClick={() => handleSetActiveResume(resume.id)}>Set active</Button>
                      )}
                      <Button type="button" variant="ghost" onClick={() => document.getElementById('resume-upload')?.click()}>Replace</Button>
                      <Button type="button" variant="ghost" onClick={() => setPendingDelete(resume)}>
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Start with your story." description="Add a resume using the form. PDF, DOC, or DOCX up to 5 MB." />
            )}
          </Panel>
          <Panel title="Add a resume" description="PDF, DOC, or DOCX · Up to 5 MB">
            <Field data-invalid={!!uploadError}>
              <FieldLabel htmlFor="resume-upload">Choose a resume</FieldLabel>
              <div
                className="rounded-xl border border-dashed bg-muted/70 p-5"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); pickResume(event) }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="soft-icon">{draft ? <FileText className="size-5" /> : <UploadCloud className="size-5" />}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-navy">{draft?.name ?? 'Choose a resume or drop it here'}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{draft ? fileSize(draft.size) : 'PDF, DOC, DOCX · Up to 5 MB'}</p>
                  </div>
                  {draft && <CheckCircle2 className="ml-auto size-4 shrink-0 text-teal" />}
                </div>
                <Input id="resume-upload" type="file" accept=".pdf,.doc,.docx" onChange={pickResume} aria-invalid={!!uploadError} />
                <Button type="button" variant="outline" className="mt-3" disabled={!draft || uploading} onClick={handleResumeUpload}>
                  <UploadCloud data-icon="inline-start" />
                  {uploading ? 'Uploading…' : 'Add resume'}
                </Button>
              </div>
              {uploadError && <FieldError>{uploadError}</FieldError>}
            </Field>
            {resumeStatus && <p role="status" className="mt-3 text-xs text-muted-foreground">{resumeStatus}</p>}
            <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
              Replacing a resume does not alter an already submitted application. A newly uploaded resume becomes the active one.
            </p>
          </Panel>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmationModal
          message="Are you sure you want to delete this resume? Applications you already sent keep the resume that was attached at the time."
          onConfirm={() => handleDeleteResume(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
          confirmLabel="Delete"
          danger
        />
      )}
    </>
  )
}

export default Profile
