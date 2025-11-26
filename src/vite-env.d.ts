/// <reference types="vite/client" />

interface Window {
  grecaptcha: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
    render: (container: string | HTMLElement, options: any) => number;
  };
}
