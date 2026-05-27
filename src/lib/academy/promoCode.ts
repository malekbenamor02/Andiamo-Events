/** Uppercase A–Z and 0–9 only; must match server `normalizeAcademyPromoCode`. */
export function normalizeAcademyPromoCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isAcademyPromoCodeFormatValid(code: string): boolean {
  return /^[A-Z0-9]+$/.test(code);
}
