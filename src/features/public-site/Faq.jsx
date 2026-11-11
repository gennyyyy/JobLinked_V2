import PublicShell from '@/shared/components/PublicShell'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { FAQS } from '../../shared/constants'

export default function Faq() {
  return (
    <PublicShell>
      <div className="page-container py-16">
        <div className="mx-auto max-w-[720px]">
          <p className="eyebrow mb-3">A little clarity goes a long way</p>
          <h1 className="section-heading">Frequently asked questions</h1>
          <p className="section-copy mt-3">Everything job seekers and employers ask us most, in one place.</p>
          <Accordion className="mt-8">
            {FAQS.map((faq, i) => (
              <AccordionItem value={`faq-${i}`} key={faq.question} className="border-b">
                <AccordionTrigger className="min-h-16 text-sm font-medium text-navy">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-xs leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </PublicShell>
  )
}
