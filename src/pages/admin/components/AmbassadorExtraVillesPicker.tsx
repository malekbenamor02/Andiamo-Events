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
    <div className="space-y-2">
      <Label>
        {language === 'en'
          ? 'Additional coverage villes'
          : 'Quartiers supplémentaires (couverture)'}
      </Label>
      <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {language === 'en'
              ? 'Select a primary neighborhood first.'
              : "Sélectionnez d'abord un quartier principal."}
          </p>
        ) : (
          options.map((ville) => (
            <label
              key={ville}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={selected.has(ville)}
                onCheckedChange={(c) => toggle(ville, c === true)}
              />
              <span>{ville}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
