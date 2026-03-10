/**
 * Admin Dashboard — Online Orders tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useRef, useCallback, useEffect } from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { OnlineOrder, OnlineOrderFilters } from "../types";

export interface OnlineOrdersTabProps {
  language: "en" | "fr";
  onlineOrders: OnlineOrder[];
  onlineOrderFilters: OnlineOrderFilters;
  setOnlineOrderFilters: (v: OnlineOrderFilters | ((prev: OnlineOrderFilters) => OnlineOrderFilters)) => void;
  loadingOnlineOrders: boolean;
  onRefresh: () => void;
  onFetchWithFilters: (filters: OnlineOrderFilters) => void;
  onViewOrder: (order: OnlineOrder) => void;
  /** Pass type names from the selected event (event_passes.name). When empty, "All Types" only. */
  eventPassTypes?: string[];
}

/** Mask email like COD tab: first 3 of local + *** @ + last 4 of domain. */
function maskEmail(email: string) {
  if (!email || !email.includes("@")) return email;
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 3) {
    return `${localPart}***@${domain}`;
  }
  const visibleStart = localPart.substring(0, 3);
  const visibleEnd = domain.substring(domain.length - 4);
  return `${visibleStart}***@${visibleEnd}`;
}

export function OnlineOrdersTab({
  language,
  onlineOrders,
  onlineOrderFilters,
  setOnlineOrderFilters,
  loadingOnlineOrders,
  onRefresh,
  onFetchWithFilters,
  onViewOrder,
  eventPassTypes = [],
}: OnlineOrdersTabProps) {
  const { toast } = useToast();
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 350;

  const debouncedFetch = useCallback(
    (filters: OnlineOrderFilters) => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        fetchTimeoutRef.current = null;
        onFetchWithFilters(filters);
      }, DEBOUNCE_MS);
    },
    [onFetchWithFilters]
  );

  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  const handleCopyEmail = async (email: string) => {
    if (email === "N/A") return;
    try {
      await navigator.clipboard.writeText(email);
      toast({
        title: language === "en" ? "Copied!" : "Copié!",
        description:
          language === "en"
            ? "Email copied to clipboard"
            : "Email copié dans le presse-papiers",
        variant: "default",
      });
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  return (
    <TabsContent value="online-orders" className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {language === "en" ? "Online Orders" : "Commandes en Ligne"}
            </CardTitle>
            <Button onClick={onRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              {language === "en" ? "Refresh" : "Actualiser"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters: same names and order as COD, without Ambassador */}
          <div className="flex items-end gap-4 mb-4 pb-4 border-b">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              <div>
                <Label className="text-xs mb-2">
                  {language === "en" ? "Order Number" : "Numéro de Commande"}
                </Label>
                <Input
                  placeholder={language === "en" ? "Order Number (e.g., #807105)" : "Numéro (ex: #807105)"}
                  value={onlineOrderFilters.orderId}
                  onChange={(e) => {
                    const newFilters = { ...onlineOrderFilters, orderId: e.target.value };
                    setOnlineOrderFilters(newFilters);
                    debouncedFetch(newFilters);
                  }}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs mb-2">{language === "en" ? "Status" : "Statut"}</Label>
                <Select
                  value={onlineOrderFilters.status}
                  onValueChange={(value) => {
                    const newFilters = { ...onlineOrderFilters, status: value };
                    setOnlineOrderFilters(newFilters);
                    onFetchWithFilters(newFilters);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={language === "en" ? "All Statuses" : "Tous les Statuts"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === "en" ? "All Statuses" : "Tous les Statuts"}
                    </SelectItem>
                    <SelectItem value="PENDING_PAYMENT">
                      {language === "en" ? "Pending Payment" : "Paiement en Attente"}
                    </SelectItem>
                    <SelectItem value="PAID">{language === "en" ? "Paid" : "Payé"}</SelectItem>
                    <SelectItem value="FAILED">{language === "en" ? "Failed" : "Échoué"}</SelectItem>
                    <SelectItem value="REFUNDED">{language === "en" ? "Refunded" : "Remboursé"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-2">{language === "en" ? "Phone" : "Téléphone"}</Label>
                <Input
                  placeholder={language === "en" ? "Search by phone..." : "Rechercher par téléphone..."}
                  value={onlineOrderFilters.phone}
                  onChange={(e) => {
                    const newFilters = { ...onlineOrderFilters, phone: e.target.value };
                    setOnlineOrderFilters(newFilters);
                    debouncedFetch(newFilters);
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs mb-2">
                  {language === "en" ? "Pass Type" : "Type de Pass"}
                </Label>
                <Select
                  value={onlineOrderFilters.passType}
                  onValueChange={(value) => {
                    const newFilters = { ...onlineOrderFilters, passType: value };
                    setOnlineOrderFilters(newFilters);
                    onFetchWithFilters(newFilters);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={language === "en" ? "All Pass Types" : "Tous les Types"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]" side="bottom" avoidCollisions={false}>
                    <SelectItem value="all">
                      {language === "en" ? "All Pass Types" : "Tous les Types"}
                    </SelectItem>
                    {eventPassTypes.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const cleared = {
                  ...onlineOrderFilters,
                  orderId: "",
                  status: "all",
                  phone: "",
                  passType: "all",
                };
                setOnlineOrderFilters(cleared);
                onFetchWithFilters(cleared);
              }}
              className="h-8 text-xs"
            >
              <X className="w-4 h-4 mr-2" />
              {language === "en" ? "Clear All" : "Tout Effacer"}
            </Button>
          </div>

          {loadingOnlineOrders ? (
            <div className="text-center py-8">
              <Loader size="md" className="mx-auto mb-2" />
              <p className="text-muted-foreground">
                {language === "en"
                  ? "Loading orders..."
                  : "Chargement des commandes..."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Pass Types" : "Types de Pass"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Client Name" : "Nom Client"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Phone" : "Téléphone"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Email" : "Email"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Total Price" : "Prix Total"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center w-16">
                      {language === "en" ? "Status" : "Statut"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Created" : "Créé"}
                    </TableHead>
                    <TableHead className="py-2 whitespace-nowrap text-center">
                      {language === "en" ? "Actions" : "Actions"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {language === "en"
                          ? "No online orders found"
                          : "Aucune commande en ligne trouvée"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    onlineOrders.map((order) => {
                      const orderPasses = order.order_passes as { pass_type?: string; quantity?: number; price?: number }[] | undefined;
                      let passItems: { name: string; quantity: number }[] = [];
                      if (orderPasses && orderPasses.length > 0) {
                        passItems = orderPasses.map((p) => ({
                          name: p.pass_type ?? "—",
                          quantity: p.quantity ?? 0,
                        }));
                      } else if (order.pass_type === "mixed" && order.notes) {
                        try {
                          const notesData = typeof order.notes === "string" ? JSON.parse(order.notes) : order.notes;
                          if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                            passItems = notesData.all_passes.map((p: { quantity?: number; passType?: string }) => ({
                              name: p.passType ?? "STANDARD",
                              quantity: p.quantity ?? 0,
                            }));
                          } else {
                            passItems = [{ name: order.pass_type ?? "STANDARD", quantity: order.quantity ?? 0 }];
                          }
                        } catch {
                          passItems = [{ name: order.pass_type ?? "STANDARD", quantity: order.quantity ?? 0 }];
                        }
                      } else {
                        passItems = [{ name: order.pass_type ?? "STANDARD", quantity: order.quantity ?? 0 }];
                      }
                      const email = order.user_email ?? order.email ?? "N/A";
                      // Optional: parse fee breakdown to show a tooltip on total price.
                      // Prefer dedicated columns (total_with_fees/fee_amount) and fall back to notes.payment_fees.
                      let subtotalWithoutFees: number | null = null;
                      let feeAmount: number | null = null;
                      try {
                        if (typeof order.total_with_fees === "number") {
                          if (typeof order.fee_amount === "number") {
                            feeAmount = order.fee_amount;
                            subtotalWithoutFees = Number((order.total_with_fees - order.fee_amount).toFixed(3));
                          }
                        }
                        if (subtotalWithoutFees === null || feeAmount === null) {
                          if (order.notes) {
                            const notesData = typeof order.notes === "string" ? JSON.parse(order.notes) : order.notes;
                            const fees = (notesData as any)?.payment_fees;
                            if (fees && typeof fees.subtotal === "number" && typeof fees.fee_amount === "number") {
                              subtotalWithoutFees = fees.subtotal;
                              feeAmount = fees.fee_amount;
                            }
                          }
                        }
                      } catch {
                        // ignore parse errors - fallback to showing total_price only
                      }
                      const statusMap: Record<string, string> = {
                        PENDING_PAYMENT: language === "en" ? "Pending Payment" : "Paiement en Attente",
                        PAID: language === "en" ? "Paid" : "Payé",
                        FAILED: language === "en" ? "Failed" : "Échoué",
                        REFUNDED: language === "en" ? "Refunded" : "Remboursé",
                      };
                      const status = order.payment_status ?? "PENDING_PAYMENT";
                      const getStatusColor = () => {
                        if (status === "PAID") return "bg-green-500";
                        if (status === "FAILED" || status === "REFUNDED") return "bg-red-500";
                        if (status === "PENDING_PAYMENT") return "bg-yellow-500";
                        return "bg-gray-500";
                      };
                      return (
                        <TableRow key={order.id} className="text-xs">
                          <TableCell className="py-2 text-center">
                            {passItems.length > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                {passItems.map((px, idx) => (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/30 text-xs"
                                  >
                                    <span className="font-medium">{px.name}</span>
                                    <span className="text-muted-foreground">×{px.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            {order.user_name ?? order.customer_name ?? "N/A"}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            {order.user_phone ?? order.phone ?? "N/A"}
                          </TableCell>
                          <TableCell className="py-2 text-center text-xs">
                            {email !== "N/A" ? (
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(email)}
                                className="hover:text-primary hover:underline cursor-pointer"
                                title={language === "en" ? "Click to copy email" : "Cliquer pour copier l'email"}
                              >
                                {maskEmail(email)}
                              </button>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center text-xs font-semibold">
                            {order.total_price != null ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help inline-block">
                                      {Number(order.total_with_fees ?? order.total_price).toFixed(2)} TND
                                    </span>
                                  </TooltipTrigger>
                                  {subtotalWithoutFees != null && feeAmount != null ? (
                                    <TooltipContent className="text-xs space-y-1">
                                      <p className="font-semibold">
                                        {language === "en" ? "Total with fees" : "Total avec frais"}:{" "}
                                        {Number(order.total_price).toFixed(2)} TND
                                      </p>
                                      <p>
                                        {language === "en" ? "Subtotal (without fees)" : "Sous-total (hors frais)"}:{" "}
                                        {subtotalWithoutFees.toFixed(2)} TND
                                      </p>
                                      <p>
                                        {language === "en" ? "Fees" : "Frais"}: {feeAmount.toFixed(2)} TND
                                      </p>
                                    </TooltipContent>
                                  ) : (
                                    <TooltipContent className="text-xs">
                                      <p className="font-semibold">
                                        {language === "en" ? "Total amount (including fees)" : "Montant total (frais inclus)"}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={cn("w-3 h-3 rounded-full cursor-help", getStatusColor())} />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{statusMap[status] ?? status}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-center whitespace-nowrap text-xs">
                            {(() => {
                              const d = new Date(order.created_at);
                              const day = String(d.getDate()).padStart(2, "0");
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              return `${day}/${month}/${d.getFullYear()}`;
                            })()}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-black hover:bg-gray-800 text-white border-none text-xs px-2 py-1 h-auto"
                              onClick={() => onViewOrder(order)}
                              title={order.ville ? `${language === "en" ? "Neighborhood" : "Quartier"}: ${order.ville}` : undefined}
                            >
                              <Eye className="w-3 h-3 mr-1 text-white" />
                              {language === "en" ? "View" : "Voir"}
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
  );
}
