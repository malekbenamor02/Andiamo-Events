import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const ADMIN_TABLE_HEAD =
  "px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
export const ADMIN_TABLE_ROW = "border-border/60 hover:bg-muted/20";
export const ADMIN_TABLE_WRAP = "overflow-hidden rounded-lg border border-border/60";
export const ADMIN_FILTERS_PANEL = "rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4";
export const ADMIN_FILTER_LABEL =
  "mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground";
export const ADMIN_BTN_EDIT = "h-8 border-border/60 px-2.5 text-xs hover:bg-muted/50";
export const ADMIN_BTN_DELETE =
  "h-8 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10";

export function AdminTabHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function AdminTabEmpty({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

export function AdminTabCardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminTabCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border/60 bg-card p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminMetricTile({
  label,
  value,
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  accent?: "primary" | "emerald" | "amber" | "destructive";
}) {
  const borderClass = {
    primary: "border-l-primary",
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    destructive: "border-l-destructive",
  }[accent];
  const valueClass = {
    primary: "text-primary",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    destructive: "text-destructive",
  }[accent];

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card px-4 py-3 border-l-[3px]",
        borderClass
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", valueClass)}>
        {value}
      </p>
    </div>
  );
}
