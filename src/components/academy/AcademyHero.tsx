import { Calendar, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import type { AcademyLanguage } from '@/types/academy';

const META_ICONS = [Calendar, Clock, Users] as const;

const LOGO_SIZE_CLASS =
  'w-[min(100%,18rem)] sm:w-[min(100%,24rem)] md:w-[min(100%,20rem)] lg:w-[min(100%,22rem)] h-auto object-contain';

interface AcademyHeroProps {
  language: AcademyLanguage;
  onCtaClick: () => void;
}

const AcademyHero = ({ language, onCtaClick }: AcademyHeroProps) => {
  const { hero, assets } = ACADEMY_UI;
  return (
    <section className="relative min-h-[32rem] sm:min-h-[36rem] md:min-h-0 pt-4 sm:pt-6 md:pt-8 pb-20 md:pb-28 lg:pb-32 overflow-hidden bg-background">
      <img
        src={assets.heroBackground}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[78%_38%] sm:object-[72%_40%] md:object-center pointer-events-none select-none"
        aria-hidden
        fetchPriority="high"
        decoding="async"
      />
      {/* Lighter scrim on small screens so the photo stays visible behind centered copy */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/45 sm:from-black/45 sm:via-black/25 sm:to-black/55 dark:from-black/50 dark:via-black/30 dark:to-black/60 md:dark:from-background/50 md:dark:via-background/35 md:to-black/70 pointer-events-none"
        aria-hidden
      />
      <div className="absolute inset-0 hidden dark:md:block opacity-30 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-0 w-[28rem] h-[28rem] bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[24rem] h-[24rem] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
          <div>
            <div className="w-full flex justify-center px-2 sm:px-0 mb-14 sm:mb-16 md:mb-20 lg:mb-24">
              <img
                src={assets.logoDark}
                alt={pickLocalized(hero.academyBrand, language)}
                className={`${LOGO_SIZE_CLASS} drop-shadow-[0_4px_32px_rgba(0,0,0,0.45)] dark:drop-shadow-[0_8px_40px_hsl(var(--primary)/0.25)]`}
                width={512}
                height={128}
                fetchPriority="high"
              />
            </div>

            <div className="space-y-4 sm:space-y-5">
            <h1 className="font-heading font-bold leading-[1.1] tracking-tight">
              <span className="block text-[1.65rem] sm:text-4xl md:text-[2.75rem] lg:text-5xl text-white dark:text-foreground">
                {pickLocalized(hero.titleLine1, language)}
              </span>
              <span className="block mt-2 sm:mt-3 text-[1.5rem] sm:text-3xl md:text-[2.5rem] lg:text-[2.75rem] text-primary">
                {pickLocalized(hero.titleLine2, language)}
              </span>
            </h1>

            <ul className="flex flex-wrap justify-center gap-2 sm:gap-3 list-none p-0 m-0">
              {hero.meta.map((item, index) => {
                const Icon = META_ICONS[index] ?? Calendar;
                return (
                  <li key={item.label.en}>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-white dark:border-border/60 dark:bg-card/50 dark:text-foreground">
                      <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
                      {pickLocalized(item.label, language)}
                    </span>
                  </li>
                );
              })}
            </ul>
            </div>
          </div>

          <Button className="btn-gradient text-base px-8 py-6 w-full sm:w-auto" onClick={onCtaClick}>
            {pickLocalized(hero.cta, language)}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default AcademyHero;
