/**
 * Pass-type pill styles for ambassador order tables (avoid mixing Badge `default`
 * with custom colors — that produced primary red + yellow text).
 */
export function passTypeBadgeClass(passType: string | undefined): string {
  const k = (passType ?? "").toLowerCase().trim();
  if (k === "vip") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100 font-semibold leading-none py-1";
  }
  if (k === "zone 1") {
    return "border-sky-500/35 bg-sky-500/10 text-sky-100 font-medium leading-none py-1";
  }
  return "border-border/60 bg-muted/50 text-foreground/90 font-medium leading-none py-1";
}
