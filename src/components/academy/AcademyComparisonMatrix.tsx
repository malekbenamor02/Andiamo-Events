import { Check, X } from 'lucide-react';
import { ACADEMY_COMPARISON_ROWS, ACADEMY_FORMULAS } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import type { AcademyFormulaId, AcademyLanguage } from '@/types/academy';

interface AcademyComparisonMatrixProps {
  language: AcademyLanguage;
}

function CellIcon({ included }: { included: boolean }) {
  return included ? (
    <Check className="w-5 h-5 text-primary mx-auto" aria-label="Included" />
  ) : (
    <X className="w-5 h-5 text-muted-foreground/40 mx-auto" aria-label="Not included" />
  );
}

const AcademyComparisonMatrix = ({ language }: AcademyComparisonMatrixProps) => {
  const columns: AcademyFormulaId[] = ['essentielle', 'pro', 'premium'];

  return (
    <div className="hidden lg:block mt-16 overflow-x-auto rounded-2xl border border-border/50 glass">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            <th className="p-4 md:p-6 text-sm font-medium text-muted-foreground w-[40%]" scope="col" />
            {columns.map((id) => {
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
              <td className="p-4 md:p-6 text-sm text-foreground">{pickLocalized(row.label, language)}</td>
              <td className="p-4 md:p-6">
                <CellIcon included={row.essentielle} />
              </td>
              <td className="p-4 md:p-6">
                <CellIcon included={row.pro} />
              </td>
              <td className="p-4 md:p-6">
                <CellIcon included={row.premium} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AcademyComparisonMatrix;
