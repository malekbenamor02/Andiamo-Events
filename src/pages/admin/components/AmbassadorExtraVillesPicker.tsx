/**
 * Admin-only multi-select for ambassador extra neighborhood coverage at checkout.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getAllowedVillesForCity } from '@/lib/ambassadors/extraVilles';

interface AmbassadorExtraVillesPickerProps {
  city: string;
  primaryVille?: string | null;
  value: string[];
  onChange: (villes: string[]) => void;
  language: 'en' | 'fr';
}

export function AmbassadorExtraVillesPicker({
  city,
  primaryVille,
  value,
  onChange,
  language,
}: AmbassadorExtraVillesPickerProps) {
  if (city !== 'Sousse' && city !== 'Tunis') return null;

  const allowed = getAllowedVillesForCity(city);
  const primary = primaryVille?.trim() || '';
  const options = allowed.filter((v) => v !== primary);
  const selected = new Set(value);

  const toggle = (ville: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(ville);
    else next.delete(ville);
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-normal text-muted-foreground">
        {language === 'en'
          ? 'Additional neighborhoods'
          : 'Quartiers supplémentaires'}
      </Label>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 p-3 scrollbar-hidden">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {language === 'en'
              ? 'Select a primary neighborhood first.'
              : "Sélectionnez d'abord un quartier principal."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((ville) => (
              <label
                key={ville}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-0.5 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(ville)}
                  onCheckedChange={(c) => toggle(ville, c === true)}
                />
                <span>{ville}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
