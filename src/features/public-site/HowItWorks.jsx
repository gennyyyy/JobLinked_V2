import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import PublicShell from '@/shared/components/PublicShell'

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
    <PublicShell>
      <div className="page-container py-14 md:py-20">
        <div className="mx-auto max-w-[940px]">
          {/* Header */}
          <header className="mb-10">
            <p className="eyebrow mb-3">LESS PAPERWORK. MORE POSSIBILITY.</p>
            <h1 className="section-heading text-navy">How JobLinked works</h1>
            <p className="section-copy mt-3 text-muted-foreground">
              A clear path from your first profile to your next opportunity.
            </p>
          </header>

          {/* Role Pill Switcher */}
          <div className="mb-8 inline-flex items-center rounded-xl border border-primary/20 bg-blue-50/60 p-1.5 shadow-xs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={isActive}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-navy hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Subheading */}
          <h2 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">
            {current.heading}
          </h2>

          {/* Step Cards Grid */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5">
            {current.steps.map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-4 rounded-2xl border border-border/80 bg-card p-6 shadow-xs transition-shadow hover:shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-primary">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-navy sm:text-base">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <div className="mt-8">
            <Link
              to={current.cta.to}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {current.cta.label}
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Demonstration Notice Card */}
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-blue-100 bg-[#f0f6ff] p-5 text-navy sm:p-6">
            <ShieldCheck className="size-5 shrink-0 text-primary mt-0.5" />
            <div className="text-xs leading-relaxed sm:text-[13px]">
              <p className="font-semibold text-navy">A demonstration of the journey</p>
              <p className="mt-1 text-muted-foreground">
                Role guards and sample credentials only preview the experience. Production authorization must be enforced by the future Express API, with secure sessions and private document storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
