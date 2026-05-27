import useEmblaCarousel from 'embla-carousel-react';
import AcademyPricingCard from '@/components/academy/AcademyPricingCard';
import type { AcademyFormula, AcademyFormulaId, AcademyLanguage } from '@/types/academy';

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
  const [emblaRef] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
  });

  return (
    <div className="lg:hidden -mx-4 px-4 pb-2 pt-1">
      <div ref={emblaRef} className="overflow-hidden touch-pan-y">
        <div className="flex -ml-4">
          {formulas.map((formula) => (
            <div
              key={formula.id}
              className="min-w-0 shrink-0 grow-0 basis-[min(100%,20rem)] sm:basis-[22rem] pl-4 pt-5"
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
    </div>
  );
};

export default AcademyPricingCarousel;
