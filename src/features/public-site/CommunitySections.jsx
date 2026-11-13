'use client';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { LinkButton } from '../../shared/components/design';
import { FAQS, PESO_SERVICES } from '../../shared/constants';
import CommunityStats from './CommunityStats';
import { AudienceCards } from './AudienceCards';

const STEPS = [
  {
    title: 'Create your profile',
    description: 'Tell your story. Add your skills, experience, and resume so the right opportunities can find you.',
  },
  {
    title: 'Explore opportunities',
    description: 'Discover verified local vacancies that fit your skills, goals, and life close to home.',
  },
  {
    title: 'Apply and stay in the loop',
    description: 'Send your application and follow every update. Know where you stand, every step of the way.',
  },
]

export function CommunitySections() {
  return (
    <>
      <section id="how-it-works" className="page-container py-20 parallax-reveal">
        <div className="max-w-xl">
          <p className="eyebrow text-primary mb-3">Simple steps. Meaningful possibilities.</p>
          <h2 className="section-heading">Your next chapter starts here.</h2>
          <p className="section-copy mt-3">Less searching, more possibility. We make finding local work a little easier.</p>
        </div>
        <ol className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
          {STEPS.map(({ title, description }, index) => (
            <li className="border-t border-border pt-6" key={title}>
              <p className="text-xs font-semibold tracking-[0.16em] text-primary tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-3 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <LinkButton href="/signup" variant="outline">
            Let&apos;s get started<ArrowRight aria-hidden="true" className="size-4" />
          </LinkButton>
        </div>
      </section>

      <CommunityStats />

      <section id="peso-services" className="page-container py-16 md:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow text-primary mb-3">Support beyond the job search</p>
            <h2 className="section-heading">You don&apos;t have to take the next step alone.</h2>
            <p className="section-copy mt-4 max-w-md">Explore employment programs, career guidance, and skills development information designed with your future in mind.</p>
            <Link to="/peso-services" className="text-link mt-5">
              Explore PESO services<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Program information only. Confirm actual availability with official channels.</p>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {PESO_SERVICES.map(({ title, description }) => (
              <li className="border-t border-border py-5" key={title}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="about" className="border-y border-border bg-muted/60">
        <div className="page-container py-16 md:py-20">
          <div className="max-w-xl">
            <p className="eyebrow text-primary mb-3">One platform. A stronger community.</p>
            <h2 className="section-heading">Built around people, not paperwork.</h2>
          </div>
          <AudienceCards />
        </div>
      </section>

      <section id="faq" className="page-container py-16 md:py-20">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-7">
            <p className="eyebrow text-primary mb-3">A little clarity goes a long way</p>
            <h2 className="section-heading">Good questions. Clear answers.</h2>
          </div>
          <Accordion>
            {FAQS.slice(0, 4).map((faq, index) => (
              <AccordionItem value={`faq-${index}`} key={faq.question} className="border-b border-border last:border-b-0">
                <AccordionTrigger className="min-h-16 py-4 text-base font-medium text-navy">{faq.question}</AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6">
            <Link to="/faq" className="text-link text-sm">
              Explore all FAQs<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
