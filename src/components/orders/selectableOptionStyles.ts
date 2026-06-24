import { cn } from "@/lib/utils";

export function selectableOptionCardClass(selected: boolean, disabled?: boolean) {
  return cn(
    "block rounded-lg border transition-colors duration-150",
    disabled
      ? "cursor-not-allowed border-border/40 bg-muted/20 opacity-60"
      : selected
        ? "cursor-pointer border-foreground/25 bg-muted/40"
        : "cursor-pointer border-border/60 bg-card hover:border-border hover:bg-muted/15"
  );
}

export function selectableOptionRowClass() {
  return "flex items-start gap-3 p-4";
}
