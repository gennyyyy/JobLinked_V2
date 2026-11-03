'use client'

import { useState } from 'react'
import { PRIVACY_NOTICE } from '@/lib/privacy-notice'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ArrowLeft, Check, ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { registrationSchema, REGISTRATION_DEFAULTS, type RegistrationValues } from '@/lib/registration-schema'
import { RegistrationSteps } from './registration-steps'
import { RegistrationReview } from './registration-review'
import { useDemo } from '@/hooks/use-demo'
import { cn } from '@/lib/utils'
import type { FileMetadata } from '@/types'

export function RegistrationForm({ role }: { role: 'jobseeker' | 'employer' }) {
  const isEmployer = role === 'employer'
  const { state, api } = useDemo()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [documents, setDocuments] = useState<FileMetadata[]>([])
  const [resume, setResume] = useState<FileMetadata>()
  const [documentError, setDocumentError] = useState('')
  const [notice, setNotice] = useState<'privacy' | 'terms' | null>(null)
  const [pending, setPending] = useState(false)
  const [privacyRead, setPrivacyRead] = useState(false)
  const [noticeEndReached, setNoticeEndReached] = useState(false)
  const form = useForm<RegistrationValues>({ resolver: zodResolver(registrationSchema(isEmployer)), mode: 'onTouched', defaultValues: REGISTRATION_DEFAULTS })
  const steps = isEmployer ? ['Company details', 'Representative & contact', 'Business location', 'Accreditation documents', 'Demo credentials', 'Review & consent'] : ['Personal information', 'Contact details', 'Your community', 'Education & skills', 'Demo credentials', 'Review & consent']
  const stepFields: (keyof RegistrationValues)[][] = [isEmployer ? ['companyName', 'industry', 'description'] : ['name'], isEmployer ? ['name', 'email', 'phone'] : ['email', 'phone'], ['barangay', 'address'], isEmployer ? [] : ['education', 'experience', 'skills'], ['password', 'confirm'], ['privacyAcknowledged', 'termsAccepted', ...(isEmployer ? ['representativeDeclared', 'processingConsent'] as const : [])]]
  async function nextStep() { const valid = await form.trigger(stepFields[step], { shouldFocus: true }); if (!valid) return; if (step === 3 && isEmployer && state.preferences.requirements.some(category => !documents.some(d => d.category === category))) { setDocumentError('Choose a valid sample file for every required category.'); return } setDocumentError(''); setStep(value => Math.min(value + 1, 5)) }
  async function submit(values: RegistrationValues) {
    if (!privacyRead) { toast.error('Read the complete Privacy Notice before registering.'); setNotice('privacy'); return }
    setPending(true)
    try { const result = await api.register({ role, name: values.name, email: values.email, phone: values.phone, barangay: values.barangay, address: values.address, education: values.education, experience: values.experience, skills: values.skills.split(',').map(s => s.trim()).filter(Boolean), companyName: values.companyName, industry: values.industry, description: values.description, documents, resume, privacyAcknowledged: values.privacyAcknowledged, termsAccepted: values.termsAccepted, representativeDeclared: values.representativeDeclared, processingConsent: values.processingConsent }); form.reset(); toast.success(isEmployer ? 'Sample business registered. Accreditation is Pending Review.' : 'Your sample profile is ready to grow.'); router.push(`/${result.user.role}/dashboard`) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Registration could not be previewed.') }
    finally { setPending(false) }
  }
  return <div className="bg-muted/60"><div className="page-container py-10"><div className="mb-7"><Link className="text-link text-xs" href="/signup"><ArrowLeft className="size-3.5" />Choose a different journey</Link><h1 className="mt-4 text-3xl font-semibold tracking-[-.04em]">{isEmployer ? 'Great teams start with local talent.' : 'Your next chapter starts with you.'}</h1><p className="mt-3 text-sm text-muted-foreground">{isEmployer ? 'Create a fictional employer profile and preview the accreditation process.' : 'Build your sample profile and discover opportunities close to home.'}</p></div><div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]"><aside className="surface hidden lg:block"><p className="mb-6 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Your registration journey</p><ol className="flex flex-col gap-5">{steps.map((title, i) => <li key={title} className="flex items-center gap-3"><span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-xs', i <= step ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>{i < step ? <Check className="size-4" /> : i + 1}</span><span className={cn('text-xs', i === step ? 'font-semibold text-navy' : 'text-muted-foreground')}>{title}</span></li>)}</ol><div className="mt-8 border-t pt-5 text-[10px] leading-6 text-muted-foreground"><ShieldCheck className="mb-2 size-5 text-teal" />Fictional information only. No passwords or file contents are stored. New profiles disappear on refresh.</div></aside><section className="surface max-w-3xl p-6 sm:p-8"><div className="mb-7"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-medium text-primary">Step {step + 1} of {steps.length}</p><span className="demo-label">Frontend demo</span></div><Progress value={(step + 1) / steps.length * 100} aria-label="Registration progress" /><h2 className="mt-6 text-xl font-semibold">{steps[step]}</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{step === 5 ? 'Take a moment to review your sample information and read the full notices.' : 'Use fictional details. Fields shown are required unless marked optional.'}</p></div><form onKeyDown={e => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault() }} onSubmit={e => { if (step < 5) { e.preventDefault(); void nextStep(); return } void form.handleSubmit(submit, invalid => { const invalidStep = stepFields.findIndex(fields => fields.some(field => invalid[field])); if (invalidStep >= 0) setStep(invalidStep) })(e) }}><FieldGroup>{step < 5 ? <RegistrationSteps form={form} step={step} isEmployer={isEmployer} requirements={state.preferences.requirements} documents={documents} onDocument={file => { setDocuments(previous => [...previous.filter(d => d.category !== file.category), file]); setDocumentError('') }} resume={resume} onResume={setResume} documentError={documentError} /> : <RegistrationReview form={form} isEmployer={isEmployer} documents={documents} resume={resume} privacyRead={privacyRead} onNotice={value => { setNoticeEndReached(false); setNotice(value) }} />}</FieldGroup><div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6"><Button type="button" variant="outline" disabled={step === 0 || pending} onClick={() => setStep(s => s - 1)}><ArrowLeft data-icon="inline-start" />Back</Button>{step < 5 ? <Button type="button" onClick={nextStep}>Continue<ArrowRight data-icon="inline-end" /></Button> : <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" data-icon="inline-start" />}{isEmployer ? 'Submit demo accreditation' : 'Create my sample profile'}<ArrowRight data-icon="inline-end" /></Button>}</div></form></section></div></div><Dialog open={notice !== null} onOpenChange={value => { if (!value) setNotice(null) }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{notice === 'privacy' ? 'Complete Privacy Notice' : 'Draft demo Terms'}</DialogTitle><DialogDescription>Reviewable and configurable draft. No claim of guaranteed legal compliance.</DialogDescription></DialogHeader><article key={notice} tabIndex={0} aria-label="Notice text — scroll to the end to continue" onScroll={event => { const el = event.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setNoticeEndReached(true) }} className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-md border p-4 text-xs leading-7 text-muted-foreground">{notice === 'privacy' ? PRIVACY_NOTICE : state.preferences.termsText}</article>{notice === 'privacy' ? <><p role="status" className="text-xs text-muted-foreground">{noticeEndReached ? 'You have reached the end. Confirm below to unlock the acknowledgment checkbox.' : 'Please read and scroll to the end of the notice to continue.'}</p><Button type="button" disabled={!noticeEndReached} onClick={() => { setPrivacyRead(true); setNotice(null) }}>I have read the notice</Button></> : <Button type="button" onClick={() => setNotice(null)}>Back to registration</Button>}</DialogContent></Dialog></div>
}
