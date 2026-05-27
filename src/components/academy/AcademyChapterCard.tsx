import { cn } from '@/lib/utils';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import type { AcademyChapter, AcademyLanguage } from '@/types/academy';

interface AcademyChapterCardProps {
  chapter: AcademyChapter;
  language: AcademyLanguage;
  revealed: boolean;
  delayMs: number;
  isLast?: boolean;
}

const AcademyChapterCard = ({
  chapter,
  language,
  revealed,
  delayMs,
  isLast = false,
}: AcademyChapterCardProps) => {
  const paddedNumber = String(chapter.number).padStart(2, '0');
  const chapterLabel = language === 'en' ? 'Chapter' : 'Chapitre';

  const { ref: scrollRef, visible: scrollVisible } = useScrollReveal<HTMLLIElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -6% 0px',
    repeat: true,
  });

  const showMobile = scrollVisible;
  const showDesktop = revealed;

  return (
    <li
      ref={scrollRef}
      className={cn(
        'relative flex gap-4 md:h-full',
        'max-md:transition-[opacity,transform] max-md:duration-500 max-md:ease-[cubic-bezier(0.22,1,0.36,1)]',
        showMobile
          ? 'max-md:opacity-100 max-md:translate-x-0 max-md:translate-y-0'
          : 'max-md:opacity-0 max-md:translate-x-4 max-md:translate-y-2',
        'md:opacity-0 md:translate-y-6',
        showDesktop && 'md:opacity-100 md:translate-y-0 md:transition-all md:duration-700 md:ease-out'
      )}
      style={{
        transitionDelay: showDesktop ? `${delayMs}ms` : undefined,
      }}
    >
      <div className="flex flex-col items-center shrink-0 md:hidden" aria-hidden>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 text-primary font-bold text-sm shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
          {chapter.number}
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[2rem] mt-2 bg-gradient-to-b from-primary/60 to-primary/10" />
        )}
      </div>

      <article
        className={cn(
          'group relative flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm',
          'p-6 sm:p-7 md:p-8 transition-all duration-500 ease-out',
          'md:h-full md:min-h-[15.5rem] md:flex md:flex-col',
          'hover:border-primary/45 hover:shadow-[0_12px_40px_hsl(var(--primary)/0.12)] hover:-translate-y-1'
        )}
      >
        <span
          className="pointer-events-none absolute -right-2 -top-4 font-heading text-[5rem] sm:text-[6rem] font-black leading-none text-primary/[0.06] select-none md:text-[6.5rem]"
          aria-hidden
        >
          {paddedNumber}
        </span>

        <div className="relative z-10 flex flex-col flex-1 gap-3 md:gap-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium md:hidden">
            {chapterLabel} {chapter.number}
          </p>
          <h3 className="font-heading font-bold text-lg sm:text-xl text-foreground leading-snug group-hover:text-primary transition-colors duration-300">
            {pickLocalized(chapter.title, language)}
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-prose md:flex-1">
            {pickLocalized(chapter.description, language)}
          </p>
        </div>

        <div
          className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary group-hover:w-full transition-all duration-500 ease-out"
          aria-hidden
        />
      </article>
    </li>
  );
};

export default AcademyChapterCard;
