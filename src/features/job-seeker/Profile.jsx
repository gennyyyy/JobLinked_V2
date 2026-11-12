import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, FileText, ImagePlus, Settings2, Trash2, UploadCloud, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import { listResumes, uploadResume, deleteResume, validateFile, signedUrl } from '@/shared/services/documents'
import { uploadAvatar, removeAvatar, fetchAvatarObjectUrl } from '@/shared/services/images'
import { buildFullName } from '@/shared/utils/names'
import { titleCase } from '@/shared/utils/titleCase'
import { listEducation, addEducation, removeEducation } from '@/shared/services/seekers'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import { TextField, SelectField, Notice, EmptyState } from '@/shared/components/design'
import TabbedProfileLayout from '@/shared/components/TabbedProfileLayout'
import AccountSettings, { PrivacyPanel } from '@/shared/components/AccountSettings'
import ChangePassword from '@/shared/components/ChangePassword'
import { TabsContent } from '@/components/ui/tabs'
import { SANTA_MARIA_BARANGAYS } from '@/shared/constants'
import { EDUCATION_LEVELS } from '../auth/jobSeekerRegistration'
import TagField from './TagField'
import ResumeAutofill from './ResumeAutofill'

const PHONE_PATTERN = /^(\+63|0)[\d\s-]{9,15}$/
const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

const EMPTY_FORM = {
  name: '', firstName: '', middleName: '', lastName: '', suffix: '',
  phone: '', headline: '', birthdate: '', employmentStatus: '',
  lot: '', block: '', barangay: '', address: '', subdivisionBuilding: '',
  cityMunicipality: '', provinceState: '', postalCode: '',
  experience: '', skills: '',
}

const PROFILE_TABS = [
  { value: 'personal', label: 'Personal', title: 'Personal & contact details', description: 'Use the information employers need to reach you.' },
  { value: 'address', label: 'Address', title: 'Address', description: 'Where employers and PESO can reach you.' },
  { value: 'education', label: 'Education', title: 'Education, experience & skills', description: 'These details power simple, transparent skill matching.' },
  { value: 'resumes', label: 'My resumes', title: 'My resumes', description: 'Manage the resumes you share with employers.' },
  { value: 'account', label: 'Account settings', title: 'Account settings', description: 'Manage your account preferences, privacy, and password.' },
]

const ACCOUNT_SETTINGS_SECTIONS = new Set([
  'account-overview',
  'notification-preferences',
  'privacy',
  'password-settings',
])

function formFromUser(user) {
  if (!user) return EMPTY_FORM
  return {
    name: titleCase(user.full_name || buildFullName(user.first_name, user.middle_name, user.last_name, user.suffix)),
    firstName: titleCase(user.first_name),
    middleName: titleCase(user.middle_name),
    lastName: titleCase(user.last_name),
    suffix: titleCase(user.suffix),
    phone: user.phone || '',
    headline: user.headline || '',
    birthdate: user.birthdate || '',
    employmentStatus: user.employment_status || '',
    lot: titleCase(user.lot),
    block: titleCase(user.block),
    barangay: titleCase(user.barangay_district),
    address: titleCase(user.street_address),
    subdivisionBuilding: titleCase(user.subdivision_building),
    cityMunicipality: titleCase(user.city_municipality),
    provinceState: titleCase(user.province_state),
    postalCode: user.postal_code || '',
    experience: user.experience_summary || '',
    skills: (user.skills || []).join(', '),
  }
}

