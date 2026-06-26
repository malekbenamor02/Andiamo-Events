export const SCANNER_BG = "#0A0A0A";
export const SCANNER_SURFACE = "#141414";
export const SCANNER_SURFACE_ALT = "#1A1A1A";
export const SCANNER_BORDER = "#2A2A2A";
export const SCANNER_MUTED = "#737373";
export const SCANNER_TEXT = "#F5F5F5";
export const SCANNER_BRAND = "#E21836";
export const SCANNER_BRAND_HOVER = "#c4142e";

export const SCANNER_SHEET_CLASS =
  "z-[60] flex max-h-[92dvh] flex-col rounded-t-[1.25rem] border-border/50 bg-[#141414] shadow-[0_-12px_48px_rgba(0,0,0,0.45)]";

export function formatSyncAgo(d: Date | null): string {
  if (!d) return "";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 120) return "1 min ago";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}
