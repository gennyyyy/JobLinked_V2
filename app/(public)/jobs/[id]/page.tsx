import { JobDetails } from '@/components/jobs/job-details'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Local Opportunity' }
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <JobDetails id={id} /> }
