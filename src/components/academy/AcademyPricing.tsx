import AcademySection from '@/components/academy/AcademySection';
import AcademyPricingCard from '@/components/academy/AcademyPricingCard';
import AcademyPricingCarousel from '@/components/academy/AcademyPricingCarousel';
import AcademyComparisonMatrix from '@/components/academy/AcademyComparisonMatrix';
import { ACADEMY_FORMULAS, ACADEMY_UI } from '@/data/academyContent';
import type { AcademyFormulaId, AcademyLanguage } from '@/types/academy';

interface AcademyPricingProps {
  language: AcademyLanguage;
  onSelectFormula: (id: AcademyFormulaId) => void;
}

const AcademyPricing = ({ language, onSelectFormula }: AcademyPricingProps) => {
  const { pricing } = ACADEMY_UI;

  return (
    <AcademySection title={pricing.title} language={language}>
      <AcademyPricingCarousel
        formulas={ACADEMY_FORMULAS}
        language={language}
        onSelectFormula={onSelectFormula}
      />

      <div className="hidden lg:grid lg:grid-cols-3 gap-8 lg:gap-12 items-end">
        {ACADEMY_FORMULAS.map((formula) => (
          <AcademyPricingCard
            key={formula.id}
            formula={formula}
            language={language}
            onSelect={onSelectFormula}
            layout="grid"
          />
        ))}
      </div>

      <AcademyComparisonMatrix language={language} />
    </AcademySection>
  );
};

export default AcademyPricing;
