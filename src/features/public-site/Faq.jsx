import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import PesoOfficeInfo from '@/shared/components/PesoOfficeInfo'
import landingBg from '@/assets/landing_page_bg.png'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { FAQS } from '../../shared/constants'

export default function Faq() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <header className="page-hero bg-cover bg-center border-b border-border" style={{ backgroundImage: `linear-gradient(180deg, rgba(247,250,255,0.88) 0%, rgba(247,250,255,0.72) 100%), url(${landingBg})` }}>
          <div className="page-container py-14 md:py-16">
            <div>
              <h1 className="display-heading text-navy">Frequently asked questions</h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">Everything job seekers and employers ask us most, in one place.</p>
            </div>
          </div>
        </header>
        <div className="page-container py-12 md:py-16">
          <div className="mx-auto max-w-[720px]">
            <Accordion className="border-t border-border">
              {FAQS.map((faq, i) => (
                <AccordionItem value={`faq-${i}`} key={faq.question} className="border-b border-border last:border-b-0">
                  <AccordionTrigger headerRender={<h2 />} className="min-h-16 py-4 text-base font-medium text-navy sm:text-lg">{faq.question}</AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
              <AccordionItem value="faq-contact" className="border-b border-border last:border-b-0">
                <AccordionTrigger headerRender={<h2 />} className="min-h-16 py-4 text-base font-medium text-navy sm:text-lg">Where is the PESO office and how can I reach them?</AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-7 text-muted-foreground">
                  <PesoOfficeInfo className="text-sm" />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </PublicShell>
    </>
  )
}
