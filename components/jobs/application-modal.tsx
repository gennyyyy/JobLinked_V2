'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowRight, FileText, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { useDemo } from '@/hooks/use-demo'
import { useAction } from '@/hooks/use-action'
import { TextField, SelectField, Notice, LinkButton, SuccessMark } from '@/components/shared'
import type { JobPosting } from '@/types'

const schema = z.object({ resumeId: z.string().min(1, 'Choose a resume to include.'), coverLetter: z.string().max(3000, 'Keep your cover letter within 3,000 characters.'), acknowledged: z.boolean().refine(v => v, 'Confirm you understand this is a demo submission.') })
export function ApplicationModal({ job, open, onOpenChange }: { job: JobPosting; open: boolean; onOpenChange: (value: boolean) => void }) {
  const { seeker, api } = useDemo()
  const { run, pending } = useAction()
  const [applicationId, setApplicationId] = useState('')
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { resumeId: seeker?.resumes[0]?.id ?? '', coverLetter: '', acknowledged: false } })
  const errors = form.formState.errors
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">{applicationId ? <div className="flex flex-col items-center gap-5 py-5 text-center"><SuccessMark /><DialogHeader><DialogTitle>One step closer to your next chapter.</DialogTitle><DialogDescription>Your sample application is now in My Applications. No real application or document was transmitted.</DialogDescription></DialogHeader><LinkButton href={`/jobseeker/applications/${applicationId}`}>Track my application<ArrowRight className="size-4" /></LinkButton><Button variant="ghost" onClick={() => onOpenChange(false)}>Continue exploring</Button></div> : <><DialogHeader><DialogTitle>Make your next move.</DialogTitle><DialogDescription>Apply for {job.title}. Your sample profile is included automatically.</DialogDescription></DialogHeader><form onSubmit={form.handleSubmit(async values => { const result = await run(() => api.apply(job.id, values.resumeId, values.coverLetter)); if (result) setApplicationId(result) })} className="flex flex-col gap-6"><FieldGroup><SelectField label="Select your resume" {...form.register('resumeId')} options={(seeker?.resumes ?? []).map(r => ({ value: r.id, label: r.name }))} placeholder="Choose a sample resume" error={errors.resumeId?.message} />{!seeker?.resumes.length && <Link href="/jobseeker/resumes" className="text-link text-xs">Add a resume first<ArrowRight className="size-3" /></Link>}<TextField label="Cover letter (optional)" multiline rows={5} {...form.register('coverLetter')} maxLength={3000} placeholder="Share why this opportunity feels right for you. Use fictional content only." error={errors.coverLetter?.message} /><Controller control={form.control} name="acknowledged" render={({ field }) => <Field data-invalid={!!errors.acknowledged}><div className="flex items-start gap-3"><Checkbox id="application-acknowledged" checked={field.value} onCheckedChange={field.onChange} aria-invalid={!!errors.acknowledged} /><FieldLabel htmlFor="application-acknowledged" className="text-xs leading-6">I understand this creates a sample application only, and I have read the <Link href="/privacy" target="_blank" className="text-primary underline">Privacy Notice</Link>.</FieldLabel></div><FieldError>{errors.acknowledged?.message}</FieldError></Field>} /></FieldGroup><Notice title="Your documents stay with you">Only temporary file metadata is used. No resume contents are uploaded or shared.</Notice><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Not right now</Button><Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileText data-icon="inline-start" />}Submit demo application</Button></DialogFooter></form></>}</DialogContent></Dialog>
}
