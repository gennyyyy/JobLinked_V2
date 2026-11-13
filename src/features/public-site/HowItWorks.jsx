import { useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import { LinkButton } from '@/shared/components/design'

const TABS = [
  { id: 'jobseeker', label: 'For job seekers' },
  { id: 'employer', label: 'For employers' },
]

const CONTENT = {
  jobseeker: {
    heading: 'Make room for your next chapter.',
    cta: {
      label: 'Create a job seeker profile',
      to: '/register/job-seeker',
    },
    steps: [
      {
        step: '01',
        title: 'Create your profile',
        desc: 'Register with fictional information, add your barangay, education, skills, and a sample resume.',
      },
      {
        step: '02',
        title: 'Explore local opportunities',
        desc: 'Search by job title, barangay, employment type, salary, and experience. Save roles for later.',
      },
      {
        step: '03',
        title: 'Apply with confidence',
        desc: 'Choose your sample resume, add an optional cover letter, and submit a demo application.',
      },
      {
        step: '04',
        title: 'Stay in the loop',
        desc: "Track review, shortlisting, interviews, and the employer's final decision in My Applications.",
      },
    ],
  },
  employer: {
    heading: 'Your next great teammate is nearby.',
    cta: {
      label: 'Register a local business',
      to: '/register/employer',
    },
    steps: [
      {
        step: '01',
        title: 'Register your business',
        desc: 'Add fictional company details and your authorized representative.',
      },
      {
        step: '02',
        title: 'Submit accreditation requirements',
        desc: 'Choose sample files for the configured example requirements and acknowledge the declaration.',
      },
      {
        step: '03',
        title: 'Wait for PESO demo approval',
        desc: 'Your account starts at Pending Review. You may draft jobs, but cannot publish before approval.',
      },
      {
        step: '04',
        title: 'Post, review, and connect',
        desc: 'Publish a vacancy, review applications for your jobs only, add notes, and update recruitment statuses.',
      },
    ],
  },
}

export default function HowItWorks() {
  const [activeTab, setActiveTab] = useState('jobseeker')
  const current = CONTENT[activeTab]

  return (
    <>
      <SkipLink />
      <PublicShell>
        <header className="page-hero">
          <div className="page-container py-14 md:py-16">
            <div>
              <p className="eyebrow mb-4">Less paperwork. More possibility.</p>
              <h1 className="display-heading text-navy">How JobLinked works</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
                A clear path from your first profile to your next opportunity.
              </p>
            </div>
          </div>
        </header>
        <div className="page-container py-12 md:py-16">
          <div className="mx-auto max-w-[940px]">

            <div className="inline-flex rounded-md border border-border bg-card p-1" role="group" aria-label="Choose your path">              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isActive}
                    className={`min-h-11 rounded-sm px-4 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:text-navy'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <h2 className="mt-10 text-2xl font-semibold tracking-[-0.03em] text-navy sm:text-[28px]">
              {current.heading}
            </h2>

            <ol className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {current.steps.map((item) => (
                <li key={item.step} className="border-t border-border pt-5">
                  <p className="text-xs font-semibold tracking-[0.16em] text-primary tabular-nums">{item.step}</p>
                  <h3 className="mt-2 text-base font-semibold text-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10">
              <LinkButton href={current.cta.to}>
                {current.cta.label}
                <ArrowRight aria-hidden="true" className="size-4" />
              </LinkButton>
            </div>

            <aside className="mt-12 border-l-2 border-primary pl-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                A demonstration of the journey
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Role guards and sample credentials only preview the experience. Production authorization must be enforced by the future Express API, with secure sessions and private document storage.
              </p>
            </aside>
          </div>
        </div>
      </PublicShell>
    </>
  )
}
