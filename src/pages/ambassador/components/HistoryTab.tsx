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

export interface HistoryTabProps {
  language: "en" | "fr";
  t: AmbassadorTranslations;
  historyOrders: Order[];
  getOrderPasses: (order: Order) => Array<{ pass_type: string; quantity: number; price: number }>;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function HistoryTab({
  language,
  t,
  historyOrders,
  getOrderPasses,
  getStatusBadge,
}: HistoryTabProps) {
  return (
    <Card className="border-border/50 shadow-lg shadow-primary/5 bg-gradient-to-br from-background to-background/95">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl sm:text-2xl font-heading bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {language === "en" ? "History" : "Historique"}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {language === "en"
                ? "View your completed, paid, and cancelled orders"
                : "Consultez vos commandes terminées, payées et annulées"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {historyOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg font-medium">
              {language === "en" ? "No order history" : "Aucun historique de commande"}
            </p>
            <p className="text-sm text-muted-foreground/80 mt-2">
              {language === "en"
                ? "Your completed orders will appear here"
                : "Vos commandes terminées apparaîtront ici"}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border/30">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-muted/50 to-muted/30 border-b-2 border-border/50">
                    <TableHead className="font-semibold text-foreground/90">{t.customerName}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">{t.phone}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">{t.city}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">{t.passType}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">{t.quantity}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">{t.totalPrice}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">{t.status}</TableHead>
                    <TableHead className="font-semibold text-foreground/90">
                      {language === "en" ? "Date" : "Date"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyOrders.map((order, index) => (
                    <TableRow
                      key={order.id}
                      className={`border-border/30 transition-all duration-200 ${
                        index % 2 === 0 ? "bg-card/30 hover:bg-card/50" : "bg-card/20 hover:bg-card/40"
                      }`}
                    >
                      <TableCell className="font-medium text-foreground">{order.user_name}</TableCell>
                      <TableCell className="text-foreground/90 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        {order.user_phone}
                      </TableCell>
                      <TableCell className="text-foreground/90 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {order.city}
                        {order.ville ? ` – ${order.ville}` : ""}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const passes = getOrderPasses(order);
                          if (passes.length === 0) {
                            return <span className="text-muted-foreground text-sm">-</span>;
                          }
                          if (passes.length === 1) {
                            const pass = passes[0];
                            const isVip = pass.pass_type?.toLowerCase() === "vip";
                            const passName = isVip ? t.vip : pass.pass_type || t.standard;
                            return (
                              <Badge
                                variant={isVip ? "default" : "secondary"}
                                className={
                                  isVip
                                    ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30"
                                    : "bg-muted/50 text-foreground/80"
                                }
                              >
                                {passName}
                              </Badge>
                            );
                          }
                          const passBreakdown = passes
                            .map((p) => {
                              const passName =
                                p.pass_type?.toLowerCase() === "vip"
                                  ? t.vip
                                  : p.pass_type?.toLowerCase() === "zone 1"
                                    ? "Zone 1"
                                    : p.pass_type?.toLowerCase() === "standard"
                                      ? t.standard
                                      : p.pass_type || t.standard;
                              return `${p.quantity}× ${passName}`;
                            })
                            .join(" + ");
                          return (
                            <div className="space-y-1">
                              <Badge
                                variant="outline"
                                className="border-primary/40 bg-primary/10 text-primary text-xs"
                              >
                                MIXED
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">{passBreakdown}</p>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const passes = getOrderPasses(order);
                          const totalQuantity =
                            passes.reduce((sum, p) => sum + (p.quantity || 0), 0) ||
                            order.quantity ||
                            0;
                          return (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                              {totalQuantity}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        <span className="text-green-400 font-bold">
                          {order.total_price.toFixed(2)} TND
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div className="font-medium text-foreground/90">
                            {format(
                              new Date(
                                order.completed_at || order.cancelled_at || order.updated_at
                              ),
                              "MMM d, yyyy"
                            )}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(
                              new Date(
                                order.completed_at || order.cancelled_at || order.updated_at
                              ),
                              "HH:mm"
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-4">
              {historyOrders.map((order) => {
                const isPaid = order.status === "PAID";
                const isCompleted = order.status === "COMPLETED";
                const isCancelled =
                  order.status === "CANCELLED" ||
                  order.status === "CANCELLED_BY_AMBASSADOR" ||
                  order.status === "CANCELLED_BY_ADMIN";
                return (
                  <Card
                    key={order.id}
                    className={`border-2 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                      isPaid
                        ? "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background border-blue-500/30"
                        : isCompleted
                          ? "bg-gradient-to-br from-green-500/10 via-green-500/5 to-background border-green-500/30"
                          : isCancelled
                            ? "bg-gradient-to-br from-red-500/10 via-red-500/5 to-background border-red-500/30"
                            : "bg-gradient-to-br from-card/50 to-card/30 border-border/50"
                    }`}
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between pb-3 border-b border-border/30">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-foreground mb-1">
                            {order.user_name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {format(
                              new Date(
                                order.completed_at || order.cancelled_at || order.updated_at
                              ),
                              "MMM d, yyyy HH:mm"
                            )}
                          </div>
                        </div>
                        <div>{getStatusBadge(order.status)}</div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <Phone className="w-4 h-4 text-primary/70" />
                          <div>
                            <p className="text-xs text-muted-foreground">{t.phone}</p>
                            <p className="text-sm font-medium text-foreground">
                              {order.user_phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <MapPin className="w-4 h-4 text-primary/70" />
                          <div>
                            <p className="text-xs text-muted-foreground">{t.city}</p>
                            <p className="text-sm font-medium text-foreground">
                              {order.city}
                              {order.ville ? ` – ${order.ville}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-2">{t.passType}</p>
                        {(() => {
                          const passes = getOrderPasses(order);
                          if (passes.length === 0) {
                            return <span className="text-muted-foreground text-sm">-</span>;
                          }
                          if (passes.length === 1) {
                            const pass = passes[0];
                            const isVip = pass.pass_type?.toLowerCase() === "vip";
                            const passName = isVip ? t.vip : pass.pass_type || t.standard;
                            return (
                              <div className="space-y-2">
                                <Badge
                                  variant={isVip ? "default" : "secondary"}
                                  className={
                                    isVip
                                      ? "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-300 border-yellow-500/30"
                                      : "bg-muted/50 text-foreground/80"
                                  }
                                >
                                  {passName}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground">{t.quantity}:</p>
                                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                                    {pass.quantity}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className="border-primary/40 bg-primary/10 text-primary text-xs"
                              >
                                MIXED
                              </Badge>
                              <div className="space-y-1.5 mt-2">
                                {passes.map((p, idx) => {
                                  const passName =
                                    p.pass_type?.toLowerCase() === "vip"
                                      ? t.vip
                                      : p.pass_type?.toLowerCase() === "zone 1"
                                        ? "Zone 1"
                                        : p.pass_type?.toLowerCase() === "standard"
                                          ? t.standard
                                          : p.pass_type || t.standard;
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm bg-background/50 p-2 rounded"
                                    >
                                      <span className="font-medium">{passName}</span>
                                      <span className="text-muted-foreground">× {p.quantity}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                                <p className="text-xs text-muted-foreground">{t.quantity}:</p>
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                                  {passes.reduce((sum, p) => sum + (p.quantity || 0), 0)}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/20 via-green-500/10 to-green-500/20 border border-green-500/30">
                        <p className="text-xs text-green-300/80 mb-1">{t.totalPrice}</p>
                        <p className="text-2xl font-bold text-green-400">
                          {order.total_price.toFixed(2)} TND
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
