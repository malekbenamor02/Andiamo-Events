import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { useSectionReveal } from '@/hooks/useSectionReveal';
import { cn } from '@/lib/utils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyTrainerProps {
  language: AcademyLanguage;
  onCtaClick: () => void;
}

const AcademyTrainer = ({ language, onCtaClick }: AcademyTrainerProps) => {
  const { hero, assets, trainer } = ACADEMY_UI;
  const { ref: instructorRef, visible: instructorVisible } = useSectionReveal(0.2);

  return (
    <div className="mt-12 md:mt-16 lg:mt-20">
      <Card
        ref={instructorRef}
        className={cn(
          'glass border-primary/20 max-w-2xl mx-auto transition-all duration-700 ease-out',
          instructorVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}
      >
        <CardContent className="p-8 md:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2 border-primary/30 overflow-hidden shrink-0 shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
            <img
              src={assets.trainerPhoto}
              alt={hero.instructorName}
              className="w-full h-full object-cover object-[center_30%]"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm uppercase tracking-wide text-primary font-medium">
              {pickLocalized(trainer.instructorTitle, language)}
            </p>
            <p className="text-2xl font-heading font-bold text-foreground">{hero.instructorName}</p>
            <p className="text-muted-foreground">{pickLocalized(hero.instructorRole, language)}</p>
            <p className="text-xs text-muted-foreground/80">{pickLocalized(hero.instructorNote, language)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-10 md:mt-12 flex justify-center px-4">
        <Button
          className="btn-gradient text-base px-8 py-6 w-full sm:w-auto"
          onClick={onCtaClick}
        >
          {pickLocalized(hero.cta, language)}
        </Button>
      </div>
    </div>
  );
};

export default AcademyTrainer;
