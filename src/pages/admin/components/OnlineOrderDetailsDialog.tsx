/**
 * Admin Dashboard — Online order details dialog.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Package,
  FileText,
  Activity,
  Database,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  User,
  Phone,
  Mail,
  MapPin,
  Ticket,
  CreditCard,
  Settings,
  ArrowDown,
  Send,
  Copy,
  Edit,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AdminOrderQrTicketsSection } from "./AdminOrderQrTicketsSection";

export interface OnlineOrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number?: number | string | null;
    payment_status?: string;
    source?: string;
    created_at: string;
    updated_at?: string;
    total_price?: number;
    user_name?: string;
    customer_name?: string;
    user_phone?: string;
    phone?: string;
    user_email?: string;
    email?: string;
    city?: string;
    ville?: string;
    pass_type?: string;
    quantity?: number;
    notes?: string | Record<string, unknown>;
    order_passes?: Array<{ pass_type?: string; quantity?: number; price?: number }>;
    transaction_id?: string;
    payment_gateway_reference?: string;
    payment_response_data?: unknown;
    payment_confirm_response?: unknown;
    fee_amount?: number | null;
    total_with_fees?: number | null;
  } | null;
  language: "en" | "fr";
  onUpdateStatus: (orderId: string, newStatus: "PENDING_PAYMENT" | "PAID" | "FAILED" | "REFUNDED" | "EXPIRED") => void | Promise<void>;
  onUpdateEmail: (orderId: string, newEmail: string) => void | Promise<void>;
  /** Optional: resend ticket email (only shown for paid orders when provided) */
  onResendTicket?: (orderId: string) => void | Promise<void>;
  /** When true, loads and shows QR ticket images and statuses (API allows super_admin only). */
  isSuperAdmin?: boolean;
}

export function OnlineOrderDetailsDialog({
  open,
  onOpenChange,
  order,
  language,
  onUpdateStatus,
  onUpdateEmail,
  onResendTicket,
  isSuperAdmin = false,
}: OnlineOrderDetailsDialogProps) {
  const { toast } = useToast();
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    // Only start close gesture near the left edge (prevents accidental closes while scrolling).
    if (t.clientX > 40) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;

    // Left-to-right swipe to close (ignore mostly-vertical swipes / too-slow gestures).
    if (dx < 90) return;
    if (Math.abs(dy) > 60) return;
    if (dt > 900) return;

    onOpenChange(false);
  };

  const getActionCodeDescription = (paymentConfirmResponse: unknown): string | null => {
    const obj = paymentConfirmResponse as any;
    const actionCodeDescription =
      obj?.actionCodeDescription ??
      obj?.action_code_description ??
      obj?.actionCodeDescriptio ??
      obj?.action_code_desc;
    return typeof actionCodeDescription === "string" && actionCodeDescription.trim().length > 0
      ? actionCodeDescription
      : null;
  };

  // Safely parse fee breakdown, preferring dedicated columns and falling back to notes JSON.
  let paymentFees: { fee_rate?: number; fee_amount?: number; subtotal?: number; total_with_fees?: number } | null = null;
  try {
    if (order) {
      // Prefer new columns when present
      if (typeof order.total_with_fees === "number") {
        const feeAmount = typeof order.fee_amount === "number" ? order.fee_amount : undefined;
        const subtotal =
          typeof feeAmount === "number"
            ? Number((order.total_with_fees - feeAmount).toFixed(3))
            : undefined;
        paymentFees = {
          fee_rate: typeof feeAmount === "number" && typeof subtotal === "number" && subtotal > 0
            ? Number((feeAmount / subtotal).toFixed(3))
            : undefined,
          fee_amount: feeAmount,
          subtotal,
          total_with_fees: order.total_with_fees,
        };
      }

    }
    if (!paymentFees && order?.notes) {
      const raw = order.notes as any;
      const notesData = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (notesData?.payment_fees) {
        const fees = notesData.payment_fees;
        paymentFees = {
          fee_rate: typeof fees.fee_rate === "number" ? fees.fee_rate : undefined,
          fee_amount: typeof fees.fee_amount === "number" ? fees.fee_amount : undefined,
          subtotal: typeof fees.subtotal === "number" ? fees.subtotal : undefined,
          total_with_fees: typeof fees.total_with_fees === "number" ? fees.total_with_fees : undefined,
        };
      }
    }
  } catch (e) {
    // If notes cannot be parsed, just ignore fee breakdown for this view
    paymentFees = null;
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: language === "en" ? "Copied" : "Copié", description: `${label} ${language === "en" ? "copied to clipboard" : "copié dans le presse-papiers"}`, variant: "default" }),
      () => toast({ title: language === "en" ? "Copy failed" : "Échec de la copie", variant: "destructive" })
    );
  };

  const CopyButton = ({ text, label }: { text: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      onClick={() => handleCopy(text, label)}
      title={language === "en" ? "Copy" : "Copier"}
    >
      <Copy className="w-4 h-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-[100vw] left-0 translate-x-0 p-3 sm:p-6 sm:left-1/2 sm:translate-x-[-50%] sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <DialogHeader>
          <DialogTitle>
            {language === "en" ? "Online Order Details" : "Détails de la Commande en Ligne"}
          </DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4 sm:space-y-6 w-full break-words">
            {/* Order Summary Card */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  {language === "en" ? "Order Summary" : "Résumé de la Commande"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {language === "en" ? "Order Number" : "Numéro de Commande"}
                    </Label>
                    <p className="font-mono text-sm break-all">
                      #{order.order_number != null ? String(order.order_number) : order.id.length > 8 ? order.id.slice(0, 8).toUpperCase() : order.id}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {language === "en" ? "Payment Status" : "Statut de Paiement"}
                    </Label>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "w-3 h-3 rounded-full cursor-help",
                                order.payment_status === "PAID" ? "bg-green-500" :
                                order.payment_status === "EXPIRED" ? "bg-blue-500" :
                                order.payment_status === "FAILED" || order.payment_status === "REFUNDED" ? "bg-red-500" :
                                "bg-yellow-500"
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            {order.payment_status === "FAILED" ? (
                              (() => {
                                const msg = getActionCodeDescription(order.payment_confirm_response);
                                return (
                                  <div className="space-y-1">
                                    <p>{order.payment_status || "FAILED"}</p>
                                    {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
                                  </div>
                                );
                              })()
                            ) : (
                              <p>{order.payment_status || "PENDING_PAYMENT"}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Badge
                        variant={
                          order.payment_status === "PAID" ? "default" :
                          order.payment_status === "EXPIRED" ? "default" :
                          order.payment_status === "FAILED" || order.payment_status === "REFUNDED" ? "destructive" :
                          "outline"
                        }
                        className={
                          order.payment_status === "PAID" ? "bg-green-500 text-white border-green-600" :
                          order.payment_status === "EXPIRED" ? "bg-blue-500 text-white border-blue-600" :
                          order.payment_status === "FAILED" || order.payment_status === "REFUNDED" ? "bg-red-500 text-white border-red-600" :
                          ""
                        }
                      >
                        {order.payment_status || "PENDING_PAYMENT"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {language === "en" ? "Order Type" : "Type de Commande"}
                    </Label>
                    <Badge variant="outline" className="font-normal">
                      {order.source === "platform_online" ? (language === "en" ? "Platform Online" : "Plateforme En Ligne") : order.source}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {language === "en" ? "Created At" : "Créé Le"}
                    </Label>
                    <p className="text-sm">{(() => {
                      const d = new Date(order.created_at);
                      const day = String(d.getDate()).padStart(2, "0");
                      const month = String(d.getMonth() + 1).padStart(2, "0");
                      return `${day}/${month}/${d.getFullYear()}, ${d.toLocaleTimeString(language === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
                    })()}</p>
                  </div>
                  {order.updated_at && order.updated_at !== order.created_at && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {language === "en" ? "Updated At" : "Mis à Jour Le"}
                      </Label>
                      <p className="text-sm">{(() => {
                        const d = new Date(order.updated_at);
                        const day = String(d.getDate()).padStart(2, "0");
                        const month = String(d.getMonth() + 1).padStart(2, "0");
                        return `${day}/${month}/${d.getFullYear()}, ${d.toLocaleTimeString(language === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
                      })()}</p>
                    </div>
                  )}
                  {order.total_price && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {language === "en" ? "Total Amount" : "Montant Total"}
                      </Label>
                      <p className="text-lg font-bold text-primary">
                        {(order.total_with_fees ?? order.total_price).toFixed(2)} TND
                      </p>
                      {paymentFees?.subtotal != null && paymentFees.fee_amount != null && (
                        <p className="text-xs text-muted-foreground">
                          {language === "en"
                            ? `Subtotal (without fees): ${paymentFees.subtotal.toFixed(2)} TND · Fees: ${paymentFees.fee_amount.toFixed(2)} TND`
                            : `Sous-total (hors frais) : ${paymentFees.subtotal.toFixed(2)} TND · Frais : ${paymentFees.fee_amount.toFixed(2)} TND`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  {language === "en" ? "Customer Information" : "Informations Client"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {language === "en" ? "Name" : "Nom"}
                    </Label>
                    <p className="font-semibold text-base">{order.user_name || order.customer_name || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {language === "en" ? "Phone" : "Téléphone"}
                    </Label>
                    <p className="text-base">{order.user_phone || order.phone || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {language === "en" ? "Email" : "Email"}
                    </Label>
                    {isEditingEmail ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={editingEmailValue}
                          onChange={(e) => setEditingEmailValue(e.target.value)}
                          className="flex-1 text-base"
                          placeholder={language === "en" ? "Enter email address" : "Entrez l'adresse email"}
                          disabled={updatingEmail}
                        />
                        <Button
                          size="sm"
                          variant="default"
                          onClick={async () => {
                            const nextEmail = editingEmailValue.trim();
                            if (!nextEmail) {
                              toast({
                                title: language === "en" ? "Error" : "Erreur",
                                description: language === "en" ? "Email cannot be empty" : "L'email ne peut pas etre vide",
                                variant: "destructive",
                              });
                              return;
                            }

                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(nextEmail)) {
                              toast({
                                title: language === "en" ? "Error" : "Erreur",
                                description: language === "en" ? "Invalid email format" : "Format d'email invalide",
                                variant: "destructive",
                              });
                              return;
                            }

                            setUpdatingEmail(true);
                            try {
                              await onUpdateEmail(order.id, nextEmail);
                              toast({
                                title: language === "en" ? "Success" : "Succes",
                                description: language === "en" ? "Email updated successfully" : "Email mis a jour avec succes",
                                variant: "default",
                              });
                              setIsEditingEmail(false);
                              setEditingEmailValue("");
                            } catch (error: any) {
                              console.error("Error updating email:", error);
                              toast({
                                title: language === "en" ? "Error" : "Erreur",
                                description: error?.message || (language === "en" ? "Failed to update email" : "Echec de la mise a jour de l'email"),
                                variant: "destructive",
                              });
                            } finally {
                              setUpdatingEmail(false);
                            }
                          }}
                          disabled={updatingEmail}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {language === "en" ? "Save" : "Enregistrer"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingEmail(false);
                            setEditingEmailValue("");
                          }}
                          disabled={updatingEmail}
                        >
                          <X className="w-4 h-4 mr-1" />
                          {language === "en" ? "Cancel" : "Annuler"}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-base break-all flex-1">{order.user_email || order.email || "N/A"}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingEmailValue(order.user_email || order.email || "");
                            setIsEditingEmail(true);
                          }}
                          className="h-8 w-8 p-0"
                          title={language === "en" ? "Edit email" : "Modifier l'email"}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {language === "en" ? "City" : "Ville"}
                    </Label>
                    <p className="text-base">{order.city || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {language === "en" ? "Neighborhood" : "Quartier"}
                    </Label>
                    <p className="text-base">{order.ville || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Passes List */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-primary" />
                  {language === "en" ? "Passes Purchased" : "Passes Achetés"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Prefer order_passes (from pass stock); fallback to notes.all_passes
                  let allPasses: { passType?: string; pass_type?: string; quantity?: number; price?: number }[] = [];
                  if (order.order_passes && order.order_passes.length > 0) {
                    allPasses = order.order_passes.map((p) => ({
                      passType: p.pass_type,
                      pass_type: p.pass_type,
                      quantity: p.quantity,
                      price: p.price,
                    }));
                  } else {
                    try {
                      if (order.notes) {
                        const notesData = typeof order.notes === "string"
                          ? JSON.parse(order.notes)
                          : order.notes;
                        if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                          allPasses = notesData.all_passes;
                        }
                      }
                    } catch (e) {
                      console.error("Error parsing notes:", e);
                    }
                  }

                  if (allPasses.length > 0) {
                    const calculatedTotal = allPasses.reduce((sum: number, pass: { price?: number; quantity?: number }) => {
                      return sum + ((pass.price || 0) * (pass.quantity || 0));
                    }, 0);
                    const passName = (p: { passType?: string; pass_type?: string }) => p.pass_type ?? p.passType ?? "STANDARD";

                    return (
                      <div className="w-full">
                        {/* Desktop: keep table */}
                        <div className="hidden md:block">
                          <Table className="w-full table-fixed">
                            <TableHeader>
                              <TableRow>
                                <TableHead>{language === "en" ? "Pass Type" : "Type Pass"}</TableHead>
                                <TableHead>{language === "en" ? "Quantity" : "Quantité"}</TableHead>
                                <TableHead>{language === "en" ? "Unit Price" : "Prix Unitaire"}</TableHead>
                                <TableHead>{language === "en" ? "Subtotal" : "Sous-total"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allPasses.map((pass: { passType?: string; pass_type?: string; quantity?: number; price?: number }, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    <Badge variant={passName(pass).toLowerCase() === "vip" ? "default" : "secondary"}>
                                      {passName(pass).toUpperCase()}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-semibold">{pass.quantity || 0}</TableCell>
                                  <TableCell>{pass.price?.toFixed(2) || "0.00"} TND</TableCell>
                                  <TableCell className="font-semibold">
                                    {((pass.quantity || 0) * (pass.price || 0)).toFixed(2)} TND
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="font-bold border-t-2">
                                <TableCell colSpan={3} className="text-right">
                                  {language === "en" ? "Subtotal (without fees)" : "Sous-total (hors frais)"}
                                </TableCell>
                                <TableCell className="text-lg">
                                  {calculatedTotal.toFixed(2)} TND
                                </TableCell>
                              </TableRow>
                              {paymentFees?.fee_amount != null && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-right text-sm">
                                    {language === "en" ? "Fees" : "Frais"}
                                  </TableCell>
                                  <TableCell className="text-sm font-semibold">
                                    {paymentFees.fee_amount.toFixed(2)} TND
                                  </TableCell>
                                </TableRow>
                              )}
                              {paymentFees?.total_with_fees != null && (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-right text-sm">
                                    {language === "en" ? "Total (incl. fees)" : "Total (frais inclus)"}
                                  </TableCell>
                                  <TableCell className="text-sm font-semibold">
                                    {paymentFees.total_with_fees.toFixed(2)} TND
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile: stacked cards */}
                        <div className="md:hidden space-y-2">
                          {allPasses.map((pass: { passType?: string; pass_type?: string; quantity?: number; price?: number }, index: number) => {
                            const qty = pass.quantity || 0;
                            const unit = pass.price || 0;
                            const subtotal = qty * unit;
                            const label = passName(pass).toUpperCase();

                            return (
                              <div
                                key={index}
                                className="rounded-lg border border-border/60 bg-muted/30 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <Badge variant={passName(pass).toLowerCase() === "vip" ? "default" : "secondary"}>
                                    {label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{subtotal.toFixed(2)} TND</span>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">
                                      {language === "en" ? "Quantity" : "Quantité"}
                                    </Label>
                                    <p className="font-semibold">{qty}</p>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">
                                      {language === "en" ? "Unit Price" : "Prix Unitaire"}
                                    </Label>
                                    <p className="font-semibold">{unit.toFixed(2)} TND</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          <div className="pt-2 border-t border-border">
                            <div className="text-sm font-semibold text-muted-foreground">
                              {language === "en" ? "Subtotal (without fees)" : "Sous-total (hors frais)"}
                            </div>
                            <div className="text-base font-semibold">
                              {calculatedTotal.toFixed(2)} TND
                            </div>
                          </div>

                          {paymentFees?.fee_amount != null && (
                            <div className="space-y-0.5">
                              <div className="text-sm text-muted-foreground">
                                {language === "en" ? "Fees" : "Frais"}
                              </div>
                              <div className="text-sm font-semibold">
                                {paymentFees.fee_amount.toFixed(2)} TND
                              </div>
                            </div>
                          )}

                          {paymentFees?.total_with_fees != null && (
                            <div className="space-y-0.5">
                              <div className="text-sm text-muted-foreground">
                                {language === "en" ? "Total (incl. fees)" : "Total (frais inclus)"}
                              </div>
                              <div className="text-sm font-semibold">
                                {paymentFees.total_with_fees.toFixed(2)} TND
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-muted-foreground">{language === "en" ? "Pass Type" : "Type Pass"}</Label>
                          <p className="font-semibold uppercase">{order.pass_type}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">{language === "en" ? "Quantity" : "Quantité"}</Label>
                          <p className="font-semibold">{order.quantity}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">{language === "en" ? "Total Price" : "Prix Total"}</Label>
                          <p className="font-semibold text-lg">{order.total_price?.toFixed(2) || "0.00"} TND</p>
                        </div>
                      </div>
                    );
                  }
                })()}
              </CardContent>
            </Card>

            {/* Payment Gateway Information */}
            {(order.transaction_id || order.payment_gateway_reference || order.payment_response_data) && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    {language === "en" ? "Payment Gateway Information" : "Informations Passerelle de Paiement"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {order.transaction_id && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {language === "en" ? "Transaction ID" : "ID Transaction"}
                        </Label>
                        <p className="font-mono text-sm break-all">{order.transaction_id}</p>
                      </div>
                    )}
                    {order.payment_gateway_reference && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {language === "en" ? "Payment Gateway Reference" : "Référence Passerelle"}
                        </Label>
                        <p className="font-mono text-sm break-all">{order.payment_gateway_reference}</p>
                      </div>
                    )}
                    {order.payment_response_data && (
                      <div className="md:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {language === "en" ? "Payment Response Data" : "Données de Réponse"}
                          </Label>
                          <CopyButton
                            text={JSON.stringify(order.payment_response_data, null, 2)}
                            label={language === "en" ? "Payment Response Data" : "Données de Réponse"}
                          />
                        </div>
                        <pre
                          className="mt-2 p-3 bg-background border rounded-lg text-xs overflow-x-auto overflow-y-auto max-h-40 whitespace-pre-wrap break-all w-full"
                          style={{ WebkitOverflowScrolling: "touch" }}
                        >
                          {JSON.stringify(order.payment_response_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Logs Section */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {language === "en" ? "Payment Logs" : "Journaux de Paiement"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.payment_confirm_response ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {language === "en" ? "ClicToPay getOrderStatus Response" : "Réponse ClicToPay getOrderStatus"}
                      </Label>
                      <CopyButton
                        text={JSON.stringify(order.payment_confirm_response, null, 2)}
                        label={language === "en" ? "Payment Logs" : "Journaux de Paiement"}
                      />
                    </div>
                    <pre
                      className="mt-2 p-3 bg-background border rounded-lg text-xs overflow-x-auto overflow-y-auto max-h-40 whitespace-pre-wrap break-all w-full"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      {JSON.stringify(order.payment_confirm_response, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-background border rounded-lg text-center text-muted-foreground">
                    <p className="text-sm">
                      {language === "en"
                        ? "Payment logs will appear here after the payment confirmation (return from ClicToPay)."
                        : "Les journaux de paiement apparaîtront ici après la confirmation du paiement (retour de ClicToPay)."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Actions */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  {language === "en" ? "Admin Actions" : "Actions Administrateur"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      toast({
                        title: language === "en" ? "Coming Soon" : "Bientôt Disponible",
                        description: language === "en" ? "Refund will be available soon." : "Le remboursement sera bientôt disponible.",
                        variant: "default",
                      });
                    }}
                  >
                    <ArrowDown className="w-4 h-4 mr-2" />
                    {language === "en" ? "Mark as Refunded" : "Marquer comme Remboursé"}
                  </Button>
                  {order.payment_status === "PAID" && onResendTicket && (
                    <Button
                      variant="outline"
                      onClick={() => onResendTicket(order.id)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {language === "en" ? "Resend Email" : "Renvoyer l'Email"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <AdminOrderQrTicketsSection
              orderId={order.id}
              open={open}
              language={language}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
