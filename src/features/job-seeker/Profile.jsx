import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, ImagePlus, MoreHorizontal, Settings2, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import useAuth from '@/shared/hooks/useAuth'
import { updateProfile } from '@/shared/services/auth'
import { listResumes, uploadResume, deleteResume, validateFile, signedUrl } from '@/shared/services/documents'
import { uploadAvatar, removeAvatar, fetchAvatarObjectUrl } from '@/shared/services/images'
import { buildFullName } from '@/shared/utils/names'
import { titleCase } from '@/shared/utils/titleCase'
import { formatPhoneDisplay, isValidPhone, normalizePhone, withPrefix } from '@/shared/utils/phone'
import { listEducation, addEducation, removeEducation, listEmployment } from '@/shared/services/seekers'
import { PageSkeleton } from '@/shared/components/Skeletons'
import { InlineError } from '@/shared/components/dashboard'
import ConfirmationModal from '@/shared/components/ConfirmationModal'
import Toast from '@/shared/components/Toast'
import { TextField, SelectField, Notice, EmptyState, StatusBadge } from '@/shared/components/design'
import TabbedProfileLayout from '@/shared/components/TabbedProfileLayout'
import AccountSettings, { PrivacyPanel } from '@/shared/components/AccountSettings'
import ChangePassword from '@/shared/components/ChangePassword'
import { TabsContent } from '@/components/ui/tabs'
import { BULACAN_MUNICIPALITIES, BULACAN_PROVINCES, SANTA_MARIA_BARANGAYS } from '@/shared/constants'
import { EDUCATION_LEVELS } from '../auth/jobSeekerRegistration'
import useVocabulary from '@/shared/hooks/useVocabulary'
import VocabularyPicker from '@/shared/components/VocabularyPicker'
import TagField from './TagField'
import ResumeAutofill from './ResumeAutofill'

const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

// Same en-PH short date as Employment Tracking.
const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—')

const isCurrentEmployment = (record) => Boolean(record.is_current) || !record.end_date

const PHONE_ERROR = 'Enter a valid Philippine contact number.'

const EMPTY_FORM = {
  name: '', firstName: '', middleName: '', lastName: '', suffix: '',
  phone: '', headline: '', birthdate: '', employmentStatus: '',
  lot: '', block: '', barangay: '', address: '', subdivisionBuilding: '',
  cityMunicipality: '', provinceState: '', postalCode: '',
  experience: '', skills: [], field: '',
}

const PROFILE_TABS = [
  { value: 'personal', label: 'Personal', title: 'Personal & contact details', description: 'Use the information employers need to reach you.' },
  { value: 'address', label: 'Address', title: 'Address', description: 'Where employers and PESO can reach you.' },
  { value: 'skills', label: 'Skills & experience', title: 'Skills, field & work experience', description: 'These details power simple, transparent skill matching.' },
  { value: 'education', label: 'Education', title: 'Education history', description: 'Your schools, attainment, and graduation details.' },
  { value: 'resumes', label: 'My resumes', title: 'My resumes', description: 'Manage the resumes you share with employers.' },
  { value: 'account', label: 'Account settings', title: 'Account settings', description: 'Manage your account preferences, privacy, and password.' },
]

const ACCOUNT_SETTINGS_SECTIONS = new Set([
  'account-overview',
  'notification-preferences',
  'privacy',
  'password-settings',
])

// Stored values outside PESO's predefined lists load blank, so saving a profile
// always persists a value the user picked from the list.
function pickListed(value, options) {
  const text = titleCase(value)
  return options.includes(text) ? text : ''
}

function formFromUser(user) {
  if (!user) return { ...EMPTY_FORM, skills: [] }
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
    cityMunicipality: pickListed(user.city_municipality, BULACAN_MUNICIPALITIES),
    provinceState: pickListed(user.province_state, BULACAN_PROVINCES),
    postalCode: user.postal_code || '',
    experience: user.experience_summary || '',
    skills: Array.isArray(user.skills) ? [...user.skills] : splitList(user.skills),
    field: user.field || '',
  }
}

