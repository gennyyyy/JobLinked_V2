import { notFound } from 'next/navigation'
import { RegistrationForm } from '@/components/forms/registration-form'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Create a Sample Profile' }
export default async function Registration({ params }: { params: Promise<{ role: string }> }) { const { role } = await params; if (role !== 'jobseeker' && role !== 'employer') notFound(); return <RegistrationForm role={role} /> }
