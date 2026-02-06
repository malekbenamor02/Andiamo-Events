/**
 * Admin Dashboard — Ambassador Sales tab (COD orders, order logs, performance).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, RefreshCw, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AmbassadorOrderFilters, AmbassadorFilterOptions, AmbassadorOrderLog, AmbassadorPerformanceReport } from "../types";

export interface CodOrder {
  id: string;
  status: string;
  user_name?: string;
  user_phone?: string;
  user_email?: string;
  total_price?: number | string;
  ambassador_id?: string;
  ambassador_name?: string;
  created_at: string;
  expires_at?: string;
  rejected_at?: string;
  passes?: Array<{ pass_type?: string; passName?: string; quantity?: number }>;
  pass_type?: string;
}

export interface AmbassadorSalesTabProps {
  language: "en" | "fr";
  salesSystemTab: string;
  setSalesSystemTab: (v: string) => void;
  orderFilters: AmbassadorOrderFilters;
  setOrderFilters: (f: AmbassadorOrderFilters | ((prev: AmbassadorOrderFilters) => AmbassadorOrderFilters)) => void;
  filterOptions: AmbassadorFilterOptions;
  filteredCodOrders: CodOrder[];
  selectedPassTypeTotal: number;
  loadingOrders: boolean;
  orderLogs: AmbassadorOrderLog[];
  performanceReports: AmbassadorPerformanceReport | null;
  onExportExcel: () => void;
  onRefresh: (statusFilter?: string) => void;
  onViewOrder: (order: CodOrder) => void;
  onViewAmbassador: (ambassadorId: string) => void;
}

export function AmbassadorSalesTab(p: AmbassadorSalesTabProps) {
  const { toast } = useToast();

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

  return (
    <TabsContent value="ambassador-sales" className="space-y-6">
      <Tabs value={p.salesSystemTab} onValueChange={p.setSalesSystemTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cod-ambassador-orders">
            {p.language === "en" ? "COD Ambassador Orders" : "Commandes COD Ambassadeur"}
          </TabsTrigger>
          <TabsTrigger value="order-logs">{p.language === "en" ? "Order Logs" : "Journaux"}</TabsTrigger>
          <TabsTrigger value="performance">{p.language === "en" ? "Performance" : "Performance"}</TabsTrigger>
        </TabsList>

        {/* COD Ambassador Orders */}
        <TabsContent value="cod-ambassador-orders" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {p.language === "en" ? "COD Ambassador Orders" : "Commandes COD Ambassadeur"}
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={p.onExportExcel} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    {p.language === "en" ? "Export Excel" : "Exporter Excel"}
                  </Button>
                  <Button
                    onClick={() => p.onRefresh(p.orderFilters.status || undefined)}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {p.language === "en" ? "Refresh" : "Actualiser"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex items-end gap-4 mb-4 pb-4 border-b">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
                  <div>
                    <Label className="text-xs mb-2">
                      {p.language === "en" ? "Order ID" : "ID Commande"}
                    </Label>
                    <Input
                      placeholder={p.language === "en" ? "Order ID (e.g., C29CA564)" : "ID Commande (ex: C29CA564)"}
                      value={p.orderFilters.orderId}
                      onChange={(e) =>
                        p.setOrderFilters({ ...p.orderFilters, orderId: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-2">{p.language === "en" ? "Status" : "Statut"}</Label>
                    <Select
                      value={p.orderFilters.status || undefined}
                      onValueChange={(value) => {
                        const newStatus = value === "all" || value === "" ? "" : value;
                        p.setOrderFilters({ ...p.orderFilters, status: newStatus });
                        p.onRefresh(newStatus || undefined);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={p.language === "en" ? "All Statuses" : "Tous les Statuts"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING_CASH">
                          {p.language === "en" ? "Pending Cash" : "En Attente Espèces"}
                        </SelectItem>
                        <SelectItem value="PENDING_ADMIN_APPROVAL">
                          {p.language === "en" ? "Pending Approval" : "En Attente d'Approbation"}
                        </SelectItem>
                        <SelectItem value="PAID">{p.language === "en" ? "Paid" : "Payé"}</SelectItem>
                        <SelectItem value="REJECTED">{p.language === "en" ? "Rejected" : "Rejeté"}</SelectItem>
                        <SelectItem value="CANCELLED">{p.language === "en" ? "Cancelled" : "Annulé"}</SelectItem>
                        <SelectItem value="REMOVED_BY_ADMIN">
                          {p.language === "en" ? "Removed by Admin" : "Retiré par l'administrateur"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-2">{p.language === "en" ? "Phone" : "Téléphone"}</Label>
                    <Input
                      placeholder={p.language === "en" ? "Search by phone..." : "Rechercher par téléphone..."}
                      value={p.orderFilters.phone}
                      onChange={(e) =>
                        p.setOrderFilters({ ...p.orderFilters, phone: e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-2">
                      {p.language === "en" ? "Ambassador" : "Ambassadeur"}
                    </Label>
                    <Select
                      value={p.orderFilters.ambassador || undefined}
                      onValueChange={(value) =>
                        p.setOrderFilters({ ...p.orderFilters, ambassador: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={p.language === "en" ? "All Ambassadors" : "Tous les Ambassadeurs"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]" side="bottom" avoidCollisions={false}>
                        {p.filterOptions.ambassadors.map((ambassador) => (
                          <SelectItem key={ambassador} value={ambassador}>
                            {ambassador}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-2">
                      {p.language === "en" ? "Pass Type" : "Type de Pass"}
                    </Label>
                    <Select
                      value={p.orderFilters.passType || undefined}
                      onValueChange={(value) =>
                        p.setOrderFilters({
                          ...p.orderFilters,
                          passType: value === "all" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={p.language === "en" ? "All Pass Types" : "Tous les Types"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]" side="bottom" avoidCollisions={false}>
                        <SelectItem value="all">
                          {p.language === "en" ? "All Pass Types" : "Tous les Types"}
                        </SelectItem>
                        {p.filterOptions.passTypes.map((passType) => (
                          <SelectItem key={passType} value={passType}>
                            {passType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {p.orderFilters.passType && (
                      <div className="mt-1 text-xs text-primary font-semibold">
                        {p.language === "en" ? "Total:" : "Total:"} {p.selectedPassTypeTotal}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
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
                  className="h-8 text-xs"
                >
                  <X className="w-4 h-4 mr-2" />
                  {p.language === "en" ? "Clear All" : "Tout Effacer"}
                </Button>
              </div>

              {p.loadingOrders ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {p.language === "en" ? "Loading orders..." : "Chargement des commandes..."}
                  </p>
                </div>
              ) : (
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
                        <TableHead className="py-2 whitespace-nowrap text-center">
                          {p.language === "en" ? "Actions" : "Actions"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.filteredCodOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                            {p.language === "en"
                              ? "No COD ambassador orders found"
                              : "Aucune commande COD ambassadeur trouvée"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        p.filteredCodOrders.map((order) => {
                          const passes = order.passes || [];
                          return (
                            <TableRow key={order.id} className="text-xs">
                              <TableCell className="py-2 text-center">
                                {passes.length > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {passes.map((px: { pass_type?: string; passName?: string; quantity?: number }, idx: number) => (
                                      <div
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/30 text-xs"
                                      >
                                        <span className="font-medium">{px.pass_type || px.passName}</span>
                                        <span className="text-muted-foreground">×{px.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs">{order.pass_type || "N/A"}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-center">{order.user_name || "N/A"}</TableCell>
                              <TableCell className="py-2 text-center">{order.user_phone || "N/A"}</TableCell>
                              <TableCell className="py-2 text-center text-xs">
                                {order.user_email ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyEmail(order.user_email!)}
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
                                {order.total_price
                                  ? `${parseFloat(String(order.total_price)).toFixed(2)} TND`
                                  : "N/A"}
                              </TableCell>
                              <TableCell className="py-2 text-center whitespace-nowrap">
                                {order.ambassador_id ? (
                                  <button
                                    type="button"
                                    onClick={() => p.onViewAmbassador(order.ambassador_id!)}
                                    className="text-primary hover:underline cursor-pointer text-xs"
                                  >
                                    {order.ambassador_name || "Unknown"}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <div className="flex justify-center items-center gap-2">
                                  <TooltipProvider>
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
                                  </TooltipProvider>
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
                                          { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
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
                                            : "text-yellow-500"
                                      )}
                                    >
                                      {new Date(order.expires_at).toLocaleString(
                                        p.language === "en" ? "en-US" : "fr-FR",
                                        { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
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
                              <TableCell className="py-2 text-center whitespace-nowrap text-xs">
                                {new Date(order.created_at).toLocaleDateString(p.language)}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-black hover:bg-gray-800 text-white border-none text-xs px-2 py-1 h-auto"
                                  onClick={() => p.onViewOrder(order)}
                                  title={
                                    p.language === "en"
                                      ? "View order details and manage actions"
                                      : "Voir les détails de la commande et gérer les actions"
                                  }
                                >
                                  <Eye className="w-3 h-3 mr-1 text-white" />
                                  {p.language === "en" ? "View" : "Voir"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Logs */}
        <TabsContent value="order-logs" className="mt-6">
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

        {/* Performance Reports */}
        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {p.language === "en" ? "Performance Reports" : "Rapports de Performance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {p.performanceReports ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {p.language === "en" ? "Total Orders" : "Total Commandes"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {p.performanceReports.totalOrders ?? 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {p.language === "en" ? "Success Rate" : "Taux de Réussite"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {p.performanceReports.successRate ?? 0}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {p.language === "en" ? "Avg Response Time" : "Temps de Réponse Moyen"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {p.performanceReports.avgResponseTime ?? 0} min
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {p.language === "en"
                    ? "Performance data will be displayed here"
                    : "Les données de performance seront affichées ici"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </TabsContent>
  );
}
