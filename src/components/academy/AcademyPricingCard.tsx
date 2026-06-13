import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ACADEMY_UI } from '@/data/academyContent';
import { formatPriceDt, pickLocalized } from '@/lib/academy/academyUtils';
import type { AcademyFormula, AcademyFormulaId, AcademyLanguage } from '@/types/academy';

interface AcademyPricingCardProps {
  formula: AcademyFormula;
  language: AcademyLanguage;
  onSelect: (id: AcademyFormulaId) => void;
  layout?: 'grid' | 'carousel';
}

const AcademyPricingCard = ({ formula, language, onSelect, layout = 'grid' }: AcademyPricingCardProps) => {
  const isRecommended = Boolean(formula.recommended);
  const { pricing } = ACADEMY_UI;

  return (
    <article
      className={cn(
        'relative flex h-full flex-col rounded-2xl border bg-card/80 backdrop-blur-sm transition-all duration-300',
        'p-8 md:p-10 lg:p-12',
        layout === 'carousel' && 'w-full',
        isRecommended && layout === 'grid' && 'md:scale-105 md:-translate-y-4 origin-bottom',
        isRecommended
          ? 'border-primary/40 shadow-[0_0_40px_hsl(var(--primary)/0.2)] z-10'
          : 'border-border/50 hover:border-primary/30'
      )}
    >
      {isRecommended && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 uppercase tracking-wide text-xs z-10 whitespace-nowrap">
          {pickLocalized(pricing.recommended, language)}
        </Badge>
      )}

      <header className="space-y-4 mb-8">
        <h3 className="text-xl md:text-2xl font-heading font-bold text-foreground uppercase">
          {pickLocalized(formula.name, language)}
        </h3>
        <p className="flex items-baseline gap-2">
          <span className="text-5xl md:text-6xl lg:text-7xl font-bold tabular-nums text-primary">
            {formatPriceDt(formula.priceDt)}
          </span>
          <span className="text-lg text-muted-foreground font-medium">DT</span>
        </p>
      </header>

      <ul className="flex-1 space-y-3 mb-10">
        {formula.features.map((feature) => (
          <li key={feature.en} className="flex gap-3 text-sm md:text-base text-muted-foreground">
            <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
            <span>{pickLocalized(feature, language)}</span>
          </li>
        ))}
      </ul>

      <Button
        className={cn('mt-auto w-full', isRecommended ? 'btn-gradient' : '')}
        variant={isRecommended ? 'default' : 'outline'}
        onClick={() => onSelect(formula.id)}
      >
        {pickLocalized(pricing.chooseCta, language)}
      </Button>
    </article>
  );
};

export default AcademyPricingCard;
