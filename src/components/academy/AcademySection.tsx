import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { useSectionReveal } from '@/hooks/useSectionReveal';
import type { AcademyLanguage, LocalizedText } from '@/types/academy';

interface AcademySectionProps {
  id?: string;
  title: LocalizedText;
  subtitle?: LocalizedText;
  language: AcademyLanguage;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  /** Skip fade/slide wrapper (needed for GSAP ScrollTrigger pin) */
  staticChildren?: boolean;
}

const AcademySection = ({
  id,
  title,
  subtitle,
  language,
  children,
  className,
  dark = false,
  staticChildren = false,
}: AcademySectionProps) => {
  const { ref, visible } = useSectionReveal();

  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        'py-20 md:py-28 lg:py-32 relative overflow-hidden',
        dark && 'bg-gradient-dark',
        className
      )}
    >
      {dark && (
        <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header
          className={cn(
            'text-center mb-12 md:mb-16 space-y-4 transform transition-all duration-700',
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          )}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-primary uppercase tracking-wide">
            {pickLocalized(title, language)}
          </h2>
          {subtitle && (
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {pickLocalized(subtitle, language)}
            </p>
          )}
        </header>
        {staticChildren ? (
          children
        ) : (
          <div
            className={cn(
              'transition-all duration-700 delay-150',
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            )}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

export default AcademySection;
