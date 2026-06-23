import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AcademySection from '@/components/academy/AcademySection';
import { ACADEMY_PROGRAM, ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { cn } from '@/lib/utils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyProgramProps {
  language: AcademyLanguage;
  onCtaClick: () => void;
}

const PROFILE_FIELDS = [
  'experience',
  'specialties',
  'approach',
] as const;

const AcademyProgram = ({ language, onCtaClick }: AcademyProgramProps) => {
  const { hero, assets } = ACADEMY_UI;
  const { curriculumTitle, modules, trainer } = ACADEMY_PROGRAM;

  return (
    <AcademySection
      id="programme"
      title={ACADEMY_PROGRAM.title}
      language={language}
    >
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 max-w-6xl mx-auto">
        <div>
          <h3 className="text-sm uppercase tracking-wide text-primary font-medium mb-6">
            {pickLocalized(curriculumTitle, language)}
          </h3>
          <ol className="space-y-0 list-none p-0 m-0">
            {modules.map((module, index) => (
              <li
                key={module.id}
                className={cn(
                  'flex items-baseline gap-4 py-4 border-b border-border/40',
                  'animate-chapter-card-enter opacity-0',
                  index === modules.length - 1 && 'border-b-0'
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span
                  className="text-sm font-medium tabular-nums text-primary shrink-0 w-7"
                  aria-hidden
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-heading font-semibold text-foreground text-base md:text-lg leading-snug">
                  {pickLocalized(module.title, language)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3 className="text-sm uppercase tracking-wide text-primary font-medium mb-6">
            {pickLocalized(trainer.sectionTitle, language)}
          </h3>
          <Card className="glass border-primary/20 h-full">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 mb-8 pb-8 border-b border-border/40">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-primary/30 overflow-hidden shrink-0 mx-auto sm:mx-0 shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
                  <img
                    src={assets.trainerPhoto}
                    alt={hero.instructorName}
                    className="w-full h-full object-cover object-[center_30%]"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="text-center sm:text-left min-w-0 flex-1 space-y-2 sm:py-1">
                  <p className="text-2xl font-heading font-bold text-foreground leading-tight">
                    {hero.instructorName}
                  </p>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-md sm:max-w-none">
                    {pickLocalized(trainer.jobTitle, language)}
                  </p>
                </div>
              </div>

              <dl className="space-y-5">
                {PROFILE_FIELDS.map((field) => (
                  <div key={field}>
                    <dt className="text-xs uppercase tracking-wide text-primary font-medium mb-1.5">
                      {pickLocalized(trainer[`${field}Label`], language)}
                    </dt>
                    <dd className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {pickLocalized(trainer[field], language)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

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
