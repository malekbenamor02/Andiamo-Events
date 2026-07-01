import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OrderPromoCornerRibbon,
  PresaleCornerRibbon,
} from "@/components/admin/OrderPromoCornerRibbon";
import { orderHasPromoAttribution, parsePromoFromOrder, resolvePromoBadgeColor } from "@/lib/eventPromo/promoOrder";
import { AdminOrderStatusDot } from "./adminOrderDetailsUi";
import type { CodOrder } from "./AmbassadorSalesTab";
import type { OnlineOrder } from "../types";
import type { GetRowHighlight } from "@/lib/admin/rowHighlight";
import { getRowHighlightClass, getStatusPulseClass } from "@/lib/admin/rowHighlight";

function formatPassSummary(
  passes: Array<{ pass_type?: string; passName?: string; quantity?: number }>
) {
  if (!passes.length) return null;
  return passes
    .map((p) => `${p.pass_type || p.passName || "—"} ×${p.quantity ?? 0}`)
    .join(" · ");
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function formatExpiry(iso: string, language: "en" | "fr") {
  return new Date(iso).toLocaleString(language === "en" ? "en-US" : "fr-FR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ListShell({
  empty,
  children,
}: {
  empty: boolean;
  children: ReactNode;
}) {
  if (empty) return <>{children}</>;
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 divide-y divide-border/70">
      {children}
    </div>
  );
}

function ListRow({
  onClick,
  children,
  cornerRibbon,
  highlightClassName,
}: {
  onClick: () => void;
  children: ReactNode;
  cornerRibbon?: ReactNode;
  highlightClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden px-3 py-3 text-left hover:bg-muted/30 active:bg-muted/40",
        cornerRibbon && "pr-7",
        highlightClassName,
      )}
    >
      {cornerRibbon}
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function orderCornerRibbon(
  order: { presale_code_id?: string | null },
  promoCode: string | null,
  promoColor: string,
  language: "en" | "fr"
) {
  if (order.presale_code_id) {
    return (
      <PresaleCornerRibbon
        variant="card"
        title={language === "en" ? "Placed via presale" : "Commande presale"}
      />
    );
  }
  if (promoCode) {
    return (
      <OrderPromoCornerRibbon
        variant="card"
        code={promoCode}
        color={promoColor}
      />
    );
  }
  return null;
}

export function AdminCodOrderMobileList({
  orders,
  language,
  onViewOrder,
  getRowHighlight,
}: {
  orders: CodOrder[];
  language: "en" | "fr";
  onViewOrder: (order: CodOrder) => void;
  getRowHighlight?: GetRowHighlight;
}) {
  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {language === "en"
          ? "No COD ambassador orders found"
          : "Aucune commande COD ambassadeur trouvée"}
      </p>
    );
  }

  return (
    <ListShell empty={false}>
      {orders.map((order) => {
        const passes = order.passes || [];
        const passSummary = formatPassSummary(passes);
        const price = order.total_price
          ? `${parseFloat(String(order.total_price)).toFixed(2)} TND`
          : "—";
        const showExpiry =
          order.status === "PENDING_CASH" && order.expires_at;
        const isExpired =
          showExpiry && new Date(order.expires_at!) <= new Date();

        const promo = parsePromoFromOrder(order);
        const promoCode = promo?.code?.trim() || null;
        const promoColor = resolvePromoBadgeColor(promo, order);

        const cornerRibbon =
          order.presale_code_id || (promoCode && orderHasPromoAttribution(order))
            ? orderCornerRibbon(
                order,
                promoCode && orderHasPromoAttribution(order) ? promoCode : null,
                promoColor,
                language
              )
            : null;
        const rowHighlight = getRowHighlight?.(order.id);

        return (
          <ListRow
            key={order.id}
            onClick={() => onViewOrder(order)}
            cornerRibbon={cornerRibbon}
            highlightClassName={getRowHighlightClass(rowHighlight)}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="truncate font-medium text-sm">
                {order.user_name || "—"}
              </p>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {price}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <AdminOrderStatusDot
                status={order.status}
                language={language}
                kind="order"
                className={getStatusPulseClass(rowHighlight)}
              />
              {passSummary && (
                <span className="text-xs text-muted-foreground">{passSummary}</span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {order.ambassador_name || "—"}
              {" · "}
              {formatShortDate(order.created_at)}
            </p>
            {showExpiry && (
              <p
                className={cn(
                  "mt-1 text-xs",
                  isExpired
                    ? "text-destructive"
                    : "text-amber-700 dark:text-amber-300"
                )}
              >
                {language === "en" ? "Expires" : "Expire"}{" "}
                {formatExpiry(order.expires_at!, language)}
                {isExpired
                  ? language === "en"
                    ? " · expired"
                    : " · expiré"
                  : ""}
              </p>
            )}
          </ListRow>
        );
      })}
    </ListShell>
  );
}

export function AdminOnlineOrderMobileList({
  orders,
  language,
  onViewOrder,
  getRowHighlight,
}: {
  orders: OnlineOrder[];
  language: "en" | "fr";
  onViewOrder: (order: OnlineOrder) => void;
  getRowHighlight?: GetRowHighlight;
}) {
  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {language === "en"
          ? "No online orders found"
          : "Aucune commande en ligne trouvée"}
      </p>
    );
  }

  return (
    <ListShell empty={false}>
      {orders.map((order) => {
        const orderPasses = order.order_passes as
          | Array<{ pass_type?: string; quantity?: number }>
          | undefined;
        const passItems =
          orderPasses?.map((p) => ({
            pass_type: p.pass_type,
            quantity: p.quantity,
          })) ?? [];
        const passSummary = formatPassSummary(passItems);
        const status = order.payment_status ?? "PENDING_PAYMENT";
        const price =
          order.total_price != null
            ? `${Number(order.total_with_fees ?? order.total_price).toFixed(2)} TND`
            : "—";
        const customer =
          order.user_name ?? order.customer_name ?? "—";
        const phone = order.user_phone ?? order.phone;

        const promo = parsePromoFromOrder(order);
        const promoCode = promo?.code?.trim() || null;
        const promoColor = resolvePromoBadgeColor(promo, order);

        const cornerRibbon =
          order.presale_code_id || (promoCode && orderHasPromoAttribution(order))
            ? orderCornerRibbon(
                order,
                promoCode && orderHasPromoAttribution(order) ? promoCode : null,
                promoColor,
                language
              )
            : null;
        const rowHighlight = getRowHighlight?.(order.id);

        return (
          <ListRow
            key={order.id}
            onClick={() => onViewOrder(order)}
            cornerRibbon={cornerRibbon}
            highlightClassName={getRowHighlightClass(rowHighlight)}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="truncate font-medium text-sm">{customer}</p>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {price}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <AdminOrderStatusDot
                status={status}
                language={language}
                kind="payment"
                className={getStatusPulseClass(rowHighlight)}
              />
              {passSummary && (
                <span className="text-xs text-muted-foreground">{passSummary}</span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {phone || "—"}
              {" · "}
              {formatShortDate(order.created_at)}
            </p>
          </ListRow>
        );
      })}
    </ListShell>
  );
}
