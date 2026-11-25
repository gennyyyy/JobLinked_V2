import SkipLink from '@/shared/components/SkipLink'
import PublicShell from '@/shared/components/PublicShell'
import PageHero from './PageHero'
import PesoOfficeInfo from '@/shared/components/PesoOfficeInfo'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { FAQS } from '../../shared/constants'

export default function Faq() {
  return (
    <>
      <SkipLink />
      <PublicShell>
        <PageHero
          title="Frequently asked questions"
          description="Everything job seekers and employers ask us most, in one place."
        />
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
                  <p>
                    <a
                      href="https://www.bing.com/maps/default.aspx?v=2&pc=FACEBK&mid=8100&where1=14.818470214142%2C+120.95965451912&FORM=FBKPL1&name=Poblacion%2C+Santa+Maria%2C+Philippines%2C+3022&mkt=en-GB"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      Poblacion, Santa Maria, Bulacan 3022
                    </a>
                  </p>
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
