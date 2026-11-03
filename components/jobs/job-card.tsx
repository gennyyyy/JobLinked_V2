'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Clock3, Bookmark, ArrowUpRight, BriefcaseBusiness, Check } from 'lucide-react'
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CompanyMark, VerifiedBadge } from '@/components/shared'
import { useDemo } from '@/hooks/use-demo'
import { useAction } from '@/hooks/use-action'
import { salaryLabel, timeAgo, isJobOpen, matchJob } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { JobPosting } from '@/types'

export function SaveJobButton({ job, labeled = false }: { job: JobPosting; labeled?: boolean }) {
  const { seeker, user, api } = useDemo()
  const { run, pending } = useAction()
  const router = useRouter()
  const saved = seeker?.savedJobIds.includes(job.id)
  return <Button variant={labeled ? 'outline' : 'ghost'} size={labeled ? 'default' : 'icon'} aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`} aria-pressed={!!saved} disabled={pending} onClick={() => { if (!user) { router.push(`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`); return } if (!seeker) { toast.info('Switch to a Job Seeker demo account to save vacancies.'); return } void run(() => api.saveJob(job.id), saved ? 'Job removed from saved jobs.' : 'Job saved to your collection.') }}><Bookmark className={cn(saved && 'fill-primary text-primary')} />{labeled && (saved ? 'Saved job' : 'Save job')}</Button>
}
export function JobCard({ job, showMatch = false }: { job: JobPosting; showMatch?: boolean }) {
  const { state, seeker } = useDemo()
  const company = state.employers.find(e => e.id === job.employerId)
  if (!company) return null
  const match = matchJob(job, seeker)
  return <Card className="job-card h-full gap-5 [--card-spacing:--spacing(5)]"><CardHeader><div className="mb-4 flex items-start gap-3"><CompanyMark initials={company.initials} color={company.color} /><div className="min-w-0 flex-1 pt-0.5"><p className="truncate text-[11px] font-medium text-muted-foreground">{company.name}</p><span className="mt-1 flex items-center gap-1 text-[10px] text-teal"><Check className="size-3" />Verified employer · demo</span></div><SaveJobButton job={job} /></div><CardTitle><Link href={`/jobs/${job.id}`} className="text-[17px] leading-6 tracking-[-.025em] transition-colors hover:text-primary">{job.title}</Link></CardTitle><CardDescription className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]"><span className="flex items-center gap-1"><MapPin className="size-3" />{job.barangay}</span><span className="flex items-center gap-1"><BriefcaseBusiness className="size-3" />{job.type}</span></CardDescription></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><div className="flex flex-wrap gap-1.5"><Badge variant="secondary">{job.category}</Badge><Badge variant="outline">{job.experience}</Badge>{showMatch && <Badge variant="secondary" className="bg-teal-soft text-teal">{match.score}% skills overlap</Badge>}</div><p className="text-[15px] font-semibold text-navy">{salaryLabel(job)}{job.salaryMin ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ month</span> : null}</p>{showMatch && <p className="text-[11px] leading-5 text-muted-foreground">{match.matched.length} of {match.total} listed skills match: {match.matched.join(', ') || 'no exact matches yet'}.</p>}</CardContent><CardFooter className="justify-between bg-white py-3"><span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock3 className="size-3" />{isJobOpen(job) ? timeAgo(job.postedAt) : 'Applications closed'}</span><Link href={`/jobs/${job.id}`} className="flex min-h-9 items-center gap-1 text-[11px] font-medium text-primary">View job<ArrowUpRight className="size-3.5" /></Link></CardFooter></Card>
}
