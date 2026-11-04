import { Link } from 'react-router-dom'
import { ArrowUpRight, Bookmark, BookmarkCheck, BriefcaseBusiness, Check, Clock3, MapPin } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CompanyMark } from './design'
import {
  categoryLabel,
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
export default function JobCard({ job, href, showMatch = false, match, saved = false, canSave = false, onToggleSave }) {
  return (
    <Card className="job-card h-full gap-5 [--card-spacing:--spacing(5)]">
      <CardHeader>
        <div className="mb-4 flex items-start gap-3">
          <CompanyMark initials={companyInitial(job)} />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="truncate text-[11px] font-medium text-muted-foreground">{companyName(job)}</p>
            <span className="mt-1 flex items-center gap-1 text-[10px] text-teal"><Check className="size-3" />Verified employer</span>
          </div>
          {canSave && (
            <button
              type="button"
              aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`}
              aria-pressed={saved}
              onClick={() => onToggleSave(job.id)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              {saved ? <BookmarkCheck className="size-4 fill-primary text-primary" /> : <Bookmark className="size-4" />}
            </button>
          )}
        </div>
        <CardTitle>
          <Link to={href} className="text-[17px] leading-6 tracking-[-.025em] transition-colors hover:text-primary">{job.title}</Link>
        </CardTitle>
        <CardDescription className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
          <span className="flex items-center gap-1"><MapPin className="size-3" />{jobLocation(job)}</span>
          <span className="flex items-center gap-1"><BriefcaseBusiness className="size-3" />{jobType(job)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {categoryLabel(job) && <Badge variant="secondary">{categoryLabel(job)}</Badge>}
          {experienceLabel(job) && <Badge variant="outline">{experienceLabel(job)}</Badge>}
          {showMatch && match && <Badge variant="secondary" className="bg-teal-soft text-teal">{match.score}% skills overlap</Badge>}
        </div>
        <p className="text-[15px] font-semibold text-navy">
          {salaryLabel(job)}
          {job.salary_min ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ month</span> : null}
        </p>
        {showMatch && match && (
          <p className="text-[11px] leading-5 text-muted-foreground">
            {match.matched.length} of {match.total} listed skills match: {match.matched.join(', ') || 'no exact matches yet'}.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between bg-white py-3">
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock3 className="size-3" />{isJobOpen(job) ? timeAgo(job.created_at) : 'Applications closed'}
        </span>
        <Link to={href} className="flex min-h-9 items-center gap-1 text-[11px] font-medium text-primary">
          View job<ArrowUpRight className="size-3.5" />
        </Link>
      </CardFooter>
    </Card>
  )
}
