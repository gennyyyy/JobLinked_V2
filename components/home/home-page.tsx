'use client'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { isJobOpen } from '@/lib/format'
import { CompanyMark } from '@/components/shared'
import { JobCard } from '@/components/jobs/job-card'
import { HomeHero } from './home-hero'
import { CommunitySections } from './community-sections'

export function HomePage() {
  const { state } = useDemo()
  const jobs = state.jobs.filter(j => isJobOpen(j) && state.employers.find(e => e.id === j.employerId)?.accreditationStatus === 'Approved')
  const companies = state.employers.filter(e => e.accreditationStatus === 'Approved')
  return <><HomeHero /><section className="page-container py-16"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow mb-2.5">A place for your potential</p><h2 className="section-heading">Good work. Right here.</h2><p className="mt-3 text-[13px] text-muted-foreground">Explore opportunities from businesses in your community.</p></div><Link href="/jobs" className="text-link">View all opportunities<ArrowRight className="size-4" /></Link></div><div className="job-grid">{jobs.slice(0, 6).map(job => <JobCard key={job.id} job={job} />)}</div><p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="size-1 rounded-full bg-teal" />All listings, salaries, and verification statuses are sample data.</p></section><section className="border-y bg-muted/60"><div className="page-container py-14"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="eyebrow mb-2">Rooted in our community</p><h2 className="text-2xl font-semibold tracking-tight">Meet your next workplace.</h2></div><Link className="text-link" href="/jobs">Discover local employers<ArrowRight className="size-4" /></Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{companies.map(c => <Link href={`/jobs?company=${encodeURIComponent(c.id)}`} className="surface flex items-center gap-3.5 transition-colors hover:border-primary/40" key={c.id}><CompanyMark initials={c.initials} color={c.color} /><div><h3 className="text-[11px] font-semibold leading-5">{c.name}</h3><p className="mt-1 text-[9px] text-muted-foreground">{c.industry} · {jobs.filter(j => j.employerId === c.id).length} open roles</p></div></Link>)}</div></div></section><CommunitySections /></>
}
