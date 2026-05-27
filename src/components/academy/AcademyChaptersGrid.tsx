import AcademyChapterCard from '@/components/academy/AcademyChapterCard';
import { ACADEMY_CHAPTERS } from '@/data/academyContent';
import { useStaggeredReveal } from '@/hooks/useStaggeredReveal';
import { cn } from '@/lib/utils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyChaptersGridProps {
  language: AcademyLanguage;
}

const AcademyChaptersGrid = ({ language }: AcademyChaptersGridProps) => {
  const { ref, revealed, getDelay } = useStaggeredReveal(ACADEMY_CHAPTERS.length, {
    staggerMs: 85,
  });

  return (
    <div ref={ref} className="mb-16 md:mb-20">
      <ol className="flex flex-col gap-0 md:hidden list-none p-0 m-0">
        {ACADEMY_CHAPTERS.map((chapter, index) => (
          <AcademyChapterCard
            key={chapter.number}
            chapter={chapter}
            language={language}
            revealed={revealed}
            delayMs={getDelay(index)}
            isLast={index === ACADEMY_CHAPTERS.length - 1}
          />
        ))}
      </ol>

      <ol
        className={cn(
          'hidden md:grid md:grid-cols-2 xl:grid-cols-3 md:items-stretch gap-6 lg:gap-8 list-none p-0 m-0',
          revealed &&
            '[&>li:nth-child(7)]:xl:col-span-3 [&>li:nth-child(7)]:xl:max-w-md [&>li:nth-child(7)]:xl:mx-auto [&>li:nth-child(7)]:xl:w-full'
        )}
      >
        {ACADEMY_CHAPTERS.map((chapter, index) => (
          <AcademyChapterCard
            key={chapter.number}
            chapter={chapter}
            language={language}
            revealed={revealed}
            delayMs={getDelay(index)}
          />
        ))}
      </ol>
    </div>
  );
};

export default AcademyChaptersGrid;
