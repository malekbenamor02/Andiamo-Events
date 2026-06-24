/**
 * Admin Dashboard — Ambassador Sales tab (COD orders, reports, order logs).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, RefreshCw, Trophy, Medal, Award, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateAmbassadorIncome } from "@/lib/ambassadors/ambassadorIncome";
import { OrderPromoCornerRibbon } from "@/components/admin/OrderPromoCornerRibbon";
import { AdminCodOrderMobileList } from "./AdminMobileOrderList";
import { orderHasPromoAttribution, parsePromoFromOrder, resolvePromoBadgeColor } from "@/lib/eventPromo/promoOrder";
import type { AmbassadorOrderFilters, AmbassadorFilterOptions, AmbassadorOrderLog } from "../types";

function promoColorForCodOrder(order: CodOrder): string {
  return resolvePromoBadgeColor(parsePromoFromOrder(order), order);
}

function promoCodeLabelForCodOrder(order: CodOrder): string | null {
  const promo = parsePromoFromOrder(order);
  return promo?.code?.trim() || null;
}

function codOrderHasAttributionRibbon(order: CodOrder): boolean {
  return !!(order.presale_code_id || orderHasPromoAttribution(order));
}

function CodOrdersFilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const AMBASSADOR_SALES_TAB_TRIGGER_CLASS = cn(
  "relative z-10 rounded-full bg-transparent px-3 py-1.5 shadow-none",
  "transition-colors duration-200",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
);

function AmbassadorSalesSubTabsList({
  activeValue,
  children,
}: {
  activeValue: string;
  children: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const updateIndicator = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    if (!active) return;
    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
      ready: true,
    });
  }, []);

  useLayoutEffect(() => {
    updateIndicator();
  }, [activeValue, updateIndicator]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(list);
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <TabsList
      ref={listRef}
      className="relative grid h-10 w-full grid-cols-3 rounded-full bg-muted p-1"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-1 top-1 rounded-full bg-background shadow-sm",
          "transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          !indicator.ready && "opacity-0"
        )}
        style={{ left: indicator.left, width: indicator.width }}
      />
      {children}
    </TabsList>
  );
}

const AMBASSADOR_SALES_TAB_PANEL_CLASS =
  "ambassador-sales-subtab-panel mt-6 focus-visible:outline-none";

export interface CodOrder {
  id: string;
  status: string;
  event_id?: string;
  user_name?: string;
  user_phone?: string;
  user_email?: string;
  total_price?: number | string;
  ambassador_id?: string;
  ambassador_name?: string | null;
  ambassador_status?: string | null;
  created_at: string;
  expires_at?: string;
  rejected_at?: string;
  passes?: Array<{ pass_type?: string; passName?: string; quantity?: number; price?: number }>;
  pass_type?: string;
  presale_code_id?: string | null;
  event_promo_code_id?: string | null;
  event_promo_codes?: { badge_color?: string | null } | null;
  notes?: string | Record<string, unknown> | null;
}

export interface AmbassadorSalesTabProps {
  language: "en" | "fr";
  salesSystemTab: string;
  setSalesSystemTab: (v: string) => void;
  orderFilters: AmbassadorOrderFilters;
  setOrderFilters: (f: AmbassadorOrderFilters | ((prev: AmbassadorOrderFilters) => AmbassadorOrderFilters)) => void;
  filterOptions: AmbassadorFilterOptions;
  filteredCodOrders: CodOrder[];
  codAmbassadorOrders: CodOrder[];
  /** Matches the main dashboard event filter — reports use this event only (no separate event picker). */
  dashboardEventId?: string;
  selectedPassTypeTotal: number;
  loadingOrders: boolean;
  orderLogs: AmbassadorOrderLog[];
  onExportExcel: () => void;
  onRefresh: (statusFilter?: string) => void;
  onViewOrder: (order: CodOrder) => void;
  onViewAmbassador: (ambassadorId: string) => void;
}

