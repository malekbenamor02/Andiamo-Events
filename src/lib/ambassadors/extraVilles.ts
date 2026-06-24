import { SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';

export function getAllowedVillesForCity(city: string): readonly string[] {
  if (city === 'Sousse') return SOUSSE_VILLES;
  if (city === 'Tunis') return TUNIS_VILLES;
  return [];
}

export function normalizeExtraVilles({
  primaryVille,
  extraVilles,
  allowedVilles,
}: {
  primaryVille?: string | null;
  extraVilles?: string[] | null;
  allowedVilles: readonly string[];
}): string[] {
  const allowed = new Set(allowedVilles);
  const primary = primaryVille?.trim() || '';
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of extraVilles || []) {
    const v = String(raw).trim();
    if (!v || v === primary || !allowed.has(v) || seen.has(v)) continue;
    seen.add(v);
    result.push(v);
  }

  return result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function formatPostgrestFilterValue(value: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildVilleCoverageOrFilter(ville: string): string {
  const v = formatPostgrestFilterValue(ville.trim());
  return `ville.eq.${v},extra_villes.cs.{${v}}`;
}

export function formatAmbassadorLocationLabel(ambassador: {
  city: string;
  ville?: string | null;
  extra_villes?: string[] | null;
}): { label: string; title?: string } {
  const base = ambassador.ville
    ? `${ambassador.city}, ${ambassador.ville}`
    : ambassador.city;
  const extras = ambassador.extra_villes?.filter(Boolean) ?? [];
  if (extras.length === 0) return { label: base };
  return {
    label: `${base} (+${extras.length})`,
    title: extras.join(', '),
  };
}
