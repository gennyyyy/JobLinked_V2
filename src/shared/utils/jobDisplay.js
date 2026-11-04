// Display adapters for a vacancy row coming from the Express API (snake_case)
// to the labels the reference design shows.

export function currency(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount)
}

export function salaryLabel(job) {
  return job.salary_min
    ? `${currency(job.salary_min)}${job.salary_max ? ` - ${currency(job.salary_max)}` : '+'}`
    : 'Salary not disclosed'
}

export function timeAgo(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
  return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`
}

export const companyName = (job) => job.employers?.company_name || 'Verified employer'
export const companyInitial = (job) => String(companyName(job)).charAt(0).toUpperCase()
export const jobLocation = (job) => job.location || 'Santa Maria'
export const jobType = (job) => job.employment_type || 'Full-time'

// The employer form stores education/experience as prefixed lines inside the
// free-text requirements blob.
const EXPERIENCE_LINE = /^\s*Experience:\s*(.*)$/im
export const experienceLabel = (job) => (String(job.requirements || '').match(EXPERIENCE_LINE)?.[1] || job.work_arrangement || '').trim()

// Bucket the recorded years into the reference's experience-level filter.
export function experienceLevel(job) {
  const label = experienceLabel(job).toLowerCase()
  if (!label) return ''
  if (/no experience|fresh grad|entry/.test(label)) return 'No experience'
  const years = Number((label.match(/\d+/) || [])[0])
  if (!Number.isFinite(years)) return ''
  if (years === 0) return 'No experience'
  if (years === 1) return 'Entry level'
  if (years <= 3) return '1–3 years'
  return '3+ years'
}

// Closest analogue of the reference's "category" badge.
export const categoryLabel = (job) => (Array.isArray(job.tags) && job.tags.length ? job.tags[0] : job.office || job.employment_type || '')

export function isJobOpen(job) {
  if (job.status && job.status !== 'published' && job.status !== 'Published') return false
  if (!job.deadline) return true
  const deadline = new Date(`${String(job.deadline).slice(0, 10)}T23:59:59+08:00`).getTime()
  return Number.isFinite(deadline) ? deadline >= Date.now() : true
}

// Skills listed on the vacancy are not structured in this API, so the overlap is
// measured against the seeker's own skills appearing in the vacancy text.
export function matchJob(job, user) {
  const skills = (Array.isArray(user?.skills) ? user.skills : []).filter(Boolean)
  const text = `${job.title || ''} ${job.description || ''} ${job.requirements || ''} ${(job.tags || []).join(' ')}`.toLowerCase()
  const matched = skills.filter((skill) => text.includes(String(skill).toLowerCase().trim()))
  const total = skills.length
  return { score: total ? Math.round((matched.length / total) * 100) : 0, matched, total }
}

const IGNORED_PREFERENCE_WORDS = ['the', 'and', 'for', 'with', 'want', 'looking', 'job', 'prefer', 'would', 'like']

// Keyword overlap between a free-text preference prompt and the vacancy.
export function preferenceScore(job, prompt) {
  const tokens = [...new Set(prompt.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])]
    .filter((token) => token.length > 2 && !IGNORED_PREFERENCE_WORDS.includes(token))
  const text = `${job.title} ${categoryLabel(job)} ${jobType(job)} ${job.work_arrangement || ''} ${jobLocation(job)} ${experienceLabel(job)} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase()
  return tokens.filter((token) => text.includes(token)).length
}
