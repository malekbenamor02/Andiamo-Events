import { cn } from "@/lib/utils";

export function AdminOrderSummaryStrip({
  order,
  className,
}: {
  order: Record<string, unknown>;
  className?: string;
}) {
  const name = String(order.user_name ?? "—");
  const phone = order.user_phone ? String(order.user_phone) : null;
  const ambassador = order.ambassador_name ? String(order.ambassador_name) : null;
  const orderNumber =
    order.order_number != null ? String(order.order_number) : String(order.id ?? "—");
  const total = order.total_price != null ? Number(order.total_price) : null;
  const priceLabel =
    total != null && !Number.isNaN(total) ? `${total.toFixed(2)} TND` : "—";

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/25 px-3.5 py-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            #{orderNumber}
            {phone ? ` · ${phone}` : ""}
          </p>
          {ambassador && (
            <p className="truncate text-xs text-muted-foreground">{ambassador}</p>
          )}
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums">{priceLabel}</p>
      </div>
    </div>
  );
}
