import { Check, X } from 'lucide-react';
import { ACADEMY_COMPARISON_ROWS, ACADEMY_FORMULAS, ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { cn } from '@/lib/utils';
import type { AcademyComparisonCell, AcademyFormulaId, AcademyLanguage } from '@/types/academy';

interface AcademyComparisonMatrixProps {
  language: AcademyLanguage;
}

const FORMULA_COLUMNS: AcademyFormulaId[] = ['essentielle', 'pro', 'premium'];

const MOBILE_GRID =
  'grid grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))] items-center';

function ComparisonCell({
  cell,
  language,
  muted = false,
}: {
  cell: AcademyComparisonCell;
  language: AcademyLanguage;
  muted?: boolean;
}) {
  if (cell.kind === 'text') {
    return (
      <span
        className={cn(
          'block text-center text-[11px] sm:text-xs font-medium tabular-nums',
          muted ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {pickLocalized(cell.value, language)}
      </span>
    );
  }

  const included = cell.value;
  const label = included
    ? language === 'en'
      ? 'Yes'
      : 'Oui'
    : language === 'en'
      ? 'No'
      : 'Non';

  return included ? (
    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-primary mx-auto" aria-label={label} />
  ) : (
    <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/40 mx-auto" aria-label={label} />
  );
}

const STICKY_CELL =
  'lg:sticky lg:left-0 z-10 lg:bg-background/95 lg:backdrop-blur-sm lg:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.15)]';

function MobileComparisonGrid({ language }: { language: AcademyLanguage }) {
  return (
    <div className="rounded-2xl border border-border/50 glass lg:hidden overflow-hidden">
      <div className={cn(MOBILE_GRID, 'border-b border-border/50')}>
        <div className="p-2.5" aria-hidden />
        {FORMULA_COLUMNS.map((id) => {
          const formula = ACADEMY_FORMULAS.find((f) => f.id === id);
          if (!formula) return null;
          return (
            <div
              key={id}
              className="p-2 text-center text-[10px] sm:text-xs font-heading font-bold text-primary uppercase leading-tight"
            >
              {pickLocalized(formula.name, language)}
            </div>
          );
        })}
      </div>
      {ACADEMY_COMPARISON_ROWS.map((row) => (
        <div
          key={row.label.en}
          className={cn(MOBILE_GRID, 'border-b border-border/30 last:border-0')}
        >
          <div
            className={cn(
              'p-2.5 text-[11px] sm:text-xs leading-snug',
              row.muted ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {pickLocalized(row.label, language)}
          </div>
          {FORMULA_COLUMNS.map((id) => (
            <div key={id} className="p-2 flex justify-center">
              <ComparisonCell cell={row[id]} language={language} muted={row.muted} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const AcademyComparisonMatrix = ({ language }: AcademyComparisonMatrixProps) => {
  const { compareTitle } = ACADEMY_UI.pricing;

  return (
    <div className="mt-10 lg:mt-16">
      <h3 className="text-lg sm:text-xl font-heading font-bold text-foreground mb-4 text-center sm:text-left">
        {pickLocalized(compareTitle, language)}
      </h3>

      <MobileComparisonGrid language={language} />

      <div className="hidden lg:block rounded-2xl border border-border/50 glass overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              <th
                className={`p-4 md:p-6 text-sm font-medium text-muted-foreground w-[38%] ${STICKY_CELL}`}
                scope="col"
              />
              {FORMULA_COLUMNS.map((id) => {
                const formula = ACADEMY_FORMULAS.find((f) => f.id === id);
                if (!formula) return null;
                return (
                  <th
                    key={id}
                    className="p-4 md:p-6 text-center font-heading font-bold text-primary uppercase text-sm"
                    scope="col"
                  >
                    {pickLocalized(formula.name, language)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ACADEMY_COMPARISON_ROWS.map((row) => (
              <tr key={row.label.en} className="border-b border-border/30 last:border-0">
                <td
                  className={cn(
                    `p-4 md:p-6 text-sm ${STICKY_CELL}`,
                    row.muted ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  {pickLocalized(row.label, language)}
                </td>
                <td className="p-4 md:p-6">
                  <ComparisonCell cell={row.essentielle} language={language} muted={row.muted} />
                </td>
                <td className="p-4 md:p-6">
                  <ComparisonCell cell={row.pro} language={language} muted={row.muted} />
                </td>
                <td className="p-4 md:p-6">
                  <ComparisonCell cell={row.premium} language={language} muted={row.muted} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AcademyComparisonMatrix;
