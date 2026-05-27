/**
 * Admin Dashboard - Order Details Dialog (COD/Ambassador orders).
 * Extracted from Dashboard.tsx for maintainability.
 */

import React, { useMemo, useRef, useState } from "react";
import Loader from "@/components/ui/Loader";
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
import {
  formatPresaleOrderDiscountLabel,
  formatPresalePassBreakdownRule,
  parsePresaleOrderSnapshot,
  type PresaleOrderSnapshot,
} from "@/lib/presale/presaleDiscount";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminOrderQrTicketsSection } from "./AdminOrderQrTicketsSection";
import {
  Package, FileText, Activity, Database, Calendar as CalendarIcon, Clock,
  User, Phone, Mail, MapPin, Ticket, Save, X, Edit, RefreshCw, Send,
  Trash2, Wrench, CheckCircle, XCircle, CheckCircle2, Zap, MailCheck, Shield, AlertCircle, Plus, Tag
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
  onReject: (orderId: string, reason?: string) => void | Promise<void>;
  onRemove: (orderId: string) => void | Promise<void>;
  onSkip: (orderId: string, reason?: string) => void | Promise<void>;
  onComplete: (orderId: string) => void | Promise<void>;
  onResendTicket: (orderId: string) => void | Promise<void>;
  /** When true, loads and shows QR ticket images and statuses (API allows super_admin only). */
  isSuperAdmin?: boolean;
}

