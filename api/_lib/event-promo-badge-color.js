/** Palette for promo UI badges (assigned randomly once per promo code, stored in DB). */
export const PROMO_BADGE_PALETTE = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#4f46e5',
];

const PALETTE_SET = new Set(PROMO_BADGE_PALETTE);

export function isPromoBadgeColor(value) {
  return typeof value === 'string' && PALETTE_SET.has(value);
}

/**
 * Pick a random palette color, preferring colors not already used on the same event.
 * @param {Iterable<string>} [usedColors]
 */
export function pickRandomPromoBadgeColor(usedColors) {
  const used = new Set();
  if (usedColors) {
    for (const c of usedColors) {
      if (isPromoBadgeColor(c)) used.add(c);
    }
  }
  const available = PROMO_BADGE_PALETTE.filter((c) => !used.has(c));
  const pool = available.length ? available : PROMO_BADGE_PALETTE;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
