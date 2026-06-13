import { useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import AcademyPricingCard from '@/components/academy/AcademyPricingCard';
import type { AcademyFormula, AcademyFormulaId, AcademyLanguage } from '@/types/academy';

const SWIPE_HINT_SESSION_KEY = 'academy-pricing-swipe-hint-seen';

interface AcademyPricingCarouselProps {
  formulas: AcademyFormula[];
  language: AcademyLanguage;
  onSelectFormula: (id: AcademyFormulaId) => void;
}

const AcademyPricingCarousel = ({
  formulas,
  language,
  onSelectFormula,
}: AcademyPricingCarouselProps) => {
  const hintPlayed = useRef(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
  });

  useEffect(() => {
    if (!emblaApi || formulas.length < 2) return;

    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;

    const markSeen = () => {
      try {
        sessionStorage.setItem(SWIPE_HINT_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    };

    const cancelHint = () => {
      cancelled = true;
      clearTimeout(revealTimer);
      clearTimeout(returnTimer);
      markSeen();
    };

    const playSwipeHint = () => {
      if (cancelled || hintPlayed.current) return;
      if (sessionStorage.getItem(SWIPE_HINT_SESSION_KEY)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      hintPlayed.current = true;

      revealTimer = setTimeout(() => {
        if (cancelled) return;
        emblaApi.scrollNext();
        returnTimer = setTimeout(() => {
          if (!cancelled) emblaApi.scrollPrev();
          markSeen();
        }, 520);
      }, 900);
    };

    emblaApi.on('pointerDown', cancelHint);

    const root = emblaApi.rootNode();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          playSwipeHint();
          observer.disconnect();
        }
      },
      { threshold: 0.45 }
    );

    if (root) observer.observe(root);

    return () => {
      cancelled = true;
      clearTimeout(revealTimer);
      clearTimeout(returnTimer);
      emblaApi.off('pointerDown', cancelHint);
      observer.disconnect();
    };
  }, [emblaApi, formulas.length]);

  return (
    <div className="lg:hidden -mx-4 px-4 pb-2 pt-1 relative">
      <div ref={emblaRef} className="overflow-hidden touch-pan-y">
        <div className="flex -ml-4 items-stretch">
          {formulas.map((formula) => (
            <div
              key={formula.id}
              className="flex min-w-0 shrink-0 grow-0 basis-[min(100%,20rem)] sm:basis-[22rem] pl-4 pt-5"
            >
              <AcademyPricingCard
                formula={formula}
                language={language}
                onSelect={onSelectFormula}
                layout="carousel"
              />
            </div>
          ))}
        </div>
      </div>
      {formulas.length > 1 && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/40 to-transparent"
          aria-hidden
        />
      )}
    </div>
  );
};

export default AcademyPricingCarousel;