const PAID_STATUSES = ["PAID", "COMPLETED"];
const PENDING_STATUSES = ["PENDING_CASH", "PENDING_ADMIN_APPROVAL", "PENDING_AMBASSADOR_CONFIRMATION", "APPROVED"];
const ORDERS_PAGE_SIZE = 100;

function getTicketsFromOrder(order: CodOrder): number {
  if (order.passes && order.passes.length > 0) {
    return order.passes.reduce((sum, pass) => sum + (pass.quantity ?? 0), 0);
  }
  return 0;
}

export function AmbassadorSalesTab(p: AmbassadorSalesTabProps) {
  const { toast } = useToast();
  const reportEventId = p.dashboardEventId ?? "";
  const [reportStatusFilter, setReportStatusFilter] = useState<"paid" | "pending" | "all">("paid");
  const [ordersListPage, setOrdersListPage] = useState(1);

  const filteredOrdersCount = p.filteredCodOrders.length;
  const ordersTotalPages = Math.max(1, Math.ceil(filteredOrdersCount / ORDERS_PAGE_SIZE));

  useEffect(() => {
    setOrdersListPage(1);
  }, [
    p.orderFilters.orderId,
    p.orderFilters.status,
    p.orderFilters.phone,
    p.orderFilters.ambassador,
    p.orderFilters.city,
    p.orderFilters.ville,
    p.orderFilters.passType,
  ]);

  useEffect(() => {
    if (ordersListPage > ordersTotalPages) {
      setOrdersListPage(ordersTotalPages);
    }
  }, [ordersListPage, ordersTotalPages]);

  const paginatedCodOrders = useMemo(() => {
    const start = (ordersListPage - 1) * ORDERS_PAGE_SIZE;
    return p.filteredCodOrders.slice(start, start + ORDERS_PAGE_SIZE);
  }, [p.filteredCodOrders, ordersListPage]);

  const reportRows = useMemo(() => {
    const orders = p.codAmbassadorOrders;
    let filtered = orders;
    if (reportEventId) {
      filtered = filtered.filter((o) => o.event_id === reportEventId);
    }
    if (reportStatusFilter === "paid") {
      filtered = filtered.filter((o) => PAID_STATUSES.includes(o.status));
    } else if (reportStatusFilter === "pending") {
      filtered = filtered.filter((o) => PENDING_STATUSES.includes(o.status));
    }

    const byAmbassador = new Map<
      string,
      { ambassador_id: string; ambassador_name: string; ambassador_status?: string | null; tickets: number; totalPrice: number }
    >();
    for (const order of filtered) {
      const aid = order.ambassador_id;
      if (!aid) continue;
      const existing = byAmbassador.get(aid);
      const tickets = getTicketsFromOrder(order);
      const price = Number(order.total_price) || 0;
      if (existing) {
        existing.tickets += tickets;
        existing.totalPrice += price;
      } else {
        byAmbassador.set(aid, {
          ambassador_id: aid,
          ambassador_name: order.ambassador_name ?? "—",
          ambassador_status: order.ambassador_status ?? null,
          tickets,
          totalPrice: price,
        });
      }
    }

    const rows = Array.from(byAmbassador.values())
      .map((r) => ({
        ...r,
        income: calculateAmbassadorIncome(r.tickets),
      }))
      .filter((r) => r.tickets > 0 || r.totalPrice > 0)
      .sort((a, b) => {
        if (b.tickets !== a.tickets) return b.tickets - a.tickets;
        return b.income - a.income;
      });

    return rows;
  }, [p.codAmbassadorOrders, reportEventId, reportStatusFilter]);

  const passTypeChartData = useMemo(() => {
    const orders = p.codAmbassadorOrders;
    let filtered = orders;
    if (reportEventId) filtered = filtered.filter((o) => o.event_id === reportEventId);
    if (reportStatusFilter === "paid") {
      filtered = filtered.filter((o) => PAID_STATUSES.includes(o.status));
    } else if (reportStatusFilter === "pending") {
      filtered = filtered.filter((o) => PENDING_STATUSES.includes(o.status));
    }
    const byPassType = new Map<string, { count: number; revenue: number }>();
    for (const order of filtered) {
      const passes = order.passes || [];
      for (const pass of passes) {
        const name = pass.pass_type || pass.passName || "—";
        const qty = pass.quantity ?? 0;
        const price = typeof pass.price === "number" ? pass.price : parseFloat(String(pass.price || 0)) || 0;
        const existing = byPassType.get(name);
        if (existing) {
          existing.count += qty;
          existing.revenue += qty * price;
        } else {
          byPassType.set(name, { count: qty, revenue: qty * price });
        }
      }
    }
    return Array.from(byPassType.entries())
      .map(([passType, data]) => ({ passType, count: data.count, revenue: Math.round(data.revenue * 100) / 100 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [p.codAmbassadorOrders, reportEventId, reportStatusFilter]);

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({
        title: p.language === "en" ? "Copied!" : "Copié!",
        description: p.language === "en" ? "Email copied to clipboard" : "Email copié dans le presse-papiers",
        duration: 2000,
      });
    } catch (err) {
      console.error("Failed to copy email:", err);
      toast({
        title: p.language === "en" ? "Error" : "Erreur",
        description: p.language === "en" ? "Failed to copy email" : "Échec de la copie de l'email",
        variant: "destructive",
      });
    }
  };

  const maskEmail = (email: string) => {
    if (!email || !email.includes("@")) return email;
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 3) {
      return `${localPart}***@${domain}`;
    }
    const visibleStart = localPart.substring(0, 3);
    const visibleEnd = domain.substring(domain.length - 4);
    return `${visibleStart}***@${visibleEnd}`;
  };

  const getStatusColor = (status: string) => {
    if (status === "PAID" || status === "APPROVED") return "bg-green-500";
    if (status === "CANCELLED" || status === "REJECTED") return "bg-red-500";
    if (status === "PENDING_ADMIN_APPROVAL") return "bg-yellow-500";
    if (status === "PENDING_CASH") return "bg-gray-500";
    if (status === "REMOVED_BY_ADMIN") return "bg-gray-600";
    return "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; fr: string }> = {
      PENDING_CASH: { en: "Pending Cash", fr: "En Attente Espèces" },
      PAID: { en: "Paid", fr: "Payé" },
      CANCELLED: { en: "Cancelled", fr: "Annulé" },
      PENDING_ADMIN_APPROVAL: { en: "Pending Approval", fr: "En Attente" },
      APPROVED: { en: "Approved", fr: "Approuvé" },
      REJECTED: { en: "Rejected", fr: "Rejeté" },
      REMOVED_BY_ADMIN: { en: "Removed by Admin", fr: "Retiré par l'administrateur" },
    };
    const l = labels[status] || { en: status, fr: status };
    return p.language === "en" ? l.en : l.fr;
  };

  const getAmbassadorStatusBadge = (ambassadorStatus: string | null | undefined) => {
    if (!ambassadorStatus || ambassadorStatus === "approved") return null;
    if (ambassadorStatus === "suspended") {
      return (
        <Badge variant="secondary" className="text-xs shrink-0 w-fit">
          {p.language === "en" ? "Paused" : "En pause"}
        </Badge>
      );
    }
    if (ambassadorStatus === "removed") {
      return (
        <Badge variant="destructive" className="text-xs shrink-0 w-fit">
          {p.language === "en" ? "Removed" : "Retiré"}
        </Badge>
      );
    }
    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
    <TabsContent value="ambassador-sales" className="space-y-6">
      <Tabs value={p.salesSystemTab} onValueChange={p.setSalesSystemTab} className="ambassador-sales-subtabs w-full">
        <AmbassadorSalesSubTabsList activeValue={p.salesSystemTab}>
          <TabsTrigger value="cod-ambassador-orders" className={AMBASSADOR_SALES_TAB_TRIGGER_CLASS}>
            {p.language === "en" ? "Orders" : "Commandes"}
          </TabsTrigger>
          <TabsTrigger value="reports" className={AMBASSADOR_SALES_TAB_TRIGGER_CLASS}>
            {p.language === "en" ? "Reports" : "Rapports"}
          </TabsTrigger>
          <TabsTrigger value="order-logs" className={AMBASSADOR_SALES_TAB_TRIGGER_CLASS}>
            {p.language === "en" ? "Logs" : "Journaux"}
          </TabsTrigger>
        </AmbassadorSalesSubTabsList>

        {/* COD Ambassador Orders */}
        <TabsContent value="cod-ambassador-orders" className={AMBASSADOR_SALES_TAB_PANEL_CLASS}>
          <Card className="border-border/70">
            <CardHeader className="space-y-0 border-b border-border/60 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold leading-snug">
                  {p.language === "en" ? "COD ambassador orders" : "Commandes COD ambassadeur"}
                </CardTitle>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <Button
                    type="button"
                    onClick={p.onExportExcel}
                    variant="outline"
                    size="sm"
                    className="cod-ambassador-orders-toolbar h-8 justify-center text-xs sm:min-w-[7rem]"
                  >
                    <Download className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden />
                    <span className="truncate">
                      {p.language === "en" ? "Export" : "Exporter"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => p.onRefresh(p.orderFilters.status || undefined)}
                    variant="outline"
                    size="sm"
                    className="cod-ambassador-orders-toolbar h-8 justify-center text-xs sm:min-w-[7rem]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" aria-hidden />
                    <span className="truncate">
                      {p.language === "en" ? "Refresh" : "Actualiser"}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-4 sm:px-6">
              <div className="cod-ambassador-orders-filters mb-4 rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {p.language === "en" ? "Filters" : "Filtres"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      p.setOrderFilters({
                        status: "",
                        phone: "",
                        ambassador: "",
                        city: "",
                        ville: "",
                        orderId: "",
                        passType: "",
                      });
                      p.onRefresh();
                    }}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {p.language === "en" ? "Clear all" : "Tout effacer"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <CodOrdersFilterField
                    label={p.language === "en" ? "Order number" : "N° commande"}
                  >
                    <Input
                      placeholder={
                        p.language === "en" ? "e.g. #807105" : "ex. #807105"
                      }
                      value={p.orderFilters.orderId}
                      onChange={(e) =>
                        p.setOrderFilters({ ...p.orderFilters, orderId: e.target.value })
                      }
                      className="h-9 bg-background text-sm font-mono"
                    />
                  </CodOrdersFilterField>

                  <CodOrdersFilterField label={p.language === "en" ? "Status" : "Statut"}>
                    <Select
                      value={p.orderFilters.status || "all"}
                      onValueChange={(value) => {
                        const newStatus = value === "all" || value === "" ? "" : value;
                        p.setOrderFilters({ ...p.orderFilters, status: newStatus });
                        p.onRefresh(newStatus || undefined);
                      }}
                    >
                      <SelectTrigger className="h-9 bg-background text-sm">
                        <SelectValue
                          placeholder={
                            p.language === "en" ? "All statuses" : "Tous les statuts"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {p.language === "en" ? "All statuses" : "Tous les statuts"}
                        </SelectItem>
                        <SelectItem value="PENDING_CASH">
                          {p.language === "en" ? "Pending cash" : "En attente espèces"}
                        </SelectItem>
                        <SelectItem value="PENDING_ADMIN_APPROVAL">
                          {p.language === "en" ? "Pending approval" : "En attente d'approbation"}
                        </SelectItem>
                        <SelectItem value="PAID">{p.language === "en" ? "Paid" : "Payé"}</SelectItem>
                        <SelectItem value="REJECTED">
                          {p.language === "en" ? "Rejected" : "Rejeté"}
                        </SelectItem>
                        <SelectItem value="CANCELLED">
                          {p.language === "en" ? "Cancelled" : "Annulé"}
                        </SelectItem>
                        <SelectItem value="REMOVED_BY_ADMIN">
                          {p.language === "en" ? "Removed by admin" : "Retiré par l'admin"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </CodOrdersFilterField>

                  <CodOrdersFilterField label={p.language === "en" ? "Phone" : "Téléphone"}>
                    <Input
                      placeholder={
                        p.language === "en" ? "Search by phone…" : "Rechercher par téléphone…"
                      }
                      value={p.orderFilters.phone}
                      onChange={(e) =>
                        p.setOrderFilters({ ...p.orderFilters, phone: e.target.value })
                      }
                      className="h-9 bg-background text-sm"
                    />
                  </CodOrdersFilterField>

                  <CodOrdersFilterField
                    label={p.language === "en" ? "Ambassador" : "Ambassadeur"}
                  >
                    <Select
                      value={p.orderFilters.ambassador || "all"}
                      onValueChange={(value) =>
                        p.setOrderFilters({
                          ...p.orderFilters,
                          ambassador: value === "all" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 bg-background text-sm">
                        <SelectValue
                          placeholder={
                            p.language === "en" ? "All ambassadors" : "Tous les ambassadeurs"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]" side="bottom" avoidCollisions={false}>
                        <SelectItem value="all">
                          {p.language === "en" ? "All ambassadors" : "Tous les ambassadeurs"}
                        </SelectItem>
                        {p.filterOptions.ambassadors.map((ambassador) => (
                          <SelectItem key={ambassador} value={ambassador}>
                            {ambassador}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CodOrdersFilterField>

                  <CodOrdersFilterField
                    label={p.language === "en" ? "Pass type" : "Type de pass"}
                  >
                    <Select
                      value={p.orderFilters.passType || "all"}
                      onValueChange={(value) =>
                        p.setOrderFilters({
                          ...p.orderFilters,
                          passType: value === "all" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 bg-background text-sm">
                        <SelectValue
                          placeholder={
                            p.language === "en" ? "All pass types" : "Tous les types"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]" side="bottom" avoidCollisions={false}>
                        <SelectItem value="all">
                          {p.language === "en" ? "All pass types" : "Tous les types"}
                        </SelectItem>
                        {p.filterOptions.passTypes.map((passType) => (
                          <SelectItem key={passType} value={passType}>
                            {passType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {p.orderFilters.passType && (
                      <p className="text-xs text-muted-foreground">
                        {p.language === "en" ? "Total" : "Total"}:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {p.selectedPassTypeTotal}
                        </span>
                      </p>
                    )}
                  </CodOrdersFilterField>
                </div>
              </div>

              {!p.loadingOrders && filteredOrdersCount > ORDERS_PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 text-xs text-muted-foreground">
                  <span>
                    {p.language === "en" ? "Showing" : "Affichage"}{" "}
                    {(ordersListPage - 1) * ORDERS_PAGE_SIZE + 1}–
                    {Math.min(ordersListPage * ORDERS_PAGE_SIZE, filteredOrdersCount)}{" "}
                    {p.language === "en" ? "of" : "sur"} {filteredOrdersCount}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={ordersListPage <= 1}
                      onClick={() => setOrdersListPage((n) => Math.max(1, n - 1))}
                    >
                      {p.language === "en" ? "Previous" : "Précédent"}
                    </Button>
                    <span className="tabular-nums px-1">
                      {ordersListPage} / {ordersTotalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={ordersListPage >= ordersTotalPages}
                      onClick={() => setOrdersListPage((n) => Math.min(ordersTotalPages, n + 1))}
                    >
                      {p.language === "en" ? "Next" : "Suivant"}
                    </Button>
                  </div>
                </div>
              )}

              {p.loadingOrders ? (
                <div className="text-center py-8">
                  <Loader size="md" className="mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {p.language === "en" ? "Loading orders..." : "Chargement des commandes..."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop: keep original table view */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Pass Types" : "Types de Pass"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Client Name" : "Nom Client"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Phone" : "Téléphone"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Email" : "Email"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Total Price" : "Prix Total"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Ambassador" : "Ambassadeur"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center w-16">
                              {p.language === "en" ? "Status" : "Statut"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Expires At" : "Expire Le"}
                            </TableHead>
                            <TableHead className="py-2 whitespace-nowrap text-center">
                              {p.language === "en" ? "Created" : "Créé"}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.filteredCodOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                {p.language === "en"
                                  ? "No COD ambassador orders found"
                                  : "Aucune commande COD ambassadeur trouvée"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedCodOrders.map((order) => {
                              const passes = order.passes || [];
                              const createdText = (() => {
                                const d = new Date(order.created_at);
                                const day = String(d.getDate()).padStart(2, "0");
                                const month = String(d.getMonth() + 1).padStart(2, "0");
                                return `${day}/${month}/${d.getFullYear()}`;
                              })();

                              return (
                                <TableRow
                                  key={order.id}
                                  className="text-xs cursor-pointer"
                                  onClick={() => p.onViewOrder(order)}
                                  title={
                                    p.language === "en"
                                      ? "Click row to view order details"
                                      : "Cliquer sur la ligne pour voir la commande"
                                  }
                                >
                                  <TableCell className="py-2 text-center relative overflow-hidden">
                                    {order.presale_code_id ? (
                                      <div
                                        className="absolute top-0 left-0 w-[38px] h-[38px] overflow-hidden pointer-events-none z-10"
                                        title={p.language === "en" ? "Placed via presale" : "Commande presale"}
                                      >
                                        <span
                                          className="absolute block text-center bg-indigo-500 text-white font-bold uppercase tracking-wider shadow-sm"
                                          style={{ width: 64, transform: "rotate(-45deg)", top: 6, left: -20, fontSize: 7, lineHeight: "10px", padding: "1px 0" }}
                                        >
                                          {p.language === "en" ? "Presale" : "Presale"}
                                        </span>
                                      </div>
                                    ) : promoCodeLabelForCodOrder(order) ? (
                                      <OrderPromoCornerRibbon
                                        variant="table"
                                        code={promoCodeLabelForCodOrder(order)!}
                                        color={promoColorForCodOrder(order)}
                                        title={
                                          p.language === "en"
                                            ? `Promo code: ${promoCodeLabelForCodOrder(order)}`
                                            : `Code promo : ${promoCodeLabelForCodOrder(order)}`
                                        }
                                      />
                                    ) : null}
                                    {passes.length > 0 ? (
                                      <div className="flex flex-col items-center gap-1">
                                        {passes.map(
                                          (px: { pass_type?: string; passName?: string; quantity?: number }, idx: number) => (
                                            <div
                                              key={idx}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/30 text-xs"
                                            >
                                              <span className="font-medium">{px.pass_type || px.passName}</span>
                                              <span className="text-muted-foreground">×{px.quantity}</span>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    ) : null}
                                  </TableCell>

                                  <TableCell className="py-2 text-center">{order.user_name || "N/A"}</TableCell>
                                  <TableCell className="py-2 text-center">{order.user_phone || "N/A"}</TableCell>

                                  <TableCell className="py-2 text-center text-xs">
                                    {order.user_email ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyEmail(order.user_email!);
                                        }}
                                        className="hover:text-primary hover:underline cursor-pointer"
                                        title={
                                          p.language === "en"
                                            ? "Click to copy email"
                                            : "Cliquer pour copier l'email"
                                        }
                                      >
                                        {maskEmail(order.user_email)}
                                      </button>
                                    ) : (
                                      "N/A"
                                    )}
                                  </TableCell>

                                  <TableCell className="py-2 text-center text-xs font-semibold">
                                    {order.total_price ? `${parseFloat(String(order.total_price)).toFixed(2)} TND` : "N/A"}
                                  </TableCell>

                                  <TableCell className="py-2 text-center whitespace-nowrap">
                                    {order.ambassador_id ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            p.onViewAmbassador(order.ambassador_id!);
                                          }}
                                          className="text-primary hover:underline cursor-pointer text-xs text-left"
                                        >
                                          {order.ambassador_name ?? "—"}
                                        </button>
                                        {getAmbassadorStatusBadge(order.ambassador_status)}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">N/A</span>
                                    )}
                                  </TableCell>

                                  <TableCell className="py-2 text-center">
                                    <div className="flex justify-center items-center gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={`w-3 h-3 rounded-full cursor-help ${getStatusColor(order.status)}`}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">{getStatusLabel(order.status)}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableCell>

                                  <TableCell className="py-2 text-center whitespace-nowrap text-xs">
                                    {order.status === "REJECTED" && order.rejected_at ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <Badge variant="destructive" className="text-xs px-1 py-0">
                                          {p.language === "en" ? "Rejected" : "Rejeté"}
                                        </Badge>
                                        {order.expires_at && (
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(order.expires_at).toLocaleString(
                                              p.language === "en" ? "en-US" : "fr-FR",
                                              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    ) : order.expires_at && order.status === "PENDING_CASH" ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <span
                                          className={cn(
                                            "text-xs",
                                            new Date(order.expires_at) <= new Date()
                                              ? "text-red-500 font-semibold"
                                              : new Date(order.expires_at).getTime() - new Date().getTime() <
                                                  2 * 60 * 60 * 1000
                                                ? "text-orange-500 font-semibold"
                                                : "text-yellow-500",
                                          )}
                                        >
                                          {new Date(order.expires_at).toLocaleString(
                                            p.language === "en" ? "en-US" : "fr-FR",
                                            { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
                                          )}
                                        </span>
                                        {new Date(order.expires_at) <= new Date() && (
                                          <Badge variant="destructive" className="text-xs px-1 py-0">
                                            {p.language === "en" ? "Expired" : "Expiré"}
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  <TableCell className="py-2 text-center whitespace-nowrap text-xs">{createdText}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Mobile: list view */}
                  <div className="md:hidden">
                    <AdminCodOrderMobileList
                      orders={paginatedCodOrders}
                      language={p.language}
                      onViewOrder={p.onViewOrder}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className={AMBASSADOR_SALES_TAB_PANEL_CLASS}>
          <Card>
            <CardHeader>
              <CardTitle>{p.language === "en" ? "Ambassador Reports" : "Rapports Ambassadeurs"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">{p.language === "en" ? "Orders" : "Commandes"}</Label>
                  <div className="flex rounded-lg border bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => setReportStatusFilter("paid")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        reportStatusFilter === "paid"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.language === "en" ? "Paid" : "Payées"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportStatusFilter("pending")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        reportStatusFilter === "pending"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.language === "en" ? "Pending" : "En attente"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportStatusFilter("all")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        reportStatusFilter === "all"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.language === "en" ? "All" : "Toutes"}
                    </button>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>{p.language === "en" ? "Ambassador" : "Ambassadeur"}</TableHead>
                    <TableHead className="text-right">{p.language === "en" ? "Passes" : "Passes"}</TableHead>
                    <TableHead className="text-right">{p.language === "en" ? "Total (TND)" : "Total (TND)"}</TableHead>
                    <TableHead className="text-right">{p.language === "en" ? "Income (DT)" : "Revenus (DT)"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {p.language === "en" ? "No data for the selected filters" : "Aucune donnée pour les filtres sélectionnés"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportRows.map((row, index) => (
                      <TableRow key={row.ambassador_id}>
                        <TableCell className="text-center font-medium">
                          <span className="inline-flex items-center justify-center gap-1">
                            {index === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                            {index === 1 && <Medal className="h-4 w-4 text-slate-400" />}
                            {index === 2 && <Award className="h-4 w-4 text-amber-700" />}
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <button
                              type="button"
                              onClick={() => p.onViewAmbassador(row.ambassador_id)}
                              className="text-primary hover:underline text-left font-medium"
                            >
                              {row.ambassador_name}
                            </button>
                            {getAmbassadorStatusBadge(row.ambassador_status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{row.tickets}</TableCell>
                        <TableCell className="text-right">{row.totalPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">{row.income.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {reportRows.length > 0 && (
                <div className="flex justify-end gap-6 pt-2 text-sm text-muted-foreground">
                  <span>
                    {p.language === "en" ? "Total passes:" : "Total passes :"} {reportRows.reduce((s, r) => s + r.tickets, 0)}
                  </span>
                  <span>
                    {p.language === "en" ? "Total income:" : "Total revenus :"} {reportRows.reduce((s, r) => s + r.income, 0).toFixed(2)} DT
                  </span>
                </div>
              )}

              {passTypeChartData.length > 0 && (
                <div className="pt-6 mt-6 border-t border-border">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    {p.language === "en"
                      ? "Paid passes by type (ambassador sales only)"
                      : "Passes payés par type (ventes ambassadeurs uniquement)"}
                  </h3>
                  <ResponsiveContainer width="100%" height={Math.max(320, passTypeChartData.length * 44)}>
                    <BarChart
                      data={passTypeChartData}
                      margin={{ top: 8, right: 24, left: 8, bottom: 24 }}
                      layout="vertical"
                      barCategoryGap={12}
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" xAxisId="count" orientation="bottom" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <XAxis type="number" xAxisId="revenue" orientation="top" tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v) => `${v} TND`} />
                      <YAxis
                        type="category"
                        dataKey="passType"
                        width={160}
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickMargin={8}
                        interval={0}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        cursor={{ fill: "transparent" }}
                        formatter={(value: number, name: string) => [
                          name === "count" ? value : `${Number(value).toFixed(2)} TND`,
                          name === "count" ? (p.language === "en" ? "Passes" : "Passes") : (p.language === "en" ? "Revenue (TND)" : "Chiffre (TND)")
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Legend formatter={(value) => (value === "count" ? (p.language === "en" ? "Passes" : "Passes") : (p.language === "en" ? "Revenue (TND)" : "Chiffre (TND)"))} />
                      <Bar
                        xAxisId="count"
                        dataKey="count"
                        fill="hsl(var(--primary))"
                        name="count"
                        radius={[0, 4, 4, 0]}
                        activeBar={{ fill: "hsl(var(--primary))", stroke: "none" }}
                      />
                      <Bar
                        xAxisId="revenue"
                        dataKey="revenue"
                        fill="hsl(142 76% 36%)"
                        name="revenue"
                        radius={[0, 4, 4, 0]}
                        activeBar={{ fill: "hsl(142 76% 36%)", stroke: "none" }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Logs */}
        <TabsContent value="order-logs" className={AMBASSADOR_SALES_TAB_PANEL_CLASS}>
          <Card>
            <CardHeader>
              <CardTitle>{p.language === "en" ? "Order Logs" : "Journaux de Commandes"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{p.language === "en" ? "Order ID" : "ID Commande"}</TableHead>
                    <TableHead>{p.language === "en" ? "Action" : "Action"}</TableHead>
                    <TableHead>{p.language === "en" ? "Performed By" : "Effectué Par"}</TableHead>
                    <TableHead>{p.language === "en" ? "Type" : "Type"}</TableHead>
                    <TableHead>{p.language === "en" ? "Details" : "Détails"}</TableHead>
                    <TableHead>{p.language === "en" ? "Timestamp" : "Horodatage"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.orderLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {p.language === "en" ? "No order logs found" : "Aucun journal de commande trouvé"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    p.orderLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {log.order_id?.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>{log.performed_by || "System"}</TableCell>
                        <TableCell>{log.performed_by_type || "system"}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(log.details || {})}
                        </TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TabsContent>
    </TooltipProvider>
  );
}
