/**
 * Ambassador Dashboard — History tab (PAID, COMPLETED, CANCELLED orders).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
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
import { Package, Phone, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import type { Order } from "../types";
import type { AmbassadorTranslations } from "../types";
import { passTypeBadgeClass } from "../passTypeBadge";

export interface HistoryTabProps {
  language: "en" | "fr";
  t: AmbassadorTranslations;
  historyOrders: Order[];
  getOrderPasses: (order: Order) => Array<{ pass_type: string; quantity: number; price: number }>;
  getStatusBadge: (status: string) => React.ReactNode;
}

function getPassName(passType: string | undefined, t: AmbassadorTranslations): string {
  const k = passType?.toLowerCase();
  if (k === "vip") return t.vip;
  if (k === "zone 1") return "Zone 1";
  if (k === "standard") return t.standard;
  return passType || t.standard;
}

function getOrderDate(order: Order): Date {
  return new Date(order.completed_at || order.cancelled_at || order.updated_at);
}

function PassTypeCell({
  order,
  t,
  getOrderPasses,
}: {
  order: Order;
  t: AmbassadorTranslations;
  getOrderPasses: HistoryTabProps["getOrderPasses"];
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
  getOrderPasses: HistoryTabProps["getOrderPasses"];
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
  getOrderPasses: HistoryTabProps["getOrderPasses"];
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

export function HistoryTab({
  language,
  t,
  historyOrders,
  getOrderPasses,
  getStatusBadge,
}: HistoryTabProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="space-y-1 border-b border-border px-4 py-4 sm:px-6">
        <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
          {language === "en" ? "History" : "Historique"}
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {language === "en"
            ? "Completed, paid, and cancelled orders."
            : "Commandes terminées, payées et annulées."}
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {historyOrders.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">
              {language === "en" ? "No order history" : "Aucun historique de commande"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {language === "en"
                ? "Your completed orders will appear here."
                : "Vos commandes terminées apparaîtront ici."}
            </p>
          </div>
        ) : (
          <>
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
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{language === "en" ? "Date" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyOrders.map((order) => (
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
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="font-medium text-foreground">
                            {format(getOrderDate(order), "MMM d, yyyy")}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" aria-hidden />
                            {format(getOrderDate(order), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {historyOrders.map((order) => (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{order.user_name}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden />
                        {format(getOrderDate(order), "MMM d, yyyy · HH:mm")}
                      </p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(order.status)}</div>
                  </div>

                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="break-all text-foreground">{order.user_phone}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="text-foreground">
                            {order.city}
                            {order.ville ? `, ${order.ville}` : ""}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold tabular-nums text-foreground">
                          {order.total_price.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">TND</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/60 px-4 py-3">
                    <MobilePassDetails order={order} t={t} getOrderPasses={getOrderPasses} />
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
