import { JobBrowser } from '@/components/jobs/job-browser'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Find Local Jobs' }
export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const params = await searchParams; const initial = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])); return <JobBrowser key={JSON.stringify(initial)} initial={initial} /> }
