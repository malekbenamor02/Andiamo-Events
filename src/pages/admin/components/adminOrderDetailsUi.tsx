import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ADMIN_ORDER_DETAILS_DIALOG_CLASS = cn(
  "admin-order-details-dialog flex max-h-[90dvh] w-[min(100%,calc(100vw-2rem))] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:rounded-xl",
  "[&_input]:transition-none [&_textarea]:transition-none [&_[role=combobox]]:transition-none"
);

export function AdminOrderDetailsSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="border-b border-border/60 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AdminOrderDetailsField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function AdminOrderDetailsGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

export function formatAdminOrderDateTime(
  iso: string | Date | undefined | null,
  language: "en" | "fr"
) {
  if (iso == null) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}, ${d.toLocaleTimeString(language === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

export function formatAdminOrderSource(
  source: string | undefined | null,
  language: "en" | "fr"
) {
  if (!source) return "—";
  const map: Record<string, { en: string; fr: string }> = {
    platform_online: { en: "Online", fr: "En ligne" },
    platform_cod: { en: "Cash on delivery", fr: "Paiement à la livraison" },
    ambassador_manual: { en: "Ambassador (manual)", fr: "Ambassadeur (manuel)" },
  };
  const entry = map[source];
  return entry ? entry[language] : source.replace(/_/g, " ");
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PAID: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  EXPIRED: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  REFUNDED: "border-destructive/30 bg-destructive/10 text-destructive",
  PENDING_PAYMENT: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  PAID: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELLED_BY_AMBASSADOR: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELLED_BY_ADMIN: "border-destructive/30 bg-destructive/10 text-destructive",
  PENDING_ADMIN_APPROVAL:
    "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  PENDING_CASH: "border-border bg-muted/50 text-muted-foreground",
  REMOVED_BY_ADMIN: "border-border bg-muted/50 text-muted-foreground",
};

export function AdminOrderStatusPill({
  status,
  kind = "order",
}: {
  status: string;
  kind?: "order" | "payment";
}) {
  const normalized = status.toUpperCase();
  const styles =
    kind === "payment"
      ? PAYMENT_STATUS_STYLES[normalized] ??
        "border-border bg-muted/50 text-muted-foreground"
      : ORDER_STATUS_STYLES[normalized] ??
        (normalized.includes("CANCELLED")
          ? ORDER_STATUS_STYLES.CANCELLED
          : "border-border bg-muted/50 text-muted-foreground");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        styles
      )}
    >
      {status}
    </span>
  );
}

const ORDER_STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  PENDING_CASH: { en: "Pending Cash", fr: "En Attente Espèces" },
  PAID: { en: "Paid", fr: "Payé" },
  CANCELLED: { en: "Cancelled", fr: "Annulé" },
  PENDING_ADMIN_APPROVAL: { en: "Pending Approval", fr: "En Attente" },
  APPROVED: { en: "Approved", fr: "Approuvé" },
  REJECTED: { en: "Rejected", fr: "Rejeté" },
  REMOVED_BY_ADMIN: { en: "Removed by Admin", fr: "Retiré par l'administrateur" },
};

const PAYMENT_STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  PENDING_PAYMENT: { en: "Pending Payment", fr: "Paiement en Attente" },
  PAID: { en: "Paid", fr: "Payé" },
  FAILED: { en: "Failed", fr: "Échoué" },
  EXPIRED: { en: "Expired", fr: "Expiré" },
  REFUNDED: { en: "Refunded", fr: "Remboursé" },
};

export function getAdminOrderStatusDotColor(
  status: string,
  kind: "order" | "payment" = "order"
): string {
  const normalized = status.toUpperCase();
  if (kind === "payment") {
    if (normalized === "PAID") return "bg-green-500";
    if (normalized === "EXPIRED") return "bg-blue-500";
    if (normalized === "FAILED" || normalized === "REFUNDED") return "bg-red-500";
    if (normalized === "PENDING_PAYMENT") return "bg-yellow-500";
    return "bg-gray-500";
  }
  if (normalized === "PAID" || normalized === "APPROVED") return "bg-green-500";
  if (normalized === "CANCELLED" || normalized === "REJECTED") return "bg-red-500";
  if (normalized === "PENDING_ADMIN_APPROVAL") return "bg-yellow-500";
  if (normalized === "PENDING_CASH") return "bg-gray-500";
  if (normalized === "REMOVED_BY_ADMIN") return "bg-gray-600";
  return "bg-gray-500";
}

export function getAdminOrderStatusLabel(
  status: string,
  language: "en" | "fr",
  kind: "order" | "payment" = "order"
): string {
  const normalized = status.toUpperCase();
  const labels = kind === "payment" ? PAYMENT_STATUS_LABELS : ORDER_STATUS_LABELS;
  const entry = labels[normalized];
  if (entry) return language === "en" ? entry.en : entry.fr;
  return status;
}

/** Colored dot with tooltip — matches desktop ambassador/online order tables. */
export function AdminOrderStatusDot({
  status,
  language,
  kind = "order",
  className,
}: {
  status: string;
  language: "en" | "fr";
  kind?: "order" | "payment";
  className?: string;
}) {
  const label = getAdminOrderStatusLabel(status, language, kind);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            "inline-block h-3 w-3 shrink-0 cursor-help rounded-full",
            getAdminOrderStatusDotColor(status, kind),
            className
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function AdminOrderTagPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export function AdminPassTypePill({ label }: { label: string }) {
  const isVip = label.toLowerCase() === "vip";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        isVip
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-foreground"
      )}
    >
      {label.toUpperCase()}
    </span>
  );
}