function ResumeLinks({ resume }) {
  const [busy, setBusy] = useState('')
  // Fetch on demand: prefetching every resume made one profile visit download
  // every file in full just to render two links (audit F9).
  async function open(kind) {
    setBusy(kind)
    // Open the tab inside the click gesture so the popup blocker allows it.
    const tab = kind === 'view' ? window.open('', '_blank') : null
    if (tab) tab.opener = null
    try {
      const url = await signedUrl('resumes', resume.file_path)
      if (kind === 'view') {
        if (tab) tab.location.href = url
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = resume.file_name
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      // Do not revoke: the URL may be handed to a new tab that outlives this
      // component (Task 12). The browser cleans up on navigation.
    } catch {
      tab?.close()
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <Button type="button" variant="outline" onClick={() => open('view')} disabled={Boolean(busy)}>
        <Eye data-icon="inline-start" />{busy === 'view' ? 'Opening…' : 'View'}<span className="sr-only"> (opens in new tab)</span>
      </Button>
      <Button type="button" variant="outline" onClick={() => open('download')} disabled={Boolean(busy)}>
        {busy === 'download' ? 'Preparing…' : 'Download'}
      </Button>
    </>
  )
}

function Profile() {
  const { user, refreshUser } = useAuth()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const userId = user?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => formFromUser(user))
  const [errors, setErrors] = useState({})
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoStatus, setPhotoStatus] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false)
  const photoActionsRef = useRef(null)
  const [resumes, setResumes] = useState([])
  const [educationList, setEducationList] = useState([])
  const [educationLoading, setEducationLoading] = useState(true)
  const [educationLoadError, setEducationLoadError] = useState('')
  const [eduForm, setEduForm] = useState({ level: '', school: '', field: '', year: '', studying: false })
  const [eduError, setEduError] = useState('')
  const [eduSaving, setEduSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [tab, setTab] = useState('personal')
  const activeTab = ACCOUNT_SETTINGS_SECTIONS.has(hash.slice(1)) ? 'account' : tab
  const [uploadError, setUploadError] = useState('')
  const [resumeStatus, setResumeStatus] = useState('')
  const [resumeReviewConfirmed, setResumeReviewConfirmed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)

  useEffect(() => {
    if (!userId) return
    let live = true
    listResumes(userId)
      .then((rows) => { if (live) setResumes(rows || []) })
      .catch((err) => { if (live) setError(err.message || 'Failed to load profile') })
      .finally(() => { if (live) setLoading(false) })
    listEducation()
      .then((rows) => { if (live) setEducationList(rows || []) })
      .catch((err) => { if (live) setEducationLoadError(err.message || 'Failed to load education history') })
      .finally(() => { if (live) setEducationLoading(false) })
    return () => { live = false }
  }, [userId])

  // One object URL at a time: whichever path loads a photo (page load, upload,
  // remove) revokes the previous blob and publishes the new one.
  const avatarObjectUrl = useRef('')
  const showAvatar = useCallback((url) => {
    if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current)
    avatarObjectUrl.current = url || ''
    setAvatarUrl(url || null)
  }, [])

  // Load the saved avatar as an object URL (the endpoint needs the bearer
  // token, so <img src> cannot point at it directly). A photo-less profile
  // makes no request (the API reports has_avatar).
  useEffect(() => {
    if (!userId || user?.has_avatar === false) return undefined
    let live = true
    fetchAvatarObjectUrl(userId)
      .then((url) => {
        if (!url) return
        if (live) showAvatar(url)
        else URL.revokeObjectURL(url)
      })
      .catch(() => { /* unavailable */ })
    return () => { live = false }
  }, [userId, user?.has_avatar, showAvatar])

  useEffect(() => () => { if (avatarObjectUrl.current) URL.revokeObjectURL(avatarObjectUrl.current) }, [])

  useEffect(() => {
    if (!photoActionsOpen) return
    function closeOnOutsideClick(event) {
      if (!photoActionsRef.current?.contains(event.target)) setPhotoActionsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [photoActionsOpen])

  if (loading) return <PageSkeleton stats={0} panels={2} />
  if (error) return <InlineError message={error} />

  const skills = splitList(form.skills)
  // Edit-view capitalization: show names/addresses title-cased while the form
  // state (and the submitted lowercase value) stays raw.
  const show = (key) => titleCase(form[key])
  // A stored barangay the official list no longer carries stays selectable so
  // opening the page cannot silently blank the saved address.
  const barangays = show('barangay') && !SANTA_MARIA_BARANGAYS.includes(show('barangay'))
    ? [...SANTA_MARIA_BARANGAYS, show('barangay')]
    : SANTA_MARIA_BARANGAYS
  const currentEducation = educationList.find((education) => education.end_year === null)
  const educationStatus = currentEducation
    ? `Currently studying — ${titleCase(currentEducation.level)}`
    : educationList.length
      ? `Completed — ${titleCase(educationList[0].level)}`
      : 'No education history added'
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
    if (!educationLoading && !educationLoadError && !educationList.length) next.education = 'Add your education history.'
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
      const hasComponents = [form.firstName, form.middleName, form.lastName, form.suffix].some((v) => String(v || '').trim())
      const patch = {
        phone: form.phone.trim(),
        headline: form.headline.trim(),
        birthdate: form.birthdate || null,
        employment_status: form.employmentStatus || null,
        lot: form.lot.trim() || null,
        block: form.block.trim() || null,
        barangay_district: form.barangay,
        street_address: form.address.trim(),
        subdivision_building: form.subdivisionBuilding.trim() || null,
        city_municipality: form.cityMunicipality.trim() || null,
        province_state: form.provinceState.trim() || null,
        postal_code: form.postalCode.trim() || null,
        experience_summary: form.experience.trim(),
        skills,
      }
      if (hasComponents) {
        patch.first_name = form.firstName.trim().toLowerCase()
        patch.middle_name = form.middleName.trim().toLowerCase()
        patch.last_name = form.lastName.trim().toLowerCase()
        patch.suffix = form.suffix.trim().toLowerCase()
      } else {
        patch.full_name = form.name.trim()
      }
      await updateProfile(user.id, patch)
      if (refreshUser) await refreshUser(user)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddEducation(event) {
    event?.preventDefault?.()
    const eduError = (!eduForm.level.trim() || !eduForm.school.trim())
      ? 'Please select a level and enter a school name.'
      : (!eduForm.studying && !/^\d{4}$/.test(eduForm.year.trim()) ? 'Graduation year must be a 4-digit year.' : '')
    if (eduError) { setEduError(eduError); return }
    setEduSaving(true)
    setEduError('')
    try {
      const created = await addEducation({
        level: eduForm.level.trim(),
        school: eduForm.school.trim(),
        field: eduForm.field.trim() || null,
        end_year: eduForm.studying ? null : Number(eduForm.year.trim()),
      })
      setEducationList((prev) => [created, ...prev])
      setEduForm({ level: '', school: '', field: '', year: '', studying: false })
    } catch (err) {
      setEduError(err.message || 'Failed to add education')
    } finally {
      setEduSaving(false)
    }
  }

  async function handleRemoveEducation(id) {
    try {
      await removeEducation(id)
      setEducationList((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err.message || 'Failed to remove education')
    }
  }

  function applyAutofill(details) {
    const educationValue = details.education
    const [educationLevel, educationSchool] = String(educationValue || '').split('—').map((part) => part.trim())
    const educationDetails = EDUCATION_LEVELS.includes(educationLevel)
      ? { level: educationLevel, school: educationSchool }
      : null
    setForm((previous) => {
      const next = { ...previous }
      for (const [key, value] of Object.entries(details)) {
        if (!value) continue
        if (key === 'education') continue
        if (key in next) next[key] = value
      }
      return next
    })
    if (educationDetails) {
      setEduForm((previous) => ({
        ...previous,
        level: educationDetails.level,
        school: educationDetails.school || previous.school,
      }))
    }
    setTab(educationDetails ? 'education' : 'personal')
  }

  function handleTabChange(nextTab) {
    setTab(nextTab)
    if (ACCOUNT_SETTINGS_SECTIONS.has(hash.slice(1))) navigate('/job-seeker/profile', { replace: true })
  }

  function pickResume(file) {
    if (!file) return
    setResumeStatus('')
    const validationError = validateFile(file)
    if (validationError) { setUploadError(validationError); setDraft(null); return }
    setUploadError('')
    setDraft(file)
    setResumeReviewConfirmed(false)
  }

  async function handleResumeUpload() {
    if (!draft) return
    if (!resumeReviewConfirmed) {
      setUploadError('Please confirm you will review the resume autofill information.')
      setResumeStatus('')
      return
    }
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

  async function handleDeleteResume(resume) {
    try {
      await deleteResume(resume.id, resume.file_path)
      setResumes((previous) => previous.filter((row) => row.id !== resume.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err.message || 'Failed to delete resume')
    }
  }

  async function handlePicture(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    setPhotoStatus('')
    setPhotoBusy(true)
    try {
      await uploadAvatar(file) // resized client-side, bytes persisted in Postgres
      if (refreshUser) await refreshUser(user)
      showAvatar(await fetchAvatarObjectUrl(userId))
      setPhotoStatus('Photo saved.')
    } catch (err) {
      setPhotoError(err.message || 'Could not save the photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  function openPicturePicker() {
    document.getElementById('profile-picture')?.click()
    setPhotoActionsOpen(false)
  }

  async function handleRemovePicture() {
    setPhotoError('')
    setPhotoStatus('')
    setPhotoBusy(true)
    try {
      await removeAvatar()
      if (refreshUser) await refreshUser(user)
      showAvatar(null)
      setPhotoStatus('Photo removed.')
      setPhotoActionsOpen(false)
    } catch (err) {
      setPhotoError(err.message || 'Could not remove the photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <>
      <TabbedProfileLayout
        pageTitle="Your story, your next step."
        pageDescription="Give local employers a clear picture of your experience and the skills you bring."
        tabs={PROFILE_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSubmit={handleSubmit}
        saving={saving}
        saveLabel="Save my profile"
        savingLabel="Saving…"
        showSave={activeTab !== 'account'}
        saveHint={saved ? 'Profile saved.' : 'Changes are saved to your JobLinked account.'}
        sidebar={<PrivacyPanel />}
      >
            <TabsContent value="personal">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <div ref={photoActionsRef} className="group relative size-30 shrink-0">
                <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                  {avatarUrl ? <img src={avatarUrl} alt="Profile picture" className="size-full object-cover" /> : <UserRound className="size-12" />}
                </div>
                <div className={`absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-black/50 transition-opacity ${photoActionsOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                  {!photoActionsOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Profile picture settings"
                      aria-expanded={photoActionsOpen}
                      disabled={photoBusy}
                      className="text-white hover:bg-white/20 hover:text-white"
                      onClick={() => setPhotoActionsOpen(true)}
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={avatarUrl ? 'Edit profile picture' : 'Add profile picture'}
                        disabled={photoBusy}
                        className="text-white hover:bg-white/20 hover:text-white"
                        onClick={openPicturePicker}
                      >
                        <ImagePlus className="size-4" />
                      </Button>
                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove profile picture"
                          disabled={photoBusy}
                          className="text-white hover:bg-white/20 hover:text-white"
                          onClick={handleRemovePicture}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="profile-picture" className="text-sm font-semibold text-foreground">Profile picture</label>
                <p className="text-xs leading-5 text-muted-foreground">Upload a clear face photo. It is saved to your account and stays after refresh.</p>
                <input id="profile-picture" type="file" accept="image/png,image/jpeg,image/webp" disabled={photoBusy} className="sr-only" onChange={handlePicture} />
                {photoBusy && <p role="status" className="text-[11px] text-muted-foreground">Uploading…</p>}
                {photoStatus && !photoBusy && <p role="status" className="text-[11px] font-medium text-success">{photoStatus}</p>}
                {photoError && <p role="alert" className="text-[11px] text-destructive">{photoError}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Full name" required value={show('name')} onChange={(event) => setField('name', event.target.value)} error={errors.name} />
                <TextField label="Contact number" required type="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} error={errors.phone} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="First Name" value={show('firstName')} onChange={(event) => setField('firstName', event.target.value)} />
                <TextField label="Middle Name" value={show('middleName')} onChange={(event) => setField('middleName', event.target.value)} />
                <TextField label="Last Name" value={show('lastName')} onChange={(event) => setField('lastName', event.target.value)} />
                <TextField label="Suffix" value={show('suffix')} onChange={(event) => setField('suffix', event.target.value)} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Birthday" type="date" value={form.birthdate} onChange={(event) => setField('birthdate', event.target.value)} />
                <SelectField label="Employment Status" placeholder="Select status" options={['Employed','Unemployed','Underemployed','Fresh Graduate','Student']} value={form.employmentStatus} onChange={(event) => setField('employmentStatus', event.target.value)} />
              </div>
              <TextField label="Professional headline" required value={form.headline} onChange={(event) => setField('headline', event.target.value)} error={errors.headline} />
            </div>
          </div>
            </TabsContent>
            <TabsContent value="address">
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Lot" value={show('lot')} onChange={(event) => setField('lot', event.target.value)} />
                <TextField label="Block" value={show('block')} onChange={(event) => setField('block', event.target.value)} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField label="Barangay" placeholder="Select barangay" options={barangays} value={show('barangay')} onChange={(event) => setField('barangay', event.target.value)} error={errors.barangay} />
                <TextField label="Street or local address" required value={show('address')} onChange={(event) => setField('address', event.target.value)} error={errors.address} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Subdivision / Village / Building" value={show('subdivisionBuilding')} onChange={(event) => setField('subdivisionBuilding', event.target.value)} />
                <TextField label="City / Municipality" value={show('cityMunicipality')} onChange={(event) => setField('cityMunicipality', event.target.value)} />
                <TextField label="Province / State" value={show('provinceState')} onChange={(event) => setField('provinceState', event.target.value)} />
                <TextField label="Postal Code" value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} />
              </div>
            </div>
            </TabsContent>
            <TabsContent value="education">
            <div className="flex flex-col gap-5">
              <TagField label="Work experience" value={form.experience} onChange={(value) => setField('experience', value)} placeholder="Type a role or experience and press Enter" help="Add internships, volunteer work, or previous roles as separate tags." />
              <TagField label="Your skills" required value={form.skills} onChange={(value) => setField('skills', value)} placeholder="Type a skill and press Enter" help="Add each skill as a separate tag." error={errors.skills} />
            </div>
          <div className="border-t border-border pt-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Education history</h2>
            <div className="mb-4 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Education status</p>
              <p role="status" className="mt-1 text-sm">
                {educationLoading ? 'Loading…' : educationLoadError ? 'Education history unavailable' : educationStatus}
              </p>
              {educationLoadError && <p role="alert" className="mt-1 text-xs text-danger">{educationLoadError}</p>}
              {errors.education && <p className="mt-1 text-xs text-danger">{errors.education}</p>}
            </div>
            <ul className="flex flex-col gap-3">
              {educationList.map((edu) => (
                <li key={edu.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <div>
                    <p className="font-medium">{titleCase(edu.school)} — {titleCase(edu.level)}</p>
                    <p className="text-xs text-muted-foreground">{edu.field || ''}{edu.end_year ? ` · ${edu.end_year}` : (edu.end_year === null ? ' · Currently studying' : '')}</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => handleRemoveEducation(edu.id)}>Remove</Button>
                </li>
              ))}
              {educationList.length === 0 && <p className="text-xs text-muted-foreground">No education records yet.</p>}
            </ul>
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Level" placeholder="Education level" options={EDUCATION_LEVELS} value={eduForm.level} onChange={(e) => setEduForm((p) => ({ ...p, level: e.target.value }))} />
                <TextField label="School" value={titleCase(eduForm.school)} onChange={(e) => setEduForm((p) => ({ ...p, school: e.target.value }))} />
                <TextField label="Field / Course" value={eduForm.field} onChange={(e) => setEduForm((p) => ({ ...p, field: e.target.value }))} />
                <TextField label="Graduation year" value={eduForm.year} disabled={eduForm.studying} onChange={(e) => setEduForm((p) => ({ ...p, year: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={eduForm.studying} onChange={(e) => setEduForm((p) => ({ ...p, studying: e.target.checked }))} />
                Currently studying here
              </label>
              {eduError && <p className="text-xs text-danger">{eduError}</p>}
              <Button type="button" disabled={eduSaving} onClick={handleAddEducation}>{eduSaving ? 'Adding…' : 'Add education'}</Button>
            </div>
          </div>
            </TabsContent>
            <TabsContent value="resumes">
              <div className="mb-5">
                <Notice title="Your resume stays private">
                  Only you, authorized PESO personnel, and the employers you apply to can open the resume attached to your application.
                </Notice>
              </div>
              {resumes[0] ? (
                <ul className="flex flex-col gap-4">
                  <li className="rounded-xl border p-4" key={resumes[0].id}>
                    <div className="flex items-start gap-3">
                      <span className="soft-icon"><FileText className="size-5" /></span>
                      <div className="min-w-0 flex-1">
                        <h2 className="break-all text-sm font-medium">{resumes[0].file_name}</h2>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Added {new Date(resumes[0].uploaded_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ResumeLinks resume={resumes[0]} />
                      <Button type="button" variant="ghost" onClick={() => document.getElementById('resume-upload')?.click()}>Replace</Button>
                      <Button type="button" variant="ghost" onClick={() => setPendingDelete(resumes[0])}>
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </li>
                </ul>
              ) : (
                <EmptyState title="Start with your story." description="Add a resume using the form. PDF, DOC, or DOCX up to 5 MB." />
              )}
              <div className="mt-5">
                <ResumeAutofill
                  inputId="resume-upload"
                  onApply={applyAutofill}
                  onFileSelected={pickResume}
                  onReviewConfirmedChange={setResumeReviewConfirmed}
                  uploadError={uploadError}
                  uploadControl={draft && (
                    <Button type="button" variant="outline" disabled={uploading} onClick={handleResumeUpload}>
                      <UploadCloud data-icon="inline-start" />
                      {uploading ? 'Uploading…' : 'Add resume'}
                    </Button>
                  )}
                />
                {resumeStatus && <p role="status" className="mt-3 text-xs text-muted-foreground">{resumeStatus}</p>}
                <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
                  Replacing your resume updates what employers see for applications attached to it.                </p>
              </div>
            </TabsContent>
            <TabsContent value="account">
              <AccountSettings embedded showPrivacy={false}>
                <ChangePassword embedded />
              </AccountSettings>
            </TabsContent>
      </TabbedProfileLayout>

      {pendingDelete && (
        <ConfirmationModal
          message="Are you sure you want to delete this resume? Applications you already sent stay, but they no longer show this resume."          onConfirm={() => handleDeleteResume(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
          confirmLabel="Delete"
          danger
        />
      )}
    </>
  )
}

export default Profile
