/** Uppercase A–Z and 0–9 only; must match server `normalizeEventPromoCode`. */
export function normalizeEventPromoCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

export function isEventPromoCodeFormatValid(code: string): boolean {
  return /^[A-Z0-9]+$/.test(code);
}
