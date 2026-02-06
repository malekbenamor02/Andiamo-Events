/**
 * Admin Dashboard - Order Details Dialog (COD/Ambassador orders).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package, FileText, Activity, Database, Calendar as CalendarIcon, Clock, DollarSign,
  User, Phone, Mail, MapPin, Ticket, Users, Percent, Save, X, Edit, RefreshCw, Send,
  Trash2, Wrench, CheckCircle, XCircle, CheckCircle2, Zap, MailCheck, Shield, AlertCircle
} from "lucide-react";

export interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Record<string, unknown> | null;
  ambassador: Record<string, unknown> | null;
  orderLogs: unknown[];
  language: "en" | "fr";
  resendingTicketEmail: boolean;
  onOrderUpdate: (updates: Record<string, unknown>) => void;
  onRefresh: (status?: string) => void;
  orderFilters?: { status?: string };
  onApprove: (orderId: string) => void | Promise<void>;
  onRequestReject: (orderId: string) => void;
  onRequestRemove: (orderId: string) => void;
  onRequestSkip: (orderId: string) => void;
  onComplete: (orderId: string) => void | Promise<void>;
  onResendTicket: (orderId: string) => void | Promise<void>;
}

export function OrderDetailsDialog({
  open,
  onOpenChange,
  order,
  ambassador,
  orderLogs,
  language,
  resendingTicketEmail,
  onOrderUpdate,
  onRefresh,
  onApprove,
  onReject,
  onRemove,
  onSkip,
  onComplete,
  onResendTicket,
  orderFilters,
}: OrderDetailsDialogProps) {
  const { toast } = useToast();
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [isEditingAdminNotes, setIsEditingAdminNotes] = useState(false);
  const [editingAdminNotesValue, setEditingAdminNotesValue] = useState("");
  const [updatingAdminNotes, setUpdatingAdminNotes] = useState(false);
  const [emailDeliveryLogs, setEmailDeliveryLogs] = useState([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [removingOrderId, setRemovingOrderId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false);
  const [skippingOrderId, setSkippingOrderId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [isSkipping, setIsSkipping] = useState(false);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Order Details' : 'DÃ©tails de la Commande'}</DialogTitle>
          </DialogHeader>
          {order && (
            <div className="space-y-6">
              {/* Order Summary Card */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Summary' : 'RÃ©sumÃ© de la Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {language === 'en' ? 'Order ID' : 'ID Commande'}
                      </Label>
                      <p className="font-mono text-sm break-all">{order.id}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {language === 'en' ? 'Status' : 'Statut'}
                      </Label>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-3 h-3 rounded-full cursor-help",
                                  order.status === 'PAID' || order.status === 'APPROVED' || order.status === 'COMPLETED' ? 'bg-green-500' :
                                  order.status === 'REJECTED' || order.status?.includes('CANCELLED') ? 'bg-red-500' :
                                  order.status === 'REMOVED_BY_ADMIN' ? 'bg-gray-600' :
                                  order.status === 'PENDING_ADMIN_APPROVAL' ? 'bg-yellow-500' :
                                  order.status === 'PENDING_CASH' ? 'bg-gray-500' :
                                  'bg-gray-500'
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{order.status}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge 
                          variant={
                            order.status === 'PAID' || order.status === 'APPROVED' || order.status === 'COMPLETED' ? 'default' :
                            order.status === 'REJECTED' || order.status?.includes('CANCELLED') ? 'destructive' :
                            order.status === 'REMOVED_BY_ADMIN' ? 'secondary' :
                            order.status === 'PENDING_ADMIN_APPROVAL' ? 'secondary' :
                            order.status === 'PENDING_CASH' ? 'secondary' :
                            'secondary'
                          }
                          className={
                            order.status === 'PAID' || order.status === 'APPROVED' || order.status === 'COMPLETED' ? 'bg-green-500 text-white border-green-600' :
                            order.status === 'REJECTED' || order.status?.includes('CANCELLED') ? 'bg-red-500 text-white border-red-600' :
                            order.status === 'REMOVED_BY_ADMIN' ? 'bg-gray-600 text-white border-gray-700' :
                            order.status === 'PENDING_ADMIN_APPROVAL' ? 'bg-yellow-500 text-white border-yellow-600' :
                            order.status === 'PENDING_CASH' ? 'bg-gray-500 text-white border-gray-600' :
                            ''
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {language === 'en' ? 'Order Type' : 'Type de Commande'}
                      </Label>
                      <Badge variant="outline" className="font-normal">
                        {order.source === 'platform_online' ? (language === 'en' ? 'Platform Online' : 'Plateforme En Ligne') :
                         order.source === 'ambassador_manual' ? (language === 'en' ? 'Ambassador Manual (COD)' : 'Manuel Ambassadeur (COD)') :
                         order.source}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {language === 'en' ? 'Created At' : 'CrÃ©Ã© Le'}
                      </Label>
                      <p className="text-sm">{new Date(order.created_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR')}</p>
                    </div>
                    {order.total_price && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {language === 'en' ? 'Total Amount' : 'Montant Total'}
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
                    {language === 'en' ? 'Customer Information' : 'Informations Client'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {language === 'en' ? 'Name' : 'Nom'}
                      </Label>
                      <p className="font-semibold text-base">{order.user_name || order.customer_name || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {language === 'en' ? 'Phone' : 'TÃ©lÃ©phone'}
                      </Label>
                      <p className="text-base">{order.user_phone || order.phone || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {language === 'en' ? 'Email' : 'Email'}
                      </Label>
                      {isEditingEmail ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="email"
                            value={editingEmailValue}
                            onChange={(e) => setEditingEmailValue(e.target.value)}
                            className="flex-1 text-base"
                            placeholder={language === 'en' ? 'Enter email address' : 'Entrez l\'adresse email'}
                            disabled={updatingEmail}
                          />
                          <Button
                            size="sm"
                            variant="default"
                            onClick={async () => {
                              if (!editingEmailValue.trim()) {
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: language === 'en' ? 'Email cannot be empty' : 'L\'email ne peut pas Ãªtre vide',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                              if (!emailRegex.test(editingEmailValue.trim())) {
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: language === 'en' ? 'Invalid email format' : 'Format d\'email invalide',
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              setUpdatingEmail(true);
                              try {
                                const apiBase = getApiBaseUrl();
                                const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_UPDATE_ORDER_EMAIL, apiBase);
                                
                                if (!apiUrl) {
                                  throw new Error('Invalid API URL configuration');
                                }
                                
                                const response = await fetch(apiUrl, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    orderId: order.id,
                                    newEmail: editingEmailValue.trim()
                                  }),
                                });
                                
                                const data = await response.json();
                                
                                if (!response.ok) {
                                  throw new Error(data.error || data.details || 'Failed to update email');
                                }
                                
                                toast({
                                  title: language === 'en' ? 'Success' : 'SuccÃ¨s',
                                  description: language === 'en' 
                                    ? 'Email updated successfully' 
                                    : 'Email mis Ã  jour avec succÃ¨s',
                                  variant: 'default'
                                });
                                
                                // Update local state
                                onOrderUpdate({ user_email: editingEmailValue.trim() });
                                
                                setIsEditingEmail(false);
                                setEditingEmailValue('');
                              } catch (error: any) {
                                console.error('Error updating email:', error);
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error.message || (language === 'en' ? 'Failed to update email' : 'Ã‰chec de la mise Ã  jour de l\'email'),
                                  variant: 'destructive'
                                });
                              } finally {
                                setUpdatingEmail(false);
                              }
                            }}
                            disabled={updatingEmail}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            {language === 'en' ? 'Save' : 'Enregistrer'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditingEmail(false);
                              setEditingEmailValue('');
                            }}
                            disabled={updatingEmail}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {language === 'en' ? 'Cancel' : 'Annuler'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-base break-all flex-1">{order.user_email || order.email || 'N/A'}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingEmailValue(order.user_email || order.email || '');
                              setIsEditingEmail(true);
                            }}
                            className="h-8 w-8 p-0"
                            title={language === 'en' ? 'Edit email' : 'Modifier l\'email'}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {language === 'en' ? 'City/Ville' : 'Ville/Quartier'}
                      </Label>
                      <p className="text-base">{order.city || 'N/A'}{order.ville ? ` - ${order.ville}` : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Expiration Display (Read-Only) */}
              {order.status === 'PENDING_CASH' && order.expires_at && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Order Expiration' : 'Expiration de la Commande'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <Label className="text-sm font-semibold text-foreground">
                          {language === 'en' ? 'Expires At' : 'Expire Le'}
                        </Label>
                      </div>
                      <p className="text-sm text-foreground">
                        {new Date(order.expires_at).toLocaleString(language === 'en' ? 'en-US' : 'fr-FR')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === 'en' 
                          ? 'This order will be automatically rejected when the expiration date is reached. Expired orders are checked when you view the orders list.' 
                          : 'Cette commande sera automatiquement rejetÃ©e lorsque la date d\'expiration sera atteinte. Les commandes expirÃ©es sont vÃ©rifiÃ©es lorsque vous consultez la liste des commandes.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Items */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Items' : 'Articles de Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                {(() => {
                  // Try to parse notes to get detailed pass breakdown
                  let allPasses: any[] = [];
                  try {
                    if (order.notes) {
                      const notesData = typeof order.notes === 'string' 
                        ? JSON.parse(order.notes) 
                        : order.notes;
                      if (notesData?.all_passes && Array.isArray(notesData.all_passes)) {
                        allPasses = notesData.all_passes;
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing notes:', e);
                  }

                  // If we have detailed pass breakdown, show it
                  if (allPasses.length > 0) {
                    // Calculate total from passes array to ensure accuracy
                    const calculatedTotal = allPasses.reduce((sum: number, pass: any) => {
                      return sum + ((pass.price || 0) * (pass.quantity || 0));
                    }, 0);
                    
                    return (
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === 'en' ? 'Pass Type' : 'Type Pass'}</TableHead>
                              <TableHead>{language === 'en' ? 'Quantity' : 'QuantitÃ©'}</TableHead>
                              <TableHead>{language === 'en' ? 'Unit Price' : 'Prix Unitaire'}</TableHead>
                              <TableHead>{language === 'en' ? 'Subtotal' : 'Sous-total'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allPasses.map((pass: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Badge variant={pass.passType === 'vip' ? 'default' : 'secondary'}>
                                    {pass.passType?.toUpperCase() || 'STANDARD'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-semibold">{pass.quantity || 0}</TableCell>
                                <TableCell>{pass.price?.toFixed(2) || '0.00'} TND</TableCell>
                                <TableCell className="font-semibold">
                                  {((pass.price || 0) * (pass.quantity || 0)).toFixed(2)} TND
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell colSpan={3} className="text-right">
                                {language === 'en' ? 'Total' : 'Total'}
                              </TableCell>
                              <TableCell className="text-lg">
                                {calculatedTotal.toFixed(2)} TND
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  }

                  // Fallback to simple display for old orders
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-muted-foreground">{language === 'en' ? 'Pass Type' : 'Type Pass'}</Label>
                        <p className="font-semibold uppercase">{order.pass_type}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === 'en' ? 'Quantity' : 'QuantitÃ©'}</Label>
                        <p className="font-semibold">{order.quantity}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">{language === 'en' ? 'Total Price' : 'Prix Total'}</Label>
                        <p className="font-semibold text-lg">{order.total_price?.toFixed(2) || '0.00'} TND</p>
                      </div>
                    </div>
                  );
                })()}
                </CardContent>
              </Card>

              {/* Ambassador Information */}
              {order.ambassador_id && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Assigned Ambassador' : 'Ambassadeur AssignÃ©'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ambassador ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {language === 'en' ? 'Name' : 'Nom'}
                          </Label>
                          <p className="font-semibold text-base">{ambassador.full_name}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {language === 'en' ? 'Phone' : 'TÃ©lÃ©phone'}
                          </Label>
                          <p className="text-base">{ambassador.phone}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {language === 'en' ? 'Email' : 'Email'}
                          </Label>
                          <p className="text-base break-all">{ambassador.email || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {language === 'en' ? 'City/Ville' : 'Ville/Quartier'}
                          </Label>
                          <p className="text-base">{ambassador.city || 'N/A'}{ambassador.ville ? ` - ${ambassador.ville}` : ''}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {language === 'en' ? 'Status' : 'Statut'}
                          </Label>
                          <Badge variant={ambassador.status === 'approved' ? 'default' : 'secondary'}>
                            {ambassador.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {language === 'en' ? 'Commission Rate' : 'Taux de Commission'}
                          </Label>
                          <p className="text-base font-semibold">{ambassador.commission_rate || 0}%</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground font-mono">{order.ambassador_id}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">{language === 'en' ? 'Timestamps' : 'Horodatages'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {order.assigned_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Assigned At' : 'AssignÃ© Le'}</Label>
                      <p>{new Date(order.assigned_at).toLocaleString()}</p>
                    </div>
                  )}
                  {order.accepted_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Accepted At' : 'AcceptÃ© Le'}</Label>
                      <p>{new Date(order.accepted_at).toLocaleString()}</p>
                    </div>
                  )}
                  {order.approved_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Approved At' : 'ApprouvÃ© Le'}</Label>
                      <p>{new Date(order.approved_at).toLocaleString()}</p>
                    </div>
                  )}
                  {order.rejected_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Rejected At' : 'RejetÃ© Le'}</Label>
                      <p>{new Date(order.rejected_at).toLocaleString()}</p>
                    </div>
                  )}
                  {order.rejection_reason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">{language === 'en' ? 'Rejection Reason' : 'Raison du Rejet'}</Label>
                      <p className="text-sm text-destructive">{order.rejection_reason}</p>
                    </div>
                  )}
                  {order.completed_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Completed At' : 'TerminÃ© Le'}</Label>
                      <p>{new Date(order.completed_at).toLocaleString()}</p>
                    </div>
                  )}
                  {order.cancelled_at && (
                    <div>
                      <Label className="text-muted-foreground">{language === 'en' ? 'Cancelled At' : 'AnnulÃ© Le'}</Label>
                      <p>{new Date(order.cancelled_at).toLocaleString()}</p>
                      {order.cancellation_reason && (
                        <p className="mt-1 text-muted-foreground italic">{language === 'en' ? 'Reason' : 'Raison'}: {order.cancellation_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Notes */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Admin Notes' : 'Notes Administrateur'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingAdminNotes ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingAdminNotesValue}
                        onChange={(e) => setEditingAdminNotesValue(e.target.value)}
                        className="min-h-[100px] text-base"
                        placeholder={language === 'en' ? 'Enter admin notes...' : 'Entrez les notes administrateur...'}
                        disabled={updatingAdminNotes}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUpdatingAdminNotes(true);
                            try {
                              const apiBase = getApiBaseUrl();
                              const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_UPDATE_ORDER_NOTES, apiBase);
                              
                              if (!apiUrl) {
                                throw new Error('Invalid API URL configuration');
                              }
                              
                              console.log('Updating admin notes:', { orderId: order.id, apiUrl });
                              
                              const response = await fetch(apiUrl, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  orderId: order.id,
                                  adminNotes: editingAdminNotesValue.trim() || null
                                }),
                              });
                              
                              const data = await response.json();
                              
                              if (!response.ok) {
                                throw new Error(data.error || data.details || 'Failed to update admin notes');
                              }
                              
                              toast({
                                title: language === 'en' ? 'Success' : 'SuccÃ¨s',
                                description: language === 'en' 
                                  ? 'Admin notes updated successfully' 
                                  : 'Notes administrateur mises Ã  jour avec succÃ¨s',
                                variant: 'default'
                              });
                              
                              // Update local state
                              onOrderUpdate({ admin_notes: editingAdminNotesValue.trim() || null });
                              
                              setIsEditingAdminNotes(false);
                              setEditingAdminNotesValue('');
                              
                              // Refresh orders list
                              const statusToFetch = orderFilters?.status || undefined;
                              onRefresh(statusToFetch);
                            } catch (error: any) {
                              console.error('Error updating admin notes:', error);
                              toast({
                                title: language === 'en' ? 'Error' : 'Erreur',
                                description: error.message || (language === 'en' ? 'Failed to update admin notes' : 'Ã‰chec de la mise Ã  jour des notes administrateur'),
                                variant: 'destructive'
                              });
                            } finally {
                              setUpdatingAdminNotes(false);
                            }
                          }}
                          disabled={updatingAdminNotes}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {language === 'en' ? 'Save' : 'Enregistrer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingAdminNotes(false);
                            setEditingAdminNotesValue('');
                          }}
                          disabled={updatingAdminNotes}
                        >
                          <X className="w-4 h-4 mr-1" />
                          {language === 'en' ? 'Cancel' : 'Annuler'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="min-h-[100px] p-3 bg-background border rounded-md">
                        {order.admin_notes ? (
                          <p className="text-base whitespace-pre-wrap">{order.admin_notes}</p>
                        ) : (
                          <p className="text-base text-muted-foreground italic">
                            {language === 'en' ? 'No admin notes added yet' : 'Aucune note administrateur ajoutÃ©e pour le moment'}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingAdminNotesValue(order.admin_notes || '');
                          setIsEditingAdminNotes(true);
                        }}
                        className="h-8"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        {language === 'en' ? 'Edit Notes' : 'Modifier les Notes'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Logs */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Activity Log' : 'Journal d\'ActivitÃ© de la Commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    {orderLogs.filter((log: any) => log.order_id === order.id).length > 0 ? (
                      <div className="space-y-3">
                        {orderLogs
                          .filter((log: any) => log.order_id === order.id)
                          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((log: any, index: number) => {
                            const getActionIcon = () => {
                              switch (log.action) {
                                case 'approved':
                                  return <CheckCircle className="w-4 h-4 text-green-500" />;
                                case 'rejected':
                                  return <XCircle className="w-4 h-4 text-red-500" />;
                                case 'cancelled':
                                  return <XCircle className="w-4 h-4 text-orange-500" />;
                                case 'status_changed':
                                  return <RefreshCw className="w-4 h-4 text-blue-500" />;
                                case 'created':
                                  return <Plus className="w-4 h-4 text-purple-500" />;
                                default:
                                  return <Clock className="w-4 h-4 text-muted-foreground" />;
                              }
                            };

                            const getActionBadge = () => {
                              const actionMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                                'approved': { label: language === 'en' ? 'Approved' : 'ApprouvÃ©', variant: 'default' },
                                'rejected': { label: language === 'en' ? 'Rejected' : 'RejetÃ©', variant: 'destructive' },
                                'cancelled': { label: language === 'en' ? 'Cancelled' : 'AnnulÃ©', variant: 'destructive' },
                                'status_changed': { label: language === 'en' ? 'Status Changed' : 'Statut ModifiÃ©', variant: 'secondary' },
                                'created': { label: language === 'en' ? 'Created' : 'CrÃ©Ã©', variant: 'outline' },
                              };
                              const actionInfo = actionMap[log.action] || { label: log.action, variant: 'outline' as const };
                              return (
                                <Badge 
                                  variant={actionInfo.variant}
                                  className={actionInfo.variant === 'default' ? 'bg-green-500/20 text-green-300 border-green-500/30' : ''}
                                >
                                  {actionInfo.label}
                                </Badge>
                              );
                            };

                            const getPerformedByBadge = () => {
                              const typeMap: Record<string, { label: string; color: string }> = {
                                'admin': { label: language === 'en' ? 'Admin' : 'Admin', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                                'ambassador': { label: language === 'en' ? 'Ambassador' : 'Ambassadeur', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                                'system': { label: language === 'en' ? 'System' : 'SystÃ¨me', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
                              };
                              const typeInfo = typeMap[log.performed_by_type] || { label: log.performed_by_type || 'N/A', color: 'bg-muted text-muted-foreground border-border' };
                              return (
                                <Badge variant="outline" className={typeInfo.color}>
                                  {typeInfo.label}
                                </Badge>
                              );
                            };

                            const formatTimestamp = (timestamp: string) => {
                              const date = new Date(timestamp);
                              const now = new Date();
                              const diffMs = now.getTime() - date.getTime();
                              const diffMins = Math.floor(diffMs / 60000);
                              const diffHours = Math.floor(diffMs / 3600000);
                              const diffDays = Math.floor(diffMs / 86400000);

                              if (diffMins < 1) return language === 'en' ? 'Just now' : 'Ã€ l\'instant';
                              if (diffMins < 60) return `${diffMins} ${language === 'en' ? 'min ago' : 'min'}`;
                              if (diffHours < 24) return `${diffHours} ${language === 'en' ? 'hours ago' : 'heures'}`;
                              if (diffDays < 7) return `${diffDays} ${language === 'en' ? 'days ago' : 'jours'}`;
                              return date.toLocaleString(language === 'en' ? 'en-US' : 'fr-FR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                            };

                            return (
                              <div 
                                key={log.id} 
                                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50 hover:bg-muted/50 transition-colors"
                              >
                                <div className="mt-0.5">
                                  {getActionIcon()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    {getActionBadge()}
                                    {getPerformedByBadge()}
                                  </div>
                                  {log.details && typeof log.details === 'object' && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                      {log.details.old_status && log.details.new_status && (
                                        <p>
                                          {language === 'en' ? 'Status' : 'Statut'}: 
                                          <span className="ml-1 font-medium">{log.details.old_status}</span>
                                          <span className="mx-1">â†’</span>
                                          <span className="font-medium">{log.details.new_status}</span>
                                        </p>
                                      )}
                                      {log.details.reason && (
                                        <p className="italic">
                                          {language === 'en' ? 'Reason' : 'Raison'}: {log.details.reason}
                                        </p>
                                      )}
                                      {log.details.email_sent !== undefined && (
                                        <p>
                                          {language === 'en' ? 'Email' : 'Email'}: 
                                          <span className={`ml-1 ${log.details.email_sent ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.details.email_sent ? (language === 'en' ? 'Sent' : 'EnvoyÃ©') : (language === 'en' ? 'Failed' : 'Ã‰chouÃ©')}
                                          </span>
                                        </p>
                                      )}
                                      {log.details.sms_sent !== undefined && (
                                        <p>
                                          {language === 'en' ? 'SMS' : 'SMS'}: 
                                          <span className={`ml-1 ${log.details.sms_sent ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.details.sms_sent ? (language === 'en' ? 'Sent' : 'EnvoyÃ©') : (language === 'en' ? 'Failed' : 'Ã‰chouÃ©')}
                                          </span>
                                        </p>
                                      )}
                                      {log.details.tickets_generated !== undefined && (
                                        <p>
                                          {language === 'en' ? 'Tickets' : 'Billets'}: 
                                          <span className={`ml-1 ${log.details.tickets_generated ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.details.tickets_generated ? (language === 'en' ? 'Generated' : 'GÃ©nÃ©rÃ©s') : (language === 'en' ? 'Failed' : 'Ã‰chouÃ©')}
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatTimestamp(log.created_at)}</span>
                                    <span className="text-muted-foreground/50">â€¢</span>
                                    <span>{new Date(log.created_at).toLocaleTimeString(language === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">{language === 'en' ? 'No activity logs found for this order' : 'Aucun journal d\'activitÃ© trouvÃ© pour cette commande'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Email Delivery Status */}
              {(order.status === 'COMPLETED' || order.status === 'MANUAL_COMPLETED') && order.payment_method === 'ambassador_cash' && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" />
                        {language === 'en' ? 'Email Delivery Status' : 'Statut de Livraison Email'}
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setLoadingEmailLogs(true);
                          try {
                            const response = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(order.id));
                            if (response.ok) {
                              const data = await response.json();
                              setEmailDeliveryLogs(data.logs || []);
                            }
                          } catch (error) {
                            console.error('Error fetching email logs:', error);
                          } finally {
                            setLoadingEmailLogs(false);
                          }
                        }}
                        disabled={loadingEmailLogs}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingEmailLogs ? 'animate-spin' : ''}`} />
                        {language === 'en' ? 'Refresh' : 'Actualiser'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {emailDeliveryLogs.length > 0 ? (
                      <div className="space-y-3">
                        {emailDeliveryLogs.map((log: any) => (
                          <div key={log.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={
                                    log.status === 'sent' ? 'default' :
                                    log.status === 'failed' ? 'destructive' :
                                    log.status === 'pending_retry' ? 'secondary' :
                                    'outline'
                                  }
                                >
                                  {log.status === 'sent' ? (language === 'en' ? 'Sent' : 'EnvoyÃ©') :
                                   log.status === 'failed' ? (language === 'en' ? 'Failed' : 'Ã‰chouÃ©') :
                                   log.status === 'pending_retry' ? (language === 'en' ? 'Pending Retry' : 'Nouvelle Tentative') :
                                   language === 'en' ? 'Pending' : 'En Attente'}
                                </Badge>
                                {log.retry_count > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {language === 'en' ? `Retry ${log.retry_count}` : `Tentative ${log.retry_count}`}
                                  </span>
                                )}
                              </div>
                              {log.sent_at && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(log.sent_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="text-sm">
                              <p className="text-muted-foreground">
                                <strong>{language === 'en' ? 'To:' : 'Ã€:'}</strong> {log.recipient_email}
                              </p>
                              {log.error_message && (
                                <p className="text-destructive text-xs mt-1">
                                  <strong>{language === 'en' ? 'Error:' : 'Erreur:'}</strong> {log.error_message}
                                </p>
                              )}
                            </div>
                            {(log.status === 'failed' || log.status === 'pending_retry') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  setResendingEmail(true);
                                  try {
                                    const response = await apiFetch(API_ROUTES.RESEND_ORDER_COMPLETION_EMAIL, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({ orderId: order.id }),
                                    });
                                    if (response.ok) {
                                      toast({
                                        title: language === 'en' ? 'Email Resent' : 'Email RenvoyÃ©',
                                        description: language === 'en' ? 'The completion email has been resent successfully.' : 'L\'email de confirmation a Ã©tÃ© renvoyÃ© avec succÃ¨s.',
                                        variant: 'default',
                                      });
                                      // Refresh email logs
                                      const logsResponse = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(order.id));
                                      if (logsResponse.ok) {
                                        const data = await logsResponse.json();
                                        setEmailDeliveryLogs(data.logs || []);
                                      }
                                    } else {
                                      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                      toast({
                                        title: language === 'en' ? 'Error' : 'Erreur',
                                        description: errorData.details || errorData.error || (language === 'en' ? 'Failed to resend email.' : 'Ã‰chec du renvoi de l\'email.'),
                                        variant: 'destructive',
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Error resending email:', error);
                                    toast({
                                      title: language === 'en' ? 'Error' : 'Erreur',
                                      description: language === 'en' ? 'Failed to resend email.' : 'Ã‰chec du renvoi de l\'email.',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setResendingEmail(false);
                                  }
                                }}
                                disabled={resendingEmail}
                                className="w-full"
                              >
                                <Send className={`w-4 h-4 mr-2 ${resendingEmail ? 'animate-spin' : ''}`} />
                                {language === 'en' ? 'Resend Email' : 'Renvoyer l\'Email'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {language === 'en' ? 'No email delivery logs found. The completion email may not have been sent yet.' : 'Aucun journal de livraison email trouvÃ©. L\'email de confirmation n\'a peut-Ãªtre pas encore Ã©tÃ© envoyÃ©.'}
                        </p>
                        {order.user_email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setResendingEmail(true);
                              try {
                                const response = await apiFetch(API_ROUTES.RESEND_ORDER_COMPLETION_EMAIL, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ orderId: order.id }),
                                });
                                if (response.ok) {
                                  toast({
                                    title: language === 'en' ? 'Email Sent' : 'Email EnvoyÃ©',
                                    description: language === 'en' ? 'The completion email has been sent successfully.' : 'L\'email de confirmation a Ã©tÃ© envoyÃ© avec succÃ¨s.',
                                    variant: 'default',
                                  });
                                  // Refresh email logs
                                  const logsResponse = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(order.id));
                                  if (logsResponse.ok) {
                                    const data = await logsResponse.json();
                                    setEmailDeliveryLogs(data.logs || []);
                                  }
                                } else {
                                  const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                  toast({
                                    title: language === 'en' ? 'Error' : 'Erreur',
                                    description: errorData.details || errorData.error || (language === 'en' ? 'Failed to send email.' : 'Ã‰chec de l\'envoi de l\'email.'),
                                    variant: 'destructive',
                                  });
                                }
                              } catch (error: any) {
                                console.error('Error sending email:', error);
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error?.message || (language === 'en' ? 'Failed to send email. Please check server logs for details.' : 'Ã‰chec de l\'envoi de l\'email. Veuillez vÃ©rifier les journaux du serveur.'),
                                  variant: 'destructive',
                                });
                              } finally {
                                setResendingEmail(false);
                              }
                            }}
                            disabled={resendingEmail}
                          >
                            <Send className={`w-4 h-4 mr-2 ${resendingEmail ? 'animate-spin' : ''}`} />
                            {language === 'en' ? 'Send Completion Email' : 'Envoyer l\'Email de Confirmation'}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Remove Order Action - Show for all non-PAID orders */}
              {order.status !== 'PAID' && order.status !== 'REMOVED_BY_ADMIN' && (
                <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                      {language === 'en' ? 'Remove Order' : 'Retirer la Commande'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {language === 'en' 
                          ? 'Remove this order (soft delete). The order will be hidden from reports but data will be preserved for audit purposes.'
                          : 'Retirer cette commande (suppression douce). La commande sera masquÃ©e des rapports mais les donnÃ©es seront conservÃ©es Ã  des fins d\'audit.'}
                      </p>
                      <Button
                        onClick={() => {
                          setRemovingOrderId(order.id);
                          setIsRemoveDialogOpen(true);
                        }}
                        variant="destructive"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {language === 'en' ? 'Remove Order' : 'Retirer la Commande'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Admin Actions */}
              {(order.status === 'PENDING_CASH' || 
                (order.status === 'PENDING_ADMIN_APPROVAL' && order.payment_method === 'ambassador_cash')) && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-primary" />
                      {language === 'en' ? 'Admin Actions' : 'Actions Admin'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {/* Admin Approve/Reject - For PENDING_ADMIN_APPROVAL (after ambassador confirms cash) */}
                      {order.payment_method === 'ambassador_cash' && order.status === 'PENDING_ADMIN_APPROVAL' && (
                        <>
                          <Button
                            onClick={() => onApprove(order.id)}
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {language === 'en' ? 'Approve Order' : 'Approuver la Commande'}
                          </Button>
                          <Button
                            onClick={() => {
                              // Open reject dialog (reason required for ambassador cash orders)
                              onRequestReject(order.id);
                            }}
                            variant="destructive"
                            size="sm"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {language === 'en' ? 'Reject Order' : 'Rejeter la Commande'}
                          </Button>
                        </>
                      )}
                      
                      {/* Admin Skip Ambassador Confirmation - Only for PENDING_CASH (before ambassador confirms) */}
                      {order.status === 'PENDING_CASH' && (
                        <Button
                          onClick={() => {
                            setSkippingOrderId(order.id);
                            setIsSkipDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Approve Without Ambassador' : 'Approuver sans Ambassadeur'}
                        </Button>
                      )}
                      
                      {/* Approved COD orders can be completed */}
                      {order.payment_method === 'ambassador_cash' && order.status === 'APPROVED' && (
                        <Button
                          onClick={() => onComplete(order.id)}
                          variant="default"
                          size="sm"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Complete Order' : 'Terminer la Commande'}
                        </Button>
                      )}
                      
                      {/* Legacy status support (for backward compatibility) */}
                      {order.status === 'PENDING' && order.payment_method !== 'ambassador_cash' && (
                        <Button
                          onClick={() => onApprove(order.id)}
                          variant="default"
                          size="sm"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Accept Order' : 'Accepter la Commande'}
                        </Button>
                      )}
                      {order.status === 'ACCEPTED' && order.payment_method !== 'ambassador_cash' && (
                        <Button
                          onClick={() => onComplete(order.id)}
                          variant="default"
                          size="sm"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Complete Order' : 'Terminer la Commande'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Admin Resend Ticket Email - NEW FEATURE */}
              {order.status === 'PAID' && (
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MailCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      {language === 'en' ? 'Ticket Email Actions' : 'Actions Email de Billets'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => onResendTicket(order.id)}
                        variant="outline"
                        size="sm"
                        disabled={resendingTicketEmail}
                        className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/40"
                      >
                        <Send className={`w-4 h-4 mr-2 ${resendingTicketEmail ? 'animate-spin' : ''}`} />
                        {resendingTicketEmail 
                          ? (language === 'en' ? 'Resending...' : 'Renvoi en cours...')
                          : (language === 'en' ? 'Resend Ticket Email' : 'Renvoyer l\'Email des Billets')
                        }
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === 'en' 
                          ? 'Resend ticket email using existing tickets (max 5 per hour per order)'
                          : 'Renvoyer l\'email des billets en utilisant les billets existants (max 5 par heure par commande)'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Order Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={(open) => {
        setIsRemoveDialogOpen(open);
        if (!open) setRemovingOrderId(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              {language === "en" ? "Remove Order" : "Retirer la Commande"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {language === "en"
                  ? "Are you sure you want to remove this order? This action will hide the order from reports and calculations, but all data will be preserved for audit purposes. This action cannot be undone."
                  : "Êtes-vous sûr de vouloir retirer cette commande ? Cette action masquera la commande des rapports et calculs, mais toutes les données seront conservées à des fins d'audit. Cette action ne peut pas être annulée."}
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRemoveDialogOpen(false);
                  setRemovingOrderId(null);
                }}
                disabled={isRemoving}
              >
                {language === "en" ? "Cancel" : "Annuler"}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!removingOrderId) return;
                  setIsRemoving(true);
                  try {
                    await onRemove(removingOrderId);
                    setIsRemoveDialogOpen(false);
                    setRemovingOrderId(null);
                  } finally {
                    setIsRemoving(false);
                  }
                }}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {language === "en" ? "Removing..." : "Retrait en cours..."}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {language === "en" ? "Remove Order" : "Retirer la Commande"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
        setIsRejectDialogOpen(open);
        if (!open) {
          setRejectingOrderId(null);
          setRejectionReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "en" ? "Reject Order" : "Rejeter la Commande"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "en" ? "Rejection Reason" : "Raison du Rejet"} *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={language === "en" ? "Enter rejection reason..." : "Entrez la raison du rejet..."}
                rows={4}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setRejectingOrderId(null);
                  setRejectionReason("");
                }}
              >
                {language === "en" ? "Cancel" : "Annuler"}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!rejectingOrderId || !rejectionReason.trim()) {
                    toast({
                      title: language === "en" ? "Error" : "Erreur",
                      description: language === "en" ? "Rejection reason is required" : "La raison du rejet est requise",
                      variant: "destructive",
                    });
                    return;
                  }
                  try {
                    await onReject(rejectingOrderId, rejectionReason.trim());
                    setIsRejectDialogOpen(false);
                    setRejectingOrderId(null);
                    setRejectionReason("");
                  } catch {
                    // Error toast already shown by handler
                  }
                }}
                disabled={!rejectionReason.trim()}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {language === "en" ? "Reject Order" : "Rejeter la Commande"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip Ambassador Confirmation Dialog */}
      <Dialog open={isSkipDialogOpen} onOpenChange={(open) => {
        setIsSkipDialogOpen(open);
        if (!open) {
          setSkippingOrderId(null);
          setSkipReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-600" />
              {language === "en" ? "Skip Ambassador Confirmation" : "Ignorer la Confirmation de l'Ambassadeur"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="default" className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-orange-900 dark:text-orange-200">
                {language === "en"
                  ? "This action will approve the order and generate tickets WITHOUT waiting for ambassador cash confirmation. Use only when ambassador has confirmed payment separately."
                  : "Cette action approuvera la commande et générera les billets SANS attendre la confirmation de l'ambassadeur. Utilisez uniquement lorsque l'ambassadeur a confirmé le paiement séparément."}
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="skip-reason">
                {language === "en" ? "Reason (Optional)" : "Raison (Optionnel)"}
              </Label>
              <Textarea
                id="skip-reason"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder={language === "en"
                  ? "Enter reason for skipping ambassador confirmation (optional)..."
                  : "Entrez la raison de l'ignorance de la confirmation de l'ambassadeur (optionnel)..."}
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSkipDialogOpen(false);
                  setSkippingOrderId(null);
                  setSkipReason("");
                }}
                disabled={isSkipping}
              >
                {language === "en" ? "Cancel" : "Annuler"}
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  if (!skippingOrderId) return;
                  setIsSkipping(true);
                  try {
                    await onSkip(skippingOrderId, skipReason.trim() || undefined);
                    setIsSkipDialogOpen(false);
                    setSkippingOrderId(null);
                    setSkipReason("");
                  } finally {
                    setIsSkipping(false);
                  }
                }}
                disabled={isSkipping || !skippingOrderId}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isSkipping ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {language === "en" ? "Processing..." : "Traitement..."}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {language === "en" ? "Skip & Approve" : "Ignorer et Approuver"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}