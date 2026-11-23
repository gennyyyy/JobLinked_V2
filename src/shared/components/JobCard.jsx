import { Link } from 'react-router-dom'
import { titleCase } from '../utils/titleCase'
import { Bookmark, BookmarkCheck, BriefcaseBusiness, Check, Clock3, Laptop, MapPin, Users } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CompanyMark } from './design'
import { employerLogoUrl } from '../services/images'
import {
  categoryLabel,
  closingDateLabel,
  companyInitial,
  companyName,
  experienceLabel,
  isJobOpen,
  jobLocation,
  jobType,
  salaryLabel,
  timeAgo,
} from '../utils/jobDisplay'

// 1:1 port of the reference job card (components/jobs/job-card.tsx).
export default function JobCard({ job, href, showMatch = false, match, matchReason, saved = false, canSave = false, onToggleSave }) {
  const field = job.field || categoryLabel(job)
  const skills = (Array.isArray(job.skills) ? job.skills : []).filter(Boolean)
  const highlights = (Array.isArray(job.tags) ? job.tags : []).filter(Boolean)
  // Structured skills are the only thing "skills overlap" may be measured
  // against; a legacy vacancy with no skills list shows no match at all.
  const hasMatch = showMatch && match && skills.length > 0
  const open = isJobOpen(job)
  const closes = closingDateLabel(job)

  return (
    <Card className="job-card relative h-full gap-5 [--card-spacing:--spacing(5)]">
      <CardHeader>
        <div className="mb-4 flex items-start gap-3">
          <CompanyMark initials={companyInitial(job)} src={employerLogoUrl(job.employers)} />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-[11px] font-medium text-muted-foreground">{companyName(job)}</p>
            {job.employers?.accreditation_status === 'approved' && (
              <span className="mt-1 flex items-center gap-1 text-[10px] text-teal"><Check className="size-3" />Verified employer</span>
            )}
          </div>
          {canSave && (
            <button
              type="button"
              aria-label={saved ? `Unsave ${titleCase(job.title)}` : `Save ${titleCase(job.title)}`}
              aria-pressed={saved}
              onClick={() => onToggleSave(job.id)}
              className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              {saved ? <BookmarkCheck className="size-4 fill-primary text-primary" /> : <Bookmark className="size-4" />}
            </button>
          )}
        </div>
        <CardTitle>
          <Link to={href} className="text-[17px] leading-6 tracking-[-.025em] transition-colors hover:text-primary after:absolute after:inset-0 after:content-['']">{titleCase(job.title)}</Link>
        </CardTitle>
        <CardDescription className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
          <span className="flex items-center gap-1"><MapPin className="size-3" />{jobLocation(job)}</span>
          <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3" />{jobType(job)}</span>
          {job.work_arrangement && (
            <span className="flex items-center gap-1"><Laptop className="size-3" />{job.work_arrangement}</span>
          )}
          {job.vacancies ? (
            <span className="flex items-center gap-1"><Users className="size-3" />{Number(job.vacancies) === 1 ? '1 opening' : `${job.vacancies} openings`}</span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {field && <Badge variant="secondary">{field}</Badge>}
          {experienceLabel(job) && <Badge variant="outline">{experienceLabel(job)}</Badge>}
          {hasMatch && <Badge variant="secondary" className="bg-teal-soft text-teal">{match.score}% skills overlap</Badge>}
        </div>
        {skills.length > 0 && (
          <div role="group" aria-label="Skills required" className="flex flex-wrap gap-1.5">
            {skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
          </div>
        )}
        {highlights.length > 0 && (
          <div role="group" aria-label="Job highlights" className="flex flex-wrap gap-1.5">
            {highlights.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
          </div>
        )}
        <p className="text-[15px] font-semibold text-navy">
          {salaryLabel(job)}
          {job.salary_min ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ month</span> : null}
        </p>
        {hasMatch && (
          <p className="text-[11px] leading-5 text-muted-foreground">
            {match.matched.length} of {match.total} listed skills match: {match.matched.join(', ') || 'no exact matches yet'}.
          </p>
        )}
        {matchReason && (
          <p className="text-[11px] leading-5 text-muted-foreground">{matchReason}</p>
        )}
      </CardContent>
      <CardFooter className="justify-between bg-white py-3">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock3 className="size-3" />{open ? timeAgo(job.created_at) : 'Applications closed'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {closes ? `${open ? 'Closes' : 'Closed'} ${closes}` : 'No closing date'}
        </span>
      </CardFooter>
    </Card>
  )
}
