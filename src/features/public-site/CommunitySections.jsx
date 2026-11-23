'use client';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { H3, LinkButton, RevealText } from '../../shared/components/design';
import { FAQS, PESO_SERVICES } from '../../shared/constants';
import { MATCHING_NAME, MATCHING_NOTICE } from '../../shared/content/matching';
import CommunityStats from './CommunityStats';
import { AudienceCards } from './AudienceCards';

const PILLARS = [
  {
    title: MATCHING_NAME,
    description: MATCHING_NOTICE,
    href: '/jobs',
    linkLabel: 'See matched jobs',
  },
  {
    title: 'PESO-accredited employers',
    description: 'Employers submit their requirements for PESO review. PESO approves, rejects, or asks for resubmission, and only accredited employers can publish — so every listing you see has passed that review.',
    href: '/how-it-works',
    linkLabel: 'How accreditation works',
  },
  {
    title: 'Application & employment tracking',
    description: 'Follow each application from Applied to Under Review, Interview, and Accepted or Rejected. A hire is recorded as Placed, and employment history — including Terminated — stays tracked in your portal.',
    href: '/how-it-works',
    linkLabel: 'How tracking works',
  },
]

export function CommunitySections() {
  return (
    <>
      <section id="how-it-works" className="page-container py-20 parallax-reveal">
        <div className="max-w-xl">
          <RevealText as="h2" className="section-heading" tier="display">How JobLinked works</RevealText>
          <RevealText as="p" className="section-copy mt-3">Less searching, more possibility. We make finding local work a little easier.</RevealText>
        </div>
        <ul className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
          {PILLARS.map(({ title, description, href, linkLabel }) => (
            <li className="border-t border-border pt-6" key={title}>
              <H3 className="text-base font-semibold">{title}</H3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
              <Link to={href} className="text-link mt-3">
                {linkLabel}<ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
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
            <RevealText as="h2" className="section-heading" tier="display">PESO Services</RevealText>
            <RevealText as="p" className="section-copy mt-4 max-w-md">Explore employment programs, career guidance, and skills development information designed with your future in mind.</RevealText>
            <Link to="/peso-services" className="text-link mt-5">
              Explore PESO services<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Program information only. Confirm actual availability with official channels.</p>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {PESO_SERVICES.map(({ title, description }) => (
              <li className="border-t border-border py-5" key={title}>
                <H3 className="text-sm font-semibold">{title}</H3>
                <RevealText as="p" className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</RevealText>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="about" className="border-y border-border bg-muted/60">
        <div className="page-container py-16 md:py-20">
          <div className="max-w-xl">
            <RevealText as="h2" className="section-heading" tier="display">About JobLinked</RevealText>
          </div>
          <AudienceCards />
        </div>
      </section>

      <section id="faq" className="page-container py-16 md:py-20">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-7">
            <RevealText as="h2" className="section-heading" tier="display">Frequently Asked Questions</RevealText>
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
