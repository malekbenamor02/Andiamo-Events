const PAYMENT_RETURN_PATH_KEY = 'andiamo-payment-return-path';

export function savePaymentReturnPath(path: string): void {
  try {
    if (path.startsWith('/')) {
      sessionStorage.setItem(PAYMENT_RETURN_PATH_KEY, path);
    }
  } catch {
    // sessionStorage unavailable
  }
}

export function getPaymentReturnPath(): string {
  try {
    const stored = sessionStorage.getItem(PAYMENT_RETURN_PATH_KEY);
    if (stored?.startsWith('/')) return stored;
  } catch {
    // sessionStorage unavailable
  }
  return '/pass-purchase';
}