export function OrderDetailsDialog({
  open,
  onOpenChange,
  order,
  ambassador: _ambassador,
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
  isSuperAdmin = false,
}: OrderDetailsDialogProps) {
  const { toast } = useToast();
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

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
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Read presale snapshot persisted by the order-create handler. RLS hides `presale_codes` from
  // the anon admin client, so the snapshot stored on `orders.notes.presale` is the source of truth.
  let presaleInfo: PresaleOrderSnapshot | null = null;
  try {
    const rawNotes = (order as { notes?: unknown } | null)?.notes;
    if (rawNotes != null) {
      const notesData = typeof rawNotes === "string" ? JSON.parse(rawNotes) : rawNotes;
      const p = (notesData as { presale?: unknown } | null)?.presale;
      presaleInfo = parsePresaleOrderSnapshot(p);
    }
  } catch (e) {
    presaleInfo = null;
  }

  const presaleCodeIdOnOrder = (order as { presale_code_id?: string | null } | null)?.presale_code_id;
  const isPresaleOrder = !!presaleCodeIdOnOrder || !!presaleInfo;

  const formatPresaleDiscount = () => formatPresaleOrderDiscountLabel(presaleInfo, language);

  const formatOrderSummaryDateTime = (iso: string | Date | undefined | null) => {
    if (iso == null) return "";
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${d.getFullYear()}, ${d.toLocaleTimeString(language === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  };

  type AdminRelInline = { name?: string | null; email?: string | null } | null | undefined;
  const adminRelLabelFromOrder = (rel: AdminRelInline) => {
    if (!rel || typeof rel !== "object") return null;
    const nameStr = rel.name != null ? String(rel.name).trim() : "";
    if (nameStr) return nameStr;
    const emailStr = rel.email != null ? String(rel.email).trim() : "";
    return emailStr || null;
  };

  const codApprovalAttribution =
    order &&
    (order.status === "PAID" || order.status === "APPROVED" || order.status === "COMPLETED")
      ? (() => {
          const o = order as Record<string, unknown>;
          const approvedByLabel = adminRelLabelFromOrder(o.approver as AdminRelInline);
          const approvedAt = o.approved_at as string | undefined;
          if (!approvedByLabel && !approvedAt) return null;
          return { approvedByLabel, approvedAt };
        })()
      : null;

  const uniqueOrderActivityLogs = useMemo(() => {
    if (!order?.id) return [];
    const logsForOrder = (orderLogs as any[]).filter((log: any) => log.order_id === order.id);
    const seen = new Set<string>();
    return logsForOrder
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((log: any) => {
        const signature = JSON.stringify({
          action: log.action,
          performed_by_type: log.performed_by_type,
          created_at: log.created_at,
          old_status: log.details?.old_status,
          new_status: log.details?.new_status,
          old_payment_status: log.details?.old_payment_status,
          new_payment_status: log.details?.new_payment_status,
        });
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
  }, [order?.id, orderLogs]);

  const codRejectionAttribution = useMemo(() => {
    if (!order || order.status !== "REJECTED") return null;
    const o = order as Record<string, unknown>;
    const rejectedAt = o.rejected_at as string | undefined;
    const rejectionReason = (o.rejection_reason || o.cancellation_reason) as string | undefined;
    const nameOnOrder =
      typeof o.rejected_by_name === "string" && o.rejected_by_name.trim()
        ? o.rejected_by_name.trim()
        : null;
    let rejectedByLabel =
      adminRelLabelFromOrder(o.rejector as AdminRelInline) || nameOnOrder;
    if (!rejectedByLabel) {
      const logsForOrder = (orderLogs as any[]).filter((log: any) => log.order_id === order.id);
      const rejLog = logsForOrder.find((log: any) => log.action === "rejected");
      const fromDetails = rejLog?.details?.rejected_by_name;
      if (typeof fromDetails === "string" && fromDetails.trim()) {
        rejectedByLabel = fromDetails.trim();
      }
    }
    if (!rejectedByLabel && !rejectionReason && !rejectedAt) return null;
    return { rejectedByLabel, rejectedAt, rejectionReason };
  }, [order, orderLogs]);

  const formatActivityLogRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return language === "en" ? "Just now" : "À l'instant";
    if (diffMins < 60) return `${diffMins} ${language === "en" ? "min ago" : "min"}`;
    if (diffHours < 24) return `${diffHours} ${language === "en" ? "hours ago" : "heures"}`;
    if (diffDays < 7) return `${diffDays} ${language === "en" ? "days ago" : "jours"}`;
    return date.toLocaleString(language === "en" ? "en-US" : "fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hasSyntheticActivity = !!(codApprovalAttribution || codRejectionAttribution);
  const hasAnyActivity = uniqueOrderActivityLogs.length > 0 || hasSyntheticActivity;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-full max-w-[100vw] left-0 translate-x-0 p-3 sm:p-6 sm:left-1/2 sm:translate-x-[-50%] sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden scrollbar-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogHeader>
            <DialogTitle>
              {language === "en" ? "Ambassadors Order Details" : "Détails de la commande ambassadeur"}
            </DialogTitle>
          </DialogHeader>
          {order && (
            <div className="space-y-3 sm:space-y-6 w-full break-words">
              {/* Order Summary Card */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Order Summary' : 'Résumé de la commande'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {language === 'en' ? 'Order Number' : 'Numéro de commande'}
                      </Label>
                      <p className="font-mono text-sm break-all">
                        #{order.order_number != null ? String(order.order_number) : String(order.id)}
                      </p>
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
                            order.status === 'PAID' || order.status === 'APPROVED' || order.status === 'COMPLETED' ? 'bg-green-500 hover:bg-green-500 text-white border-green-600' :
                            order.status === 'REJECTED' || order.status?.includes('CANCELLED') ? 'bg-red-500 hover:bg-red-500 text-white border-red-600' :
                            order.status === 'REMOVED_BY_ADMIN' ? 'bg-gray-600 hover:bg-gray-600 text-white border-gray-700' :
                            order.status === 'PENDING_ADMIN_APPROVAL' ? 'bg-yellow-500 hover:bg-yellow-500 text-white border-yellow-600' :
                            order.status === 'PENDING_CASH' ? 'bg-gray-500 hover:bg-gray-500 text-white border-gray-600' :
                            ''
                          }
                        >
                          {order.status}
                        </Badge>
                        {isPresaleOrder && (
                          <Badge
                            variant="default"
                            className="bg-indigo-500 hover:bg-indigo-500 text-white border-indigo-600 inline-flex items-center gap-1"
                            title={presaleInfo?.code_label
                              ? `${language === 'en' ? 'Presale code' : 'Code presale'}: ${presaleInfo.code_label}`
                              : (language === 'en' ? 'Placed via presale' : 'Commande presale')}
                          >
                            <Tag className="w-3 h-3" />
                            {language === 'en' ? 'Presale' : 'Presale'}
                            {presaleInfo?.code_label ? ` · ${presaleInfo.code_label}` : ''}
                          </Badge>
                        )}
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
                        {language === 'en' ? 'Created At' : 'Créé le'}
                      </Label>
                      <p className="text-sm">{formatOrderSummaryDateTime(order.created_at as string | undefined)}</p>
                      {order.status === "PENDING_CASH" && order.expires_at && (
                        <>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1 pt-2">
                            <Clock className="w-3 h-3" />
                            {language === "en" ? "Expires At" : "Expire Le"}
                          </Label>
                          <p className="text-sm">{formatOrderSummaryDateTime(order.expires_at as string)}</p>
                        </>
                      )}
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        {language === 'en' ? 'Pass Details' : 'Détails du pass'}
                      </Label>
                  {(() => {
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

                        if (allPasses.length > 0) {
                          const calculatedTotal = allPasses.reduce((sum: number, pass: any) => {
                            return sum + ((pass.price || 0) * (pass.quantity || 0));
                          }, 0);

                          return (
                            <div className="space-y-3">
                              {/* Desktop keeps table formatting */}
                              <div className="hidden md:block">
                                <Table className="w-full table-fixed">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{language === 'en' ? 'Pass Type' : 'Type Pass'}</TableHead>
                                      <TableHead>{language === 'en' ? 'Quantity' : 'Quantité'}</TableHead>
                                      <TableHead>{language === 'en' ? 'Unit Price' : 'Prix Unitaire'}</TableHead>
                                      <TableHead>{language === 'en' ? 'Subtotal' : 'Sous-total'}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {allPasses.map((pass: any, index: number) => {
                                      const passLabel =
                                        pass.name ||
                                        pass.passName ||
                                        pass.label ||
                                        pass.pass_type ||
                                        pass.passType ||
                                        pass.type ||
                                        'N/A';
                                      return (
                                        <TableRow key={index}>
                                          <TableCell>
                                            <Badge variant={pass.passType === 'vip' ? 'default' : 'secondary'}>
                                              {String(passLabel).toUpperCase()}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="font-semibold">{pass.quantity || 0}</TableCell>
                                          <TableCell>{pass.price?.toFixed(2) || '0.00'} TND</TableCell>
                                          <TableCell className="font-semibold">
                                            {((pass.price || 0) * (pass.quantity || 0)).toFixed(2)} TND
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    {presaleInfo && typeof presaleInfo.original_subtotal === 'number' && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-right text-sm text-muted-foreground">
                                          {language === 'en' ? 'Original Subtotal' : 'Sous-total Initial'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground line-through">
                                          {presaleInfo.original_subtotal.toFixed(2)} TND
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    {presaleInfo && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-right text-sm">
                                          <span className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-muted-foreground">
                                              {language === 'en' ? 'Presale Code' : 'Code Presale'}:
                                            </span>
                                            <span className="font-mono font-semibold">
                                              {presaleInfo.code_label || (language === 'en' ? '(no label)' : '(sans libellé)')}
                                            </span>
                                            {formatPresaleDiscount() && (
                                              <Badge className="bg-indigo-500 hover:bg-indigo-500 text-white border-indigo-600 text-[10px] px-1.5 py-0 h-5">
                                                -{formatPresaleDiscount()}
                                              </Badge>
                                            )}
                                          </span>
                                          {presaleInfo?.discount_mode === "per_pass" &&
                                            (presaleInfo.pass_breakdown?.length ?? 0) > 0 && (
                                              <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground text-right list-none">
                                                {presaleInfo.pass_breakdown!.map((row, idx) => (
                                                  <li key={row.pass_id ?? idx}>
                                                    {formatPresalePassBreakdownRule(row, language)}
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm font-semibold text-green-600 dark:text-green-400">
                                          {typeof presaleInfo.original_subtotal === 'number' &&
                                          typeof presaleInfo.discounted_subtotal === 'number'
                                            ? `-${Math.max(0, presaleInfo.original_subtotal - presaleInfo.discounted_subtotal).toFixed(2)} TND`
                                            : '—'}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    <TableRow className="font-bold border-t-2">
                                      <TableCell colSpan={3} className="text-right">
                                        {presaleInfo
                                          ? (language === 'en' ? 'Total (after discount)' : 'Total (après remise)')
                                          : (language === 'en' ? 'Total' : 'Total')}
                                      </TableCell>
                                      <TableCell className="text-lg">
                                        {calculatedTotal.toFixed(2)} TND
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Mobile: stacked cards for better readability */}
                              <div className="md:hidden space-y-2">
                                {allPasses.map((pass: any, index: number) => {
                                  const passLabel =
                                    pass.name ||
                                    pass.passName ||
                                    pass.label ||
                                    pass.pass_type ||
                                    pass.passType ||
                                    pass.type ||
                                    'N/A';
                                  const qty = pass.quantity || 0;
                                  const unit = pass.price || 0;
                                  const subtotal = (unit * qty) as number;

                                  return (
                                    <div
                                      key={index}
                                      className="rounded-lg border border-border/60 bg-muted/30 p-2"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <Badge variant={pass.passType === 'vip' ? 'default' : 'secondary'}>
                                          {String(passLabel).toUpperCase()}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">{subtotal.toFixed(2)} TND</span>
                                      </div>

                                      <div className="mt-2 grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-muted-foreground">
                                            {language === 'en' ? 'Quantity' : 'Quantité'}
                                          </Label>
                                          <p className="font-semibold">{qty}</p>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-muted-foreground">
                                            {language === 'en' ? 'Unit Price' : 'Prix Unitaire'}
                                          </Label>
                                          <p className="font-semibold">{unit.toFixed(2)} TND</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {presaleInfo && typeof presaleInfo.original_subtotal === 'number' && (
                                  <div className="space-y-0.5">
                                    <div className="text-xs sm:text-sm text-muted-foreground">
                                      {language === 'en' ? 'Original Subtotal' : 'Sous-total Initial'}
                                    </div>
                                    <div className="text-xs sm:text-sm text-muted-foreground line-through">
                                      {presaleInfo.original_subtotal.toFixed(2)} TND
                                    </div>
                                  </div>
                                )}

                                {presaleInfo && (
                                  <div className="space-y-0.5">
                                    <div className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
                                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                      <span>{language === 'en' ? 'Presale Code' : 'Code Presale'}:</span>
                                      <span className="font-mono font-semibold text-foreground">
                                        {presaleInfo.code_label || (language === 'en' ? '(no label)' : '(sans libellé)')}
                                      </span>
                                      {formatPresaleDiscount() && (
                                        <Badge className="bg-indigo-500 hover:bg-indigo-500 text-white border-indigo-600 text-[10px] px-1.5 py-0 h-5">
                                          -{formatPresaleDiscount()}
                                        </Badge>
                                      )}
                                    </div>
                                    {presaleInfo?.discount_mode === "per_pass" &&
                                      (presaleInfo.pass_breakdown?.length ?? 0) > 0 && (
                                        <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground list-none">
                                          {presaleInfo.pass_breakdown!.map((row, idx) => (
                                            <li key={row.pass_id ?? idx}>
                                              {formatPresalePassBreakdownRule(row, language)}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    {typeof presaleInfo.original_subtotal === 'number' &&
                                      typeof presaleInfo.discounted_subtotal === 'number' && (
                                        <div className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400">
                                          -{Math.max(0, presaleInfo.original_subtotal - presaleInfo.discounted_subtotal).toFixed(2)} TND
                                        </div>
                                      )}
                                  </div>
                                )}

                                <div className="pt-2 border-t border-border">
                                  <div className="text-xs sm:text-sm font-semibold text-muted-foreground">
                                    {presaleInfo
                                      ? (language === 'en' ? 'Total (after discount)' : 'Total (après remise)')
                                      : (language === 'en' ? 'Total' : 'Total')}
                                  </div>
                                  <div className="text-base sm:text-lg font-semibold">{calculatedTotal.toFixed(2)} TND</div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    {language === 'en' ? 'Customer Information' : 'Informations Client'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {language === 'en' ? 'Name' : 'Nom'}
                      </Label>
                      <p className="font-semibold text-sm sm:text-base">{order.user_name || order.customer_name || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {language === 'en' ? 'Phone' : 'Téléphone'}
                      </Label>
                      <p className="text-sm sm:text-base">{order.user_phone || order.phone || 'N/A'}</p>
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
                                  description: language === 'en' ? 'Email cannot be empty' : "L'e-mail ne peut pas être vide",
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
                                  title: language === 'en' ? 'Success' : 'Succès',
                                  description: language === 'en' 
                                    ? 'Email updated successfully' 
                                    : 'E-mail mis à jour avec succès',
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
                                  description: error.message || (language === 'en' ? 'Failed to update email' : "Échec de la mise à jour de l'e-mail"),
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
                                title: language === 'en' ? 'Success' : 'Succès',
                                description: language === 'en' 
                                  ? 'Admin notes updated successfully' 
                                  : 'Notes administrateur mises à jour avec succès',
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
                                description: error.message || (language === 'en' ? 'Failed to update admin notes' : 'Échec de la mise à jour des notes administrateur'),
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
                            {language === 'en' ? 'No admin notes added yet' : 'Aucune note administrateur ajoutée pour le moment'}
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
                    {language === 'en' ? 'Order Activity Log' : "Journal d'activité de la commande"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto scrollbar-hidden">
                    {!hasAnyActivity ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">{language === 'en' ? 'No activity logs found for this order' : "Aucun journal d'activité trouvé pour cette commande"}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {codApprovalAttribution ? (
                          <div className="flex items-start gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-colors">
                            <div className="mt-0.5">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant="default" className="bg-green-500/20 text-green-300 border-green-500/30">
                                  {language === "en" ? "Approved" : "Approuvé"}
                                </Badge>
                                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                  {language === "en" ? "Admin" : "Admin"}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <p className="break-words whitespace-normal">
                                  {language === "en" ? "Approved by" : "Approuvé par"}:{" "}
                                  <span className="font-medium text-foreground">
                                    {codApprovalAttribution.approvedByLabel ??
                                      (language === "en" ? "Not recorded" : "Non enregistré")}
                                  </span>
                                </p>
                              </div>
                              {codApprovalAttribution.approvedAt ? (
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatActivityLogRelativeTime(codApprovalAttribution.approvedAt)}</span>
                                  <span className="text-muted-foreground/50">{"\u2022"}</span>
                                  <span>
                                    {new Date(codApprovalAttribution.approvedAt).toLocaleTimeString(
                                      language === "en" ? "en-US" : "fr-FR",
                                      { hour: "2-digit", minute: "2-digit" }
                                    )}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {codRejectionAttribution ? (
                          <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                            <div className="mt-0.5">
                              <XCircle className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant="destructive">{language === "en" ? "Rejected" : "Rejeté"}</Badge>
                                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                  {language === "en" ? "Admin" : "Admin"}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <p className="break-words whitespace-normal">
                                  {language === "en" ? "Rejected by" : "Rejeté par"}:{" "}
                                  <span className="font-medium text-foreground">
                                    {codRejectionAttribution.rejectedByLabel ??
                                      (language === "en" ? "Not recorded" : "Non enregistré")}
                                  </span>
                                </p>
                                {codRejectionAttribution.rejectionReason ? (
                                  <p className="italic break-words whitespace-normal">
                                    {language === "en" ? "Reason" : "Raison"}: {codRejectionAttribution.rejectionReason}
                                  </p>
                                ) : null}
                              </div>
                              {codRejectionAttribution.rejectedAt ? (
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatActivityLogRelativeTime(codRejectionAttribution.rejectedAt)}</span>
                                  <span className="text-muted-foreground/50">{"\u2022"}</span>
                                  <span>
                                    {new Date(codRejectionAttribution.rejectedAt).toLocaleTimeString(
                                      language === "en" ? "en-US" : "fr-FR",
                                      { hour: "2-digit", minute: "2-digit" }
                                    )}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {uniqueOrderActivityLogs.map((log: any) => {
                          const getActionIcon = () => {
                            switch (log.action) {
                              case "approved":
                                return <CheckCircle className="w-4 h-4 text-green-500" />;
                              case "rejected":
                                return <XCircle className="w-4 h-4 text-red-500" />;
                              case "cancelled":
                                return <XCircle className="w-4 h-4 text-orange-500" />;
                              case "status_changed":
                                return <RefreshCw className="w-4 h-4 text-blue-500" />;
                              case "created":
                                return <Plus className="w-4 h-4 text-purple-500" />;
                              default:
                                return <Clock className="w-4 h-4 text-muted-foreground" />;
                            }
                          };

                          const getActionBadge = () => {
                            const actionMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                              approved: { label: language === "en" ? "Approved" : "Approuvé", variant: "default" },
                              rejected: { label: language === "en" ? "Rejected" : "Rejeté", variant: "destructive" },
                              cancelled: { label: language === "en" ? "Cancelled" : "Annulé", variant: "destructive" },
                              status_changed: { label: language === "en" ? "Status Changed" : "Statut modifié", variant: "secondary" },
                              created: { label: language === "en" ? "Created" : "Créé", variant: "outline" },
                            };
                            const actionInfo = actionMap[log.action] || { label: log.action, variant: "outline" as const };
                            return (
                              <Badge
                                variant={actionInfo.variant}
                                className={actionInfo.variant === "default" ? "bg-green-500/20 text-green-300 border-green-500/30" : ""}
                              >
                                {actionInfo.label}
                              </Badge>
                            );
                          };

                          const getPerformedByBadge = () => {
                            const typeMap: Record<string, { label: string; color: string }> = {
                              admin: { label: language === "en" ? "Admin" : "Admin", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                              ambassador: { label: language === "en" ? "Ambassador" : "Ambassadeur", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
                              system: { label: language === "en" ? "System" : "Système", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
                            };
                            const typeInfo = typeMap[log.performed_by_type] || {
                              label: log.performed_by_type || "N/A",
                              color: "bg-muted text-muted-foreground border-border",
                            };
                            return (
                              <Badge variant="outline" className={typeInfo.color}>
                                {typeInfo.label}
                              </Badge>
                            );
                          };

                          return (
                            <div
                              key={log.id}
                              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50 hover:bg-muted/50 transition-colors"
                            >
                              <div className="mt-0.5">{getActionIcon()}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {getActionBadge()}
                                  {getPerformedByBadge()}
                                </div>
                                {log.details && typeof log.details === "object" && (
                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    {log.details.old_status && log.details.new_status && (
                                      <p className="break-words whitespace-normal">
                                        {language === "en" ? "Status" : "Statut"}:
                                        <span className="ml-1 font-medium break-all">{log.details.old_status}</span>
                                        <span className="mx-1">{"\u2192"}</span>
                                        <span className="font-medium break-all">{log.details.new_status}</span>
                                      </p>
                                    )}
                                    {log.details.reason && (
                                      <p className="italic break-words whitespace-normal">
                                        {language === "en" ? "Reason" : "Raison"}: {log.details.reason}
                                      </p>
                                    )}
                                    {log.details.email_sent !== undefined && (
                                      <p className="break-words whitespace-normal">
                                        {language === "en" ? "Email" : "Email"}:
                                        <span className={`ml-1 ${log.details.email_sent ? "text-green-500" : "text-red-500"}`}>
                                          {log.details.email_sent
                                            ? language === "en"
                                              ? "Sent"
                                              : "Envoyé"
                                            : language === "en"
                                              ? "Failed"
                                              : "Échoué"}
                                        </span>
                                      </p>
                                    )}
                                    {log.details.sms_sent !== undefined && (
                                      <p className="break-words whitespace-normal">
                                        {language === "en" ? "SMS" : "SMS"}:
                                        <span className={`ml-1 ${log.details.sms_sent ? "text-green-500" : "text-red-500"}`}>
                                          {log.details.sms_sent
                                            ? language === "en"
                                              ? "Sent"
                                              : "Envoyé"
                                            : language === "en"
                                              ? "Failed"
                                              : "Échoué"}
                                        </span>
                                      </p>
                                    )}
                                    {log.details.tickets_generated !== undefined && (
                                      <p>
                                        {language === "en" ? "Tickets" : "Billets"}:
                                        <span className={`ml-1 ${log.details.tickets_generated ? "text-green-500" : "text-red-500"}`}>
                                          {log.details.tickets_generated
                                            ? language === "en"
                                              ? "Generated"
                                              : "Générés"
                                            : language === "en"
                                              ? "Failed"
                                              : "Échoué"}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatActivityLogRelativeTime(log.created_at)}</span>
                                  <span className="text-muted-foreground/50">{"\u2022"}</span>
                                  <span>
                                    {new Date(log.created_at).toLocaleTimeString(language === "en" ? "en-US" : "fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
                        {loadingEmailLogs ? <Loader size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
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
                                  {log.status === 'sent' ? (language === 'en' ? 'Sent' : 'Envoyé') :
                                   log.status === 'failed' ? (language === 'en' ? 'Failed' : 'Échoué') :
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
                                <strong>{language === 'en' ? 'To:' : 'À:'}</strong> {log.recipient_email}
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
                                        title: language === 'en' ? 'Email Resent' : 'E-mail renvoyé',
                                        description: language === 'en' ? 'The completion email has been resent successfully.' : "L'e-mail de confirmation a été renvoyé avec succès.",
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
                                        description: errorData.details || errorData.error || (language === 'en' ? 'Failed to resend email.' : "Échec du renvoi de l'e-mail."),
                                        variant: 'destructive',
                                      });
                                    }
                                  } catch (error) {
                                    console.error('Error resending email:', error);
                                    toast({
                                      title: language === 'en' ? 'Error' : 'Erreur',
                                      description: language === 'en' ? 'Failed to resend email.' : "Échec du renvoi de l'e-mail.",
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setResendingEmail(false);
                                  }
                                }}
                                disabled={resendingEmail}
                                className="w-full"
                              >
                                {resendingEmail ? <Loader size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                {language === 'en' ? 'Resend Email' : 'Renvoyer l\'Email'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {language === 'en' ? 'No email delivery logs found. The completion email may not have been sent yet.' : "Aucun journal de livraison e-mail trouvé. L'e-mail de confirmation n'a peut-être pas encore été envoyé."}
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
                                    title: language === 'en' ? 'Email Sent' : 'E-mail envoyé',
                                    description: language === 'en' ? 'The completion email has been sent successfully.' : "L'e-mail de confirmation a été envoyé avec succès.",
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
                                    description: errorData.details || errorData.error || (language === 'en' ? 'Failed to send email.' : "Échec de l'envoi de l'e-mail."),
                                    variant: 'destructive',
                                  });
                                }
                              } catch (error: any) {
                                console.error('Error sending email:', error);
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error?.message || (language === 'en' ? 'Failed to send email. Please check server logs for details.' : "Échec de l'envoi de l'e-mail. Veuillez vérifier les journaux du serveur."),
                                  variant: 'destructive',
                                });
                              } finally {
                                setResendingEmail(false);
                              }
                            }}
                            disabled={resendingEmail}
                          >
                            {resendingEmail ? <Loader size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            {language === 'en' ? 'Send Completion Email' : 'Envoyer l\'Email de Confirmation'}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Admin Actions (workflow + remove order) */}
              {((order.status === 'PENDING_CASH' ||
                (order.status === 'PENDING_ADMIN_APPROVAL' && order.payment_method === 'ambassador_cash')) ||
                (order.status !== 'PAID' && order.status !== 'REMOVED_BY_ADMIN')) && (
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
                            onClick={async () => {
                              setIsApproving(true);
                              try {
                                await onApprove(order.id);
                              } finally {
                                setIsApproving(false);
                              }
                            }}
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={isApproving}
                          >
                            {isApproving ? <Loader size="sm" className="mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            {isApproving ? (language === 'en' ? 'Approving...' : 'Approbation...') : (language === 'en' ? 'Approve Order' : 'Approuver la Commande')}
                          </Button>
                          <Button
                            onClick={() => {
                              setRejectingOrderId(order.id);
                              setIsRejectDialogOpen(true);
                            }}
                            variant="destructive"
                            size="sm"
                            disabled={isRejecting}
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
                          onClick={async () => {
                            setIsCompleting(true);
                            try {
                              await onComplete(order.id);
                            } finally {
                              setIsCompleting(false);
                            }
                          }}
                          variant="default"
                          size="sm"
                          disabled={isCompleting}
                        >
                          {isCompleting ? <Loader size="sm" className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          {isCompleting ? (language === 'en' ? 'Completing...' : 'En cours...') : (language === 'en' ? 'Complete Order' : 'Terminer la Commande')}
                        </Button>
                      )}
                      
                      {/* Legacy status support (for backward compatibility) */}
                      {order.status === 'PENDING' && order.payment_method !== 'ambassador_cash' && (
                        <Button
                          onClick={async () => {
                            setIsApproving(true);
                            try {
                              await onApprove(order.id);
                            } finally {
                              setIsApproving(false);
                            }
                          }}
                          variant="default"
                          size="sm"
                          disabled={isApproving}
                        >
                          {isApproving ? <Loader size="sm" className="mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          {isApproving ? (language === 'en' ? 'Approving...' : 'Approbation...') : (language === 'en' ? 'Accept Order' : 'Accepter la Commande')}
                        </Button>
                      )}
                      {order.status === 'ACCEPTED' && order.payment_method !== 'ambassador_cash' && (
                        <Button
                          onClick={async () => {
                            setIsCompleting(true);
                            try {
                              await onComplete(order.id);
                            } finally {
                              setIsCompleting(false);
                            }
                          }}
                          variant="default"
                          size="sm"
                          disabled={isCompleting}
                        >
                          {isCompleting ? <Loader size="sm" className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          {isCompleting ? (language === 'en' ? 'Completing...' : 'En cours...') : (language === 'en' ? 'Complete Order' : 'Terminer la Commande')}
                        </Button>
                      )}

                      {order.status !== 'PAID' && order.status !== 'REMOVED_BY_ADMIN' && (
                        <Button
                          onClick={() => {
                            setRemovingOrderId(order.id);
                            setIsRemoveDialogOpen(true);
                          }}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {language === 'en' ? 'Remove Order' : 'Retirer la Commande'}
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
                        {resendingTicketEmail ? <Loader size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
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

              <AdminOrderQrTicketsSection
                orderId={order.id != null && String(order.id).length > 0 ? String(order.id) : null}
                open={open}
                language={language}
                isSuperAdmin={isSuperAdmin}
              />
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
                    <Loader size="sm" className="mr-2" />
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
                disabled={isRejecting}
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
                  setIsRejecting(true);
                  try {
                    await onReject(rejectingOrderId, rejectionReason.trim());
                    setIsRejectDialogOpen(false);
                    setRejectingOrderId(null);
                    setRejectionReason("");
                  } catch {
                    // Error toast already shown by handler
                  } finally {
                    setIsRejecting(false);
                  }
                }}
                disabled={!rejectionReason.trim() || isRejecting}
              >
                {isRejecting ? <Loader size="sm" className="mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                {isRejecting ? (language === "en" ? "Rejecting..." : "Rejet en cours...") : (language === "en" ? "Reject Order" : "Rejeter la Commande")}
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
                    <Loader size="sm" className="mr-2" />
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