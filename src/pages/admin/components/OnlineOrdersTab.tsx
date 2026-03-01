/**
 * Admin Dashboard — Online Orders tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Calendar as CalendarIcon, Copy, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/constants";
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

/** Hide most of email in table; full email is copyable on click. */
function truncateEmail(email: string) {
  if (email === "N/A" || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const showLocal = local.length <= 2 ? local + "***" : local.substring(0, 2) + "***";
  const dotIdx = domain.indexOf(".");
  const baseDomain = dotIdx >= 0 ? domain.substring(0, dotIdx) : domain;
  const suffix = dotIdx >= 0 ? domain.substring(dotIdx) : "";
  const showDomain = (baseDomain.length <= 2 ? baseDomain : baseDomain.substring(0, 2) + "***") + suffix;
  return `${showLocal}@${showDomain}`;
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Select
              value={onlineOrderFilters.status}
              onValueChange={(value) => {
                const newFilters = { ...onlineOrderFilters, status: value };
                setOnlineOrderFilters(newFilters);
                onFetchWithFilters(newFilters);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    language === "en"
                      ? "Payment Status"
                      : "Statut de Paiement"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Statuses" : "Tous les Statuts"}
                </SelectItem>
                <SelectItem value="PENDING_PAYMENT">
                  {language === "en" ? "Pending Payment" : "Paiement en Attente"}
                </SelectItem>
                <SelectItem value="PAID">
                  {language === "en" ? "Paid" : "Payé"}
                </SelectItem>
                <SelectItem value="FAILED">
                  {language === "en" ? "Failed" : "Échoué"}
                </SelectItem>
                <SelectItem value="REFUNDED">
                  {language === "en" ? "Refunded" : "Remboursé"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={onlineOrderFilters.city}
              onValueChange={(value) => {
                const newFilters = { ...onlineOrderFilters, city: value };
                setOnlineOrderFilters(newFilters);
                onFetchWithFilters(newFilters);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={language === "en" ? "City" : "Ville"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Cities" : "Toutes les Villes"}
                </SelectItem>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={onlineOrderFilters.passType}
              onValueChange={(value) => {
                const newFilters = { ...onlineOrderFilters, passType: value };
                setOnlineOrderFilters(newFilters);
                onFetchWithFilters(newFilters);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    language === "en" ? "Pass Type" : "Type de Pass"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "en" ? "All Types" : "Tous les Types"}
                </SelectItem>
                {eventPassTypes.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={
                language === "en"
                  ? "Order ID (e.g., 98C1E3AC)"
                  : "ID Commande (ex: 98C1E3AC)"
              }
              value={onlineOrderFilters.orderId}
              onChange={(e) => {
                const newFilters = {
                  ...onlineOrderFilters,
                  orderId: e.target.value,
                };
                setOnlineOrderFilters(newFilters);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onFetchWithFilters(onlineOrderFilters);
                }
              }}
              onBlur={() => onFetchWithFilters(onlineOrderFilters)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {language === "en" ? "Date Range" : "Plage de Dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div className="p-4 space-y-4">
                    <div>
                      <Label>{language === "en" ? "From" : "De"}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            {onlineOrderFilters.dateFrom
                              ? format(onlineOrderFilters.dateFrom, "PPP")
                              : (language === "en" ? "Pick a date" : "Choisir une date")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={onlineOrderFilters.dateFrom ?? undefined}
                            onSelect={(date) => {
                              const newFilters = {
                                ...onlineOrderFilters,
                                dateFrom: date ?? null,
                              };
                              setOnlineOrderFilters(newFilters);
                              onFetchWithFilters(newFilters);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>{language === "en" ? "To" : "À"}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            {onlineOrderFilters.dateTo
                              ? format(onlineOrderFilters.dateTo, "PPP")
                              : (language === "en" ? "Pick a date" : "Choisir une date")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={onlineOrderFilters.dateTo ?? undefined}
                            onSelect={(date) => {
                              const newFilters = {
                                ...onlineOrderFilters,
                                dateTo: date ?? null,
                              };
                              setOnlineOrderFilters(newFilters);
                              onFetchWithFilters(newFilters);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newFilters = {
                          ...onlineOrderFilters,
                          dateFrom: null,
                          dateTo: null,
                        };
                        setOnlineOrderFilters(newFilters);
                        onFetchWithFilters(newFilters);
                      }}
                      className="w-full"
                    >
                      {language === "en" ? "Clear Dates" : "Effacer les Dates"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {language === "en" ? "Customer Name" : "Nom du Client"}
                  </TableHead>
                  <TableHead>
                    {language === "en" ? "Phone" : "Téléphone"}
                  </TableHead>
                  <TableHead>{language === "en" ? "Email" : "Email"}</TableHead>
                  <TableHead>{language === "en" ? "Passes" : "Passes"}</TableHead>
                  <TableHead>
                    {language === "en" ? "Total Price" : "Prix Total"}
                  </TableHead>
                  <TableHead>{language === "en" ? "City" : "Ville"}</TableHead>
                  <TableHead>
                    {language === "en"
                      ? "Payment Status"
                      : "Statut Paiement"}
                  </TableHead>
                  <TableHead>
                    {language === "en" ? "Created" : "Créé"}
                  </TableHead>
                  <TableHead>
                    {language === "en" ? "Actions" : "Actions"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onlineOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      {language === "en"
                        ? "No online orders found"
                        : "Aucune commande en ligne trouvée"}
                    </TableCell>
                  </TableRow>
                ) : (
                  onlineOrders.map((order) => {
                    // Pass display: prefer order_passes (names + prices from pass stock), else notes all_passes, else order fields
                    let passesDisplay: string;
                    const orderPasses = order.order_passes as { pass_type?: string; quantity?: number; price?: number }[] | undefined;
                    if (orderPasses && orderPasses.length > 0) {
                      passesDisplay = orderPasses
                        .map(
                          (p) =>
                            `${p.quantity ?? 0}x ${(p.pass_type ?? "—").toUpperCase()} (${(p.price ?? 0).toFixed(0)} TND)`
                        )
                        .join(", ");
                    } else if (order.pass_type === "mixed" && order.notes) {
                      try {
                        const notesData =
                          typeof order.notes === "string"
                            ? JSON.parse(order.notes)
                            : order.notes;
                        if (
                          notesData?.all_passes &&
                          Array.isArray(notesData.all_passes)
                        ) {
                          passesDisplay = notesData.all_passes
                            .map(
                              (p: { quantity?: number; passType?: string; price?: number }) =>
                                `${p.quantity ?? 0}x ${(p.passType ?? "STANDARD").toUpperCase()}${p.price != null ? ` (${Number(p.price).toFixed(0)} TND)` : ""}`
                            )
                            .join(", ");
                        } else {
                          passesDisplay = `${order.quantity ?? 0}x ${(order.pass_type ?? "STANDARD").toUpperCase()}`;
                        }
                      } catch {
                        passesDisplay = `${order.quantity ?? 0}x ${(order.pass_type ?? "STANDARD").toUpperCase()}`;
                      }
                    } else {
                      passesDisplay = `${order.quantity ?? 0}x ${(order.pass_type ?? "STANDARD").toUpperCase()}`;
                    }
                    const email =
                      order.user_email ?? order.email ?? "N/A";
                    const statusMap: Record<string, string> = {
                      PENDING_PAYMENT:
                        language === "en"
                          ? "Pending Payment"
                          : "Paiement en Attente",
                      PAID: language === "en" ? "Paid" : "Payé",
                      FAILED: language === "en" ? "Failed" : "Échoué",
                      REFUNDED:
                        language === "en" ? "Refunded" : "Remboursé",
                    };
                    const status =
                      order.payment_status ?? "PENDING_PAYMENT";

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          {order.user_name ??
                            order.customer_name ??
                            "N/A"}
                        </TableCell>
                        <TableCell>
                          {order.user_phone ?? order.phone ?? "N/A"}
                        </TableCell>
                        <TableCell>
                          <div
                            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors group"
                            onClick={() => handleCopyEmail(email)}
                            title={
                              email !== "N/A"
                                ? (language === "en"
                                    ? "Click to copy email"
                                    : "Cliquer pour copier l'email")
                                : ""
                            }
                          >
                            <span className="text-sm">
                              {truncateEmail(email)}
                            </span>
                            {email !== "N/A" && (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {passesDisplay}
                        </TableCell>
                        <TableCell>
                          {(order.total_price ?? 0).toFixed(2)} TND
                        </TableCell>
                        <TableCell>{order.city ?? "N/A"}</TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "w-3 h-3 rounded-full cursor-help transition-opacity hover:opacity-80",
                                    status === "PAID" && "bg-green-500",
                                    (status === "FAILED" ||
                                      status === "REFUNDED") &&
                                      "bg-red-500",
                                    status === "PENDING_PAYMENT" &&
                                      "bg-yellow-500"
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{statusMap[status] ?? status}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{format(new Date(order.created_at), "PP")}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), "p")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewOrder(order)}
                            title={order.ville ? `${language === "en" ? "Neighborhood" : "Quartier"}: ${order.ville}` : undefined}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {language === "en" ? "View" : "Voir"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
