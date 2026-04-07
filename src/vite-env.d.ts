/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Decimal rate for online payment fee display; must match server `ONLINE_PAYMENT_FEE_RATE` (e.g. 0.05). */
  readonly VITE_ONLINE_PAYMENT_FEE_RATE?: string;
}

interface Window {
  grecaptcha: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
    render: (container: string | HTMLElement, options: any) => number;
  };
}
