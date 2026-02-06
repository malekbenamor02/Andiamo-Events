/**
 * Admin Dashboard — Online order details dialog.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  CheckCircle,
  XCircle,
  ArrowDown,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface OnlineOrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
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
    transaction_id?: string;
    payment_gateway_reference?: string;
    payment_response_data?: unknown;
  } | null;
  language: "en" | "fr";
  onUpdateStatus: (orderId: string, newStatus: "PENDING_PAYMENT" | "PAID" | "FAILED" | "REFUNDED") => void | Promise<void>;
}

export function OnlineOrderDetailsDialog({
  open,
  onOpenChange,
  order,
  language,
  onUpdateStatus,
}: OnlineOrderDetailsDialogProps) {
  const { toast } = useToast();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {language === "en" ? "Online Order Details" : "Détails de la Commande en Ligne"}
          </DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-6">
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
                      {language === "en" ? "Order ID" : "ID Commande"}
                    </Label>
                    <p className="font-mono text-sm break-all">{order.id}</p>
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
                                order.payment_status === "FAILED" || order.payment_status === "REFUNDED" ? "bg-red-500" :
                                "bg-yellow-500"
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{order.payment_status || "PENDING_PAYMENT"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Badge
                        variant={
                          order.payment_status === "PAID" ? "default" :
                          order.payment_status === "FAILED" || order.payment_status === "REFUNDED" ? "destructive" :
                          "outline"
                        }
                        className={
                          order.payment_status === "PAID" ? "bg-green-500 text-white border-green-600" :
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
                    <p className="text-sm">{new Date(order.created_at).toLocaleString(language === "en" ? "en-US" : "fr-FR")}</p>
                  </div>
                  {order.updated_at && order.updated_at !== order.created_at && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {language === "en" ? "Updated At" : "Mis à Jour Le"}
                      </Label>
                      <p className="text-sm">{new Date(order.updated_at).toLocaleString(language === "en" ? "en-US" : "fr-FR")}</p>
                    </div>
                  )}
                  {order.total_price && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {language === "en" ? "Total Amount" : "Montant Total"}
                      </Label>
                      <p className="text-lg font-bold text-primary">{order.total_price.toFixed(2)} TND</p>
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
                    <p className="text-base break-all">{order.user_email || order.email || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {language === "en" ? "City/Ville" : "Ville/Quartier"}
                    </Label>
                    <p className="text-base">{order.city || "N/A"}{order.ville ? ` - ${order.ville}` : ""}</p>
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
                  let allPasses: { passType?: string; quantity?: number; price?: number }[] = [];
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

                  if (allPasses.length > 0) {
                    const calculatedTotal = allPasses.reduce((sum: number, pass: { price?: number; quantity?: number }) => {
                      return sum + ((pass.price || 0) * (pass.quantity || 0));
                    }, 0);

                    return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === "en" ? "Pass Type" : "Type Pass"}</TableHead>
                            <TableHead>{language === "en" ? "Quantity" : "Quantité"}</TableHead>
                            <TableHead>{language === "en" ? "Unit Price" : "Prix Unitaire"}</TableHead>
                            <TableHead>{language === "en" ? "Subtotal" : "Sous-total"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPasses.map((pass: { passType?: string; quantity?: number; price?: number }, index: number) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge variant={pass.passType === "vip" ? "default" : "secondary"}>
                                  {pass.passType?.toUpperCase() || "STANDARD"}
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
                              {language === "en" ? "Total" : "Total"}
                            </TableCell>
                            <TableCell className="text-lg">
                              {calculatedTotal.toFixed(2)} TND
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
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
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {language === "en" ? "Payment Response Data" : "Données de Réponse"}
                        </Label>
                        <pre className="mt-2 p-3 bg-background border rounded-lg text-xs overflow-auto max-h-40">
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
                <div className="p-4 bg-background border rounded-lg text-center text-muted-foreground">
                  <p className="text-sm">
                    {language === "en"
                      ? "Payment logs will appear here once the payment gateway integration is complete."
                      : "Les journaux de paiement apparaîtront ici une fois l'intégration de la passerelle de paiement terminée."}
                  </p>
                </div>
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
                    variant="default"
                    onClick={() => onUpdateStatus(order.id, "PAID")}
                    disabled={order.payment_status === "PAID"}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {language === "en" ? "Mark as Paid" : "Marquer comme Payé"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onUpdateStatus(order.id, "FAILED")}
                    disabled={order.payment_status === "FAILED"}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {language === "en" ? "Mark as Failed" : "Marquer comme Échoué"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => onUpdateStatus(order.id, "REFUNDED")}
                    disabled={order.payment_status === "REFUNDED"}
                  >
                    <ArrowDown className="w-4 h-4 mr-2" />
                    {language === "en" ? "Mark as Refunded" : "Marquer comme Remboursé"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: language === "en" ? "Coming Soon" : "Bientôt Disponible",
                        description: language === "en" ? "Email/SMS templates will be available soon" : "Les modèles d'email/SMS seront bientôt disponibles",
                        variant: "default",
                      });
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {language === "en" ? "Resend Email/SMS" : "Renvoyer Email/SMS"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
