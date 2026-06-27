/**
 * Ambassador Dashboard — New Orders tab (PENDING_CASH).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Phone, MapPin, CheckCircle } from "lucide-react";
import { OrderExpirationTimer } from "./OrderExpirationTimer";
import type { Order } from "../types";
import type { AmbassadorTranslations } from "../types";
import { passTypeBadgeClass } from "../passTypeBadge";
import { cn } from "@/lib/utils";

const confirmButtonClass =
  "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40";

function getCopy(language: "en" | "fr") {
  return language === "en"
    ? {
        stepCall: "Call client",
        stepCollect: "Collect cash",
        stepConfirm: "Confirm",
        timeLeft: "Time left",
      }
    : {
        stepCall: "Appeler",
        stepCollect: "Encaisser",
        stepConfirm: "Confirmer",
        timeLeft: "Temps restant",
      };
}

export interface NewOrdersTabProps {
  language: "en" | "fr";
  t: AmbassadorTranslations;
  newOrders: Order[];
  getOrderPasses: (order: Order) => Array<{ pass_type: string; quantity: number; price: number }>;
  getStatusBadge: (status: string) => React.ReactNode;
  onConfirmCash: (order: Order) => void;
  onCancelOrder: (order: Order) => void;
}

function getPassName(
  passType: string | undefined,
  t: AmbassadorTranslations
): string {
  const k = passType?.toLowerCase();
  if (k === "vip") return t.vip;
  if (k === "zone 1") return "Zone 1";
  if (k === "standard") return t.standard;
  return passType || t.standard;
}

function PassTypeCell({
  order,
  t,
  getOrderPasses,
}: {
  order: Order;
  t: AmbassadorTranslations;
  getOrderPasses: NewOrdersTabProps["getOrderPasses"];
}) {
  const passes = getOrderPasses(order);
  if (passes.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (passes.length === 1) {
    const pass = passes[0];
    return (
      <Badge variant="outline" className={passTypeBadgeClass(pass.pass_type)}>
        {getPassName(pass.pass_type, t)}
      </Badge>
    );
  }
  const passBreakdown = passes
    .map((p) => `${p.quantity}× ${getPassName(p.pass_type, t)}`)
    .join(" + ");
  return (
    <div className="space-y-1">
      <Badge variant="outline" className="border-border bg-muted/50 text-foreground text-xs">
        MIXED
      </Badge>
      <p className="text-xs text-muted-foreground">{passBreakdown}</p>
    </div>
  );
}

function OrderQuantity({
  order,
  getOrderPasses,
}: {
  order: Order;
  getOrderPasses: NewOrdersTabProps["getOrderPasses"];
}) {
  const passes = getOrderPasses(order);
  const total =
    passes.reduce((sum, p) => sum + (p.quantity || 0), 0) || order.quantity || 0;
  return <span className="tabular-nums text-foreground">{total}</span>;
}

function MobilePassDetails({
  order,
  t,
  getOrderPasses,
}: {
  order: Order;
  t: AmbassadorTranslations;
  getOrderPasses: NewOrdersTabProps["getOrderPasses"];
}) {
  const passes = getOrderPasses(order);
  if (passes.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (passes.length === 1) {
    const pass = passes[0];
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={passTypeBadgeClass(pass.pass_type)}>
          {getPassName(pass.pass_type, t)}
        </Badge>
        <span className="text-sm text-muted-foreground">× {pass.quantity}</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Badge variant="outline" className="border-border bg-muted/50 text-foreground text-xs">
        MIXED
      </Badge>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {passes.map((p, idx) => (
          <span key={idx}>
            {getPassName(p.pass_type, t)} × {p.quantity}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NewOrdersTab({
  language,
  t,
  newOrders,
  getOrderPasses,
  getStatusBadge,
  onConfirmCash,
  onCancelOrder,
}: NewOrdersTabProps) {
  const copy = getCopy(language);

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="space-y-3 border-b border-border px-4 py-4 sm:px-6">
        <div>
          <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            {language === "en" ? "New Orders" : "Nouvelles commandes"}
          </CardTitle>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {language === "en"
              ? "Contact the client, collect cash, then confirm."
              : "Contactez le client, collectez le paiement, puis confirmez."}
          </p>
        </div>
        <ol className="flex flex-nowrap items-center gap-1.5 overflow-x-auto text-[11px] sm:text-xs scrollbar-hide">
          <li className="shrink-0 whitespace-nowrap rounded-md border border-border bg-muted/50 px-2 py-1 font-medium text-foreground">
            1. {copy.stepCall}
          </li>
          <li className="shrink-0 text-muted-foreground" aria-hidden>
            →
          </li>
          <li className="shrink-0 whitespace-nowrap rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-200">
            2. {copy.stepCollect}
          </li>
          <li className="shrink-0 text-muted-foreground" aria-hidden>
            →
          </li>
          <li className="shrink-0 whitespace-nowrap rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-medium text-emerald-800 dark:text-emerald-200">
            3. {copy.stepConfirm}
          </li>
        </ol>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {newOrders.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">{t.noAssignedOrders}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {language === "en"
                ? "New orders will appear here."
                : "Les nouvelles commandes apparaîtront ici."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                    <TableHead>{t.customerName}</TableHead>
                    <TableHead>{t.phone}</TableHead>
                    <TableHead>{t.city}</TableHead>
                    <TableHead>{t.passType}</TableHead>
                    <TableHead>{t.quantity}</TableHead>
                    <TableHead>{t.totalPrice}</TableHead>
                    <TableHead>{copy.timeLeft}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newOrders.map((order) => (
                    <TableRow key={order.id} className="border-border hover:bg-muted/20">
                      <TableCell className="font-medium">{order.user_name}</TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 break-all text-foreground">{order.user_phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 text-foreground">
                            {order.city}
                            {order.ville ? ` – ${order.ville}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PassTypeCell order={order} t={t} getOrderPasses={getOrderPasses} />
                      </TableCell>
                      <TableCell>
                        <OrderQuantity order={order} getOrderPasses={getOrderPasses} />
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {order.total_price.toFixed(2)} TND
                      </TableCell>
                      <TableCell>
                        {order.expires_at && order.status === "PENDING_CASH" ? (
                          <OrderExpirationTimer expiresAt={order.expires_at} language={language} />
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {order.status === "PENDING_CASH" && (
                            <Button
                              size="sm"
                              onClick={() => onConfirmCash(order)}
                              className={confirmButtonClass}
                            >
                              <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden />
                              {language === "en" ? "Confirm" : "Confirmer"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCancelOrder(order)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            {t.cancel}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {newOrders.map((order) => (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{order.user_name}</p>
                        <div className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="break-all">{order.user_phone}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span>
                              {order.city}
                              {order.ville ? `, ${order.ville}` : ""}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold tabular-nums text-foreground">
                          {order.total_price.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">TND</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
                    <MobilePassDetails order={order} t={t} getOrderPasses={getOrderPasses} />
                    {order.expires_at && order.status === "PENDING_CASH" && (
                      <OrderExpirationTimer expiresAt={order.expires_at} language={language} />
                    )}
                  </div>

                  {order.expiration_notes && (
                    <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                      {order.expiration_notes}
                    </p>
                  )}

                  <div className="flex gap-2 border-t border-border/60 p-3">
                    {order.status === "PENDING_CASH" && (
                      <Button
                        size="sm"
                        onClick={() => onConfirmCash(order)}
                        className={cn("flex-1", confirmButtonClass)}
                      >
                        <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden />
                        {language === "en" ? "Confirm" : "Confirmer"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCancelOrder(order)}
                      className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {t.cancel}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
