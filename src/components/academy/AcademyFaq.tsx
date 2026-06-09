import AcademySection from '@/components/academy/AcademySection';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ACADEMY_FAQ, ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyFaqProps {
  language: AcademyLanguage;
}

const AcademyFaq = ({ language }: AcademyFaqProps) => {
  return (
    <AcademySection id="faq" title={ACADEMY_UI.faq.title} language={language}>
      <Accordion type="single" collapsible className="max-w-3xl mx-auto w-full">
        {ACADEMY_FAQ.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="text-left font-heading text-foreground hover:text-primary">
              {pickLocalized(item.question, language)}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {pickLocalized(item.answer, language)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </AcademySection>
  );
};

export default AcademyFaq;
