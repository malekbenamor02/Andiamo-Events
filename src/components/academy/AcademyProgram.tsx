import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AcademySection from '@/components/academy/AcademySection';
import AcademyChaptersGrid from '@/components/academy/AcademyChaptersGrid';
import { ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { useSectionReveal } from '@/hooks/useSectionReveal';
import { cn } from '@/lib/utils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyProgramProps {
  language: AcademyLanguage;
  onCtaClick: () => void;
}

const AcademyProgram = ({ language, onCtaClick }: AcademyProgramProps) => {
  const { program, hero, assets } = ACADEMY_UI;
  const { ref: instructorRef, visible: instructorVisible } = useSectionReveal(0.2);

  return (
    <AcademySection title={program.title} language={language} dark staticChildren>
      <AcademyChaptersGrid language={language} />

      <Card
        ref={instructorRef}
        className={cn(
          'glass border-primary/20 max-w-2xl mx-auto transition-all duration-700 ease-out',
          instructorVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}
      >
        <CardContent className="p-8 md:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-primary/30 overflow-hidden shrink-0 shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
            <img
              src={assets.instructorPhoto}
              alt={hero.instructorName}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm uppercase tracking-wide text-primary font-medium">
              {pickLocalized(program.instructorTitle, language)}
            </p>
            <p className="text-2xl font-heading font-bold text-foreground">{hero.instructorName}</p>
            <p className="text-muted-foreground">{pickLocalized(hero.instructorRole, language)}</p>
            <p className="text-xs text-muted-foreground/80">{pickLocalized(hero.instructorNote, language)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 md:mt-16 flex justify-center px-4">
        <Button
          className="btn-gradient text-base px-8 py-6 w-full sm:w-auto"
          onClick={onCtaClick}
        >
          {pickLocalized(hero.cta, language)}
        </Button>
      </div>
    </AcademySection>
  );
};

export default AcademyProgram;