function ResumeActions({ resume, onReplace, onDelete }) {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${resume.file_name}`}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={Boolean(busy)} onClick={() => open('view')}>
          {busy === 'view' ? 'Opening…' : 'View'}<span className="sr-only"> (opens in new tab)</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={Boolean(busy)} onClick={() => open('download')}>
          {busy === 'download' ? 'Preparing…' : 'Download'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReplace}>Replace</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Profile() {
  const { user, refreshUser } = useAuth()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const userId = user?.id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const closeToast = useCallback(() => setToast(null), [])
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
  const [employmentList, setEmploymentList] = useState([])
  const [employmentLoading, setEmploymentLoading] = useState(true)
  const [employmentLoadError, setEmploymentLoadError] = useState('')
  const [eduForm, setEduForm] = useState({ level: '', school: '', field: '', year: '', studying: false })
  const [eduError, setEduError] = useState('')
  const [eduSaving, setEduSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [tab, setTab] = useState('personal')
  const activeTab = ACCOUNT_SETTINGS_SECTIONS.has(hash.slice(1)) ? 'account' : tab
  const [uploadError, setUploadError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const skillVocabulary = useVocabulary('skill')

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
    listEmployment()
      .then((rows) => { if (live) setEmploymentList(rows || []) })
      .catch((err) => { if (live) setEmploymentLoadError(err.message || 'Failed to load employment history') })
      .finally(() => { if (live) setEmploymentLoading(false) })
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
  // A failed save replaces the form with the inline error, so the toast has to
  // render in this branch too.
  if (error) {
    return (
      <>
        <InlineError message={error} />
        <Toast message={toast?.message} variant={toast?.variant} onClose={closeToast} />
      </>
    )
  }

  // Skills are free-text chips; PESO's list only supplies canonical casing for
  // the values it lists. Unlisted chips are shown and saved as typed.
  const skillByLower = new Map(skillVocabulary.values.map((entry) => [String(entry).toLowerCase(), entry]))
  const skillChips = form.skills.map((chip) => skillByLower.get(String(chip).toLowerCase()) ?? chip)
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
  // Current roles first, then most recent start date. Never touch the fetched array.
  const systemEmployment = [...employmentList].sort((a, b) => (
    Number(isCurrentEmployment(b)) - Number(isCurrentEmployment(a))
    || String(b.start_date || '').localeCompare(String(a.start_date || ''))
  ))
  function setField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  // TagField emits the raw chip; swap in the vocabulary's casing when it knows it.
  function updateSkills(chips) {
    setField('skills', chips.map((chip) => skillByLower.get(String(chip).toLowerCase()) ?? chip))
  }

  function validate() {
    const next = {}
    // Two name modes, matching the save: split names win when any part is set.
    const hasNameParts = [form.firstName, form.middleName, form.lastName, form.suffix]
      .some((part) => String(part || '').trim())
    if (hasNameParts) {
      if (!form.firstName.trim()) next.firstName = 'Enter your first name.'
      if (!form.lastName.trim()) next.lastName = 'Enter your last name.'
    } else if (form.name.trim().length < 3) {
      next.name = 'Enter your full name.'
    }
    if (!isValidPhone(form.phone)) next.phone = PHONE_ERROR
    if (!form.birthdate) next.birthdate = 'Enter your birthday.'
    if (!form.employmentStatus) next.employmentStatus = 'Choose your employment status.'
    if (!form.barangay) next.barangay = 'Choose your barangay.'
    if (form.address.trim().length < 5) next.address = 'Enter your address.'
    if (!form.cityMunicipality) next.cityMunicipality = 'Choose your city / municipality.'
    if (!form.provinceState) next.provinceState = 'Choose your province.'
    if (form.postalCode.trim() && !/^\d{4}$/.test(form.postalCode.trim())) next.postalCode = 'Postal code must be 4 digits.'
    if (!educationLoading && !educationLoadError && !educationList.length) next.education = 'Add your education history.'
    if (!skillChips.length) next.skills = 'Add at least one skill.'
    setErrors(next)
    if (Object.keys(next).length) {
      // Show the tab that owns the first error so its message is not hidden.
      setTab(
        next.name || next.firstName || next.lastName || next.phone || next.birthdate || next.employmentStatus ? 'personal'
          : next.barangay || next.address || next.cityMunicipality || next.provinceState || next.postalCode ? 'address'
            : next.skills ? 'skills'
              : 'education',
      )
    }
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setToast(null)
    const profileValid = validate()
    // A staged resume still uploads on its own, so a new seeker without
    // education yet can save a resume with the same button.
    if (!draft && !profileValid) return
    // Optimistic: confirm as soon as the save starts; the catch swaps in the
    // error toast if a request fails.
    setToast({ message: 'Changes saved', variant: 'success' })
    setSaving(true)
    // Route the error to the step that failed: the resume upload or the profile.
    let step = 'upload'
    try {
      if (draft) {
        await uploadResume(userId, draft)
        setResumes(await listResumes(userId))
        setDraft(null)
        setUploadError('')
      }
      if (!profileValid) return
      step = 'profile'
      const hasComponents = [form.firstName, form.middleName, form.lastName, form.suffix].some((v) => String(v || '').trim())
      const phone = normalizePhone(form.phone)
      const patch = {
        phone,
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
        field: form.field || null,
        skills: skillChips,
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
      setForm((previous) => ({ ...previous, phone }))
    } catch (err) {
      if (step === 'upload') setUploadError(err.message || 'Upload failed')
      else setError(err.message || 'Failed to save profile')
      setToast({ message: 'Changes not saved', variant: 'error' })
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
        if (key === 'education' || key === 'skills') continue
        if (key in next) next[key] = value
      }
      return next
    })
    // Resume skills are free text: append each detected skill as typed, skipping
    // case-insensitive duplicates and stopping at the chip limit.
    const detectedSkills = splitList(details.skills)
    if (educationDetails) {
      setEduForm((previous) => ({
        ...previous,
        level: educationDetails.level,
        school: educationDetails.school || previous.school,
      }))
    }
    setTab(educationDetails ? 'education' : 'personal')
    if (detectedSkills.length) {
      setForm((previous) => {
        const next = [...previous.skills]
        for (const skill of detectedSkills) {
          if (next.length >= 20) break
          if (!next.some((entry) => entry.toLowerCase() === skill.toLowerCase())) next.push(skill)
        }
        return { ...previous, skills: next }
      })
    }
  }

  function handleTabChange(nextTab) {
    setTab(nextTab)
    if (ACCOUNT_SETTINGS_SECTIONS.has(hash.slice(1))) navigate('/job-seeker/profile', { replace: true })
  }

  // Selecting a file only stages it; handleSubmit uploads it on save.
  function pickResume(file) {
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) { setUploadError(validationError); setDraft(null); return }
    setUploadError('')
    setDraft(file)
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
        saveHint="Changes are saved to your JobLinked account."
        sidebar={<PrivacyPanel />}
      >
            <TabsContent value="personal">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
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
                <label htmlFor="profile-picture" className="text-sm font-semibold text-foreground">Profile Picture</label>
                <p className="text-xs leading-5 text-muted-foreground">Upload a clear face photo. It is saved to your account and stays after refresh.</p>
                <input id="profile-picture" type="file" accept="image/png,image/jpeg,image/webp" disabled={photoBusy} className="sr-only" onChange={handlePicture} />
                {photoBusy && <p role="status" className="text-[11px] text-muted-foreground">Uploading…</p>}
                {photoStatus && !photoBusy && <p role="status" className="text-[11px] font-medium text-success">{photoStatus}</p>}
                {photoError && <p role="alert" className="text-[11px] text-destructive">{photoError}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Full Name" required value={show('name')} onChange={(event) => setField('name', event.target.value)} error={errors.name} />
                <TextField
                  label="Contact Number"
                  required
                  type="tel"
                  prefix="+63"
                  inputMode="numeric"
                  value={formatPhoneDisplay(form.phone)}
                  onChange={(event) => {
                    const next = withPrefix(event.target.value)
                    setForm((previous) => ({ ...previous, phone: next }))
                    // Keep an existing error only while the edited value is still invalid.
                    setErrors((previous) => (previous.phone && isValidPhone(next) ? { ...previous, phone: undefined } : previous))
                  }}
                  onBlur={() => {
                    const next = normalizePhone(form.phone)
                    setForm((previous) => ({ ...previous, phone: next }))
                    setErrors((previous) => ({ ...previous, phone: next && !isValidPhone(next) ? PHONE_ERROR : undefined }))
                  }}
                  error={errors.phone}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="First Name" required value={show('firstName')} onChange={(event) => setField('firstName', event.target.value)} error={errors.firstName} />
                <TextField label="Middle Name" value={show('middleName')} onChange={(event) => setField('middleName', event.target.value)} />
                <TextField label="Last Name" required value={show('lastName')} onChange={(event) => setField('lastName', event.target.value)} error={errors.lastName} />
                <TextField label="Suffix" value={show('suffix')} onChange={(event) => setField('suffix', event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Birthday" required type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthdate} onChange={(event) => setField('birthdate', event.target.value)} error={errors.birthdate} />
                <SelectField label="Employment Status" required placeholder="Select status" options={['Employed','Unemployed','Underemployed','Fresh Graduate','Student']} value={form.employmentStatus} onChange={(event) => setField('employmentStatus', event.target.value)} error={errors.employmentStatus} />
              </div>
              <TextField label="Professional Headline" value={form.headline} onChange={(event) => setField('headline', event.target.value)} />
            </div>
          </div>
            </TabsContent>
            <TabsContent value="address">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Lot" value={show('lot')} onChange={(event) => setField('lot', event.target.value)} />
                <TextField label="Block" value={show('block')} onChange={(event) => setField('block', event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Street or Local Address" required value={show('address')} onChange={(event) => setField('address', event.target.value)} error={errors.address} />
                <TextField label="Subdivision / Village / Building" value={show('subdivisionBuilding')} onChange={(event) => setField('subdivisionBuilding', event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Barangay" required placeholder="Select barangay" options={barangays} value={show('barangay')} onChange={(event) => setField('barangay', event.target.value)} error={errors.barangay} />
                <SelectField label="City / Municipality" required id="cityMunicipality" placeholder="Select city / municipality" options={BULACAN_MUNICIPALITIES} value={show('cityMunicipality')} onChange={(event) => setField('cityMunicipality', event.target.value)} error={errors.cityMunicipality} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Province / State" required id="provinceState" placeholder="Select province" options={BULACAN_PROVINCES} value={show('provinceState')} onChange={(event) => setField('provinceState', event.target.value)} error={errors.provinceState} />
                <TextField label="Postal Code" value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} error={errors.postalCode} />
              </div>
            </div>
            </TabsContent>
            <TabsContent value="skills">
            <div className="flex flex-col gap-4">
              <VocabularyPicker
                id="profile-field"
                label="Field"
                category="job_field"
                multiple={false}
                value={form.field}
                onChange={(value) => setField('field', value)}
                help="Your main line of work. Optional — pick “Not set” to leave it blank."
              />
              <TagField
                label="Your Skills"
                value={skillChips}
                onChange={updateSkills}
                suggestions={skillVocabulary.values}
                max={20}
                required
                placeholder="Type a skill and press Enter"
                help="Pick the skills employers should match you on."
                error={errors.skills}
              />
              {skillVocabulary.loading && <p role="status" className="text-xs text-muted-foreground">Loading skills…</p>}
              {skillVocabulary.error && (
                <p role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                  <span>{skillVocabulary.error}</span>
                  <Button type="button" variant="outline" size="sm" onClick={skillVocabulary.reload}>Retry</Button>
                </p>
              )}
              <TagField label="Work Experience" value={form.experience} onChange={(value) => setField('experience', value)} placeholder="Type a role or experience and press Enter" help="Add internships, volunteer work, or previous roles as separate tags." />
              <section aria-labelledby="employment-through-joblinked" className="rounded-lg border p-4">
                <h3 id="employment-through-joblinked" className="text-sm font-semibold text-foreground">Employment through JobLinked</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Positions confirmed through the system. Read-only.</p>
                {employmentLoading && (
                  <p role="status" className="mt-3 text-xs text-muted-foreground">Loading employment records…</p>
                )}
                {employmentLoadError && (
                  <p role="alert" className="mt-3 text-xs text-destructive">{employmentLoadError}</p>
                )}
                {!employmentLoading && !employmentLoadError && (
                  systemEmployment.length ? (
                    <ul className="mt-3 flex flex-col gap-3">
                      {systemEmployment.map((record) => {
                        const current = isCurrentEmployment(record)
                        return (
                          <li key={record.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium">{record.position || '—'}</p>
                              <p className="text-xs text-muted-foreground">{record.employer_name || '—'}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(record.start_date)} – {current ? 'Present' : formatDate(record.end_date)}
                              </p>
                            </div>
                            <StatusBadge status={current ? 'Active' : 'Separated'} />
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="mt-3">
                      <EmptyState
                        title="No system-recorded employment yet."
                        description="When an employer confirms your hire through JobLinked, the role appears here."
                      />
                    </div>
                  )
                )}
              </section>
            </div>
            </TabsContent>
            <TabsContent value="education">
            <div className="flex flex-col gap-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Education Status</p>
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
                    <p className="text-xs text-muted-foreground">{[edu.field, edu.end_year ? `Graduated ${edu.end_year}` : (edu.end_year === null ? 'Currently studying' : '')].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => handleRemoveEducation(edu.id)}>Remove</Button>
                </li>
              ))}
              {educationList.length === 0 && <p className="text-xs text-muted-foreground">No education records yet.</p>}
            </ul>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Level" required placeholder="Education level" options={EDUCATION_LEVELS} value={eduForm.level} onChange={(e) => setEduForm((p) => ({ ...p, level: e.target.value }))} />
                <TextField label="School" required value={titleCase(eduForm.school)} onChange={(e) => setEduForm((p) => ({ ...p, school: e.target.value }))} />
                <TextField label="Field / Course" value={eduForm.field} onChange={(e) => setEduForm((p) => ({ ...p, field: e.target.value }))} />
                <TextField label="Graduation Year" required={!eduForm.studying} value={eduForm.year} disabled={eduForm.studying} onChange={(e) => setEduForm((p) => ({ ...p, year: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={eduForm.studying} onChange={(e) => setEduForm((p) => ({ ...p, studying: e.target.checked }))} />
                Currently Studying Here
              </label>
              {eduError && <p className="text-xs text-danger">{eduError}</p>}
              <Button type="button" disabled={eduSaving} onClick={handleAddEducation}>{eduSaving ? 'Adding…' : 'Add education'}</Button>
            </div>
            </div>
            </TabsContent>
            <TabsContent value="resumes">
              <div className="mb-4">
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
                      <div className="shrink-0">
                        <ResumeActions
                          resume={resumes[0]}
                          onReplace={() => document.getElementById('resume-upload')?.click()}
                          onDelete={() => setPendingDelete(resumes[0])}
                        />
                      </div>
                    </div>
                  </li>
                </ul>
              ) : (
                <EmptyState title="No resume added." description="Add a PDF, DOC, or DOCX file up to 5 MB." />
              )}
              {draft && (
                <p role="status" className="mt-3 text-xs text-muted-foreground">
                  Selected {draft.name}. Save my profile to upload it as your resume.
                </p>
              )}
              <div className="mt-4">
                <ResumeAutofill
                  inputId="resume-upload"
                  onApply={applyAutofill}
                  onFileSelected={pickResume}
                  uploadError={uploadError}
                />
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
      <Toast message={toast?.message} variant={toast?.variant} onClose={closeToast} />
    </>
  )
}

export default Profile
