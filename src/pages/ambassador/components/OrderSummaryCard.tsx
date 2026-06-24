import { MapPin, Phone, User } from "lucide-react";
import type { Order } from "../types";

export function OrderSummaryCard({ order }: { order: Order }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{order.user_name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" aria-hidden />
              {order.user_phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {order.city}
              {order.ville ? `, ${order.ville}` : ""}
            </span>
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {order.total_price.toFixed(2)} TND
        </p>
      </div>
    </div>
  );
}
