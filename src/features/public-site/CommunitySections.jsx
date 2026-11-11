'use client';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  Building2,
  LayoutDashboard,
  UserRoundPlus,
  FileCheck2,
  Search,
  Check,
  Handshake,
  CalendarDays,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { LinkButton } from '../../shared/components/design';
import { FAQS } from '../../shared/constants';
import CommunityStats from './CommunityStats';

const STEPS = [
  {
    icon: UserRoundPlus,
    title: 'Create your profile',
    description: 'Tell your story. Add your skills, experience, and resume so the right opportunities can find you.',
  },
  {
    icon: Search,
    title: 'Explore opportunities',
    description: 'Discover verified local vacancies that fit your skills, goals, and life close to home.',
  },
  {
    icon: FileCheck2,
    title: 'Apply and stay in the loop',
    description: 'Send your application and follow every update. Know where you stand, every step of the way.',
  },
]

const AUDIENCES = [
  {
    icon: Users,
    title: 'For job seekers',
    description: 'Your skills deserve the right opportunity.',
    items: ['Local jobs, verified employers', 'One profile, organized applications', 'Clear updates at every stage'],
    linkLabel: 'Find your opportunity',
    href: '/signup/jobseeker',
  },
  {
    icon: Building2,
    title: 'For local employers',
    description: 'Great teams start with local talent.',
    items: ['Reach candidates in your community', 'Simplified accreditation workflow', 'Manage recruitment in one place'],
    linkLabel: 'Build your team',
    href: '/signup/employer',
  },
  {
    icon: LayoutDashboard,
    title: 'For PESO personnel',
    description: 'More connections. Better coordination.',
    items: ['Centralized employer accreditation', 'Vacancy and placement monitoring', 'Community-focused reporting'],
    linkLabel: 'Explore the PESO portal',
    href: '/super-admin',
  },
]

const PESO_SERVICES = [
  { icon: Handshake, title: 'Job matching & placement', description: 'Connect with opportunities that fit.' },
  { icon: CalendarDays, title: 'Community job fairs', description: 'Meet employers. Open new doors.' },
  { icon: GraduationCap, title: 'Career guidance', description: 'Navigate your future with support.' },
  { icon: Sparkles, title: 'Skills & livelihood training', description: 'Learn more. Grow your possibilities.' },
]

export function CommunitySections() {
  return (
    <>
      <section id="how-it-works" className="page-container py-20 parallax-reveal">
        <div className="text-center">
          <p className="eyebrow mb-3">Simple steps. Meaningful possibilities.</p>
          <h2 className="section-heading">Your next chapter starts here.</h2>
          <p className="section-copy mx-auto mt-3 max-w-lg">Less searching, more possibility. We make finding local work a little easier.</p>
        </div>
        <div className="relative mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <div className="relative text-center" key={title}>
              <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-primary/10 bg-blue-soft text-primary">
                <Icon className="size-7" strokeWidth={1.5} />
                <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border-4 border-white bg-primary text-[9px] text-white">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-6 text-base font-semibold">{title}</h3>
              <p className="mx-auto mt-3 max-w-[290px] text-xs leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 text-center">
          <LinkButton href="/signup" variant="outline">Let&apos;s get started<ArrowRight className="size-4" /></LinkButton>
        </div>
      </section>

      <section id="about" className="bg-[#f4f8fd]">
        <div className="page-container py-16">
          <div className="mb-8">
            <p className="eyebrow mb-3">One platform. A stronger community.</p>
            <h2 className="section-heading">Built around people, not paperwork.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, description, items, linkLabel, href }) => (
              <div className="surface flex flex-col" key={title}>
                <span className="teal-icon"><Icon className="size-5" /></span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{description}</p>
                <ul className="my-6 flex flex-col gap-3">
                  {items.map((item) => (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground" key={item}>
                      <Check className="size-3.5 shrink-0 text-teal" />{item}
                    </li>
                  ))}
                </ul>
                <Link className="text-link mt-auto text-xs" to={href}>{linkLabel}<ArrowRight className="size-3.5" /></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="peso-services" className="page-container py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="eyebrow mb-3">Support beyond the job search</p>
            <h2 className="section-heading">You don&apos;t have to<br />take the next step alone.</h2>
            <p className="section-copy mt-4 max-w-md">Explore employment programs, career guidance, and skills development information designed with your future in mind.</p>
            <Link to="/#peso-services" className="text-link mt-5">Explore PESO services<ArrowRight className="size-4" /></Link>
            <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Program information only. Confirm actual availability with official channels.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PESO_SERVICES.map(({ icon: Icon, title, description }) => (
              <Link to="/#peso-services" key={title} className="surface flex flex-col gap-3 transition-colors hover:border-primary/30">
                <Icon className="size-6 text-teal" strokeWidth={1.5} />
                <h3 className="text-xs font-semibold">{title}</h3>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CommunityStats />

      <section id="faq" className="page-container py-16">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-7 text-center">
            <p className="eyebrow mb-3">A little clarity goes a long way</p>
            <h2 className="section-heading">Good questions. Clear answers.</h2>
          </div>
          <Accordion>
            {FAQS.slice(0, 4).map((faq, index) => (
              <AccordionItem value={`faq-${index}`} key={faq.question} className="border-b">
                <AccordionTrigger className="min-h-16 text-sm font-medium text-navy">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-xs leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6 text-center">
            <Link to="/faq" className="text-link text-xs">Explore all FAQs<ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
      </section>
    </>
  )
}
