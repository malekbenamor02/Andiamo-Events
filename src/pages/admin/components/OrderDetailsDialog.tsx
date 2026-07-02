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
  ADMIN_ORDER_DETAILS_DIALOG_CLASS,
  AdminOrderDetailsField,
  AdminOrderDetailsGrid,
  AdminOrderDetailsSection,
  AdminPassTypePill,
  AdminOrderStatusPill,
  AdminOrderTagPill,
  formatAdminOrderDateTime,
  formatAdminOrderSource,
} from "./adminOrderDetailsUi";
import {
  formatPresaleOrderDiscountLabel,
  formatPresalePassBreakdownRule,
  parsePresaleOrderSnapshot,
  type PresaleOrderSnapshot,
} from "@/lib/presale/presaleDiscount";
import {
  formatPromoOrderDiscountLabel,
  orderHasPromoAttribution,
  parsePromoFromOrder,
  resolvePromoBadgeColor,
  type PromoOrderSnapshot,
} from "@/lib/eventPromo/promoOrder";
import { PromoCodeColorBadge } from "@/components/admin/PromoCodeColorBadge";
import { formatPromoPassBreakdownRule } from "@/lib/eventPromo/discountPolicy";
import { AdminOrderQrTicketsSection } from "./AdminOrderQrTicketsSection";
import {
  AdminOrderActionConfirm,
  ADMIN_ORDER_CONFIRM_CLOSE_MS,
  type AdminOrderConfirmAction,
} from "./AdminOrderActionConfirm";
import {
  AdminResendEmailConfirm,
  ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS,
  type AdminResendEmailKind,
} from "./AdminResendEmailConfirm";
import {
  Package, FileText, Activity, Database, Calendar as CalendarIcon, Clock,
  User, Phone, Mail, MapPin, Ticket, Save, X, Edit, RefreshCw, Send,
  Wrench, CheckCircle, XCircle, MailCheck, Plus, Tag, ArrowRightLeft
} from "lucide-react";
import { ChangeAmbassadorDialog } from "./ChangeAmbassadorDialog";
import {
  canShowChangeAmbassadorAction,
  formatAdminReassignedAmbassadorNotificationResult,
  formatAdminReassignedCustomerNotificationResult,
  formatOrderActivityDateTime,
  type AdminReassignedLogDetails,
} from "@/lib/admin/orderActivityLogDisplay";

function isAmbassadorCashOrder(order: Record<string, unknown>): boolean {
  const paymentMethod = String(order.payment_method ?? "");
  const source = String(order.source ?? "");
  return (
    paymentMethod === "ambassador_cash" ||
    paymentMethod === "cod" ||
    source === "platform_cod" ||
    source === "ambassador_manual"
  );
}

function shouldShowAmbassadorOrderActions(order: Record<string, unknown>): boolean {
  const status = String(order.status ?? "");
  return status !== "PAID" && status !== "REMOVED_BY_ADMIN";
}

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
  /** Required for change-ambassador mutation (orders:manage). */
  canManageOrders?: boolean;
  onRefreshOrderLogs?: () => void | Promise<void>;
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
  canManageOrders = false,
  onRefreshOrderLogs,
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
  const [resendConfirmKind, setResendConfirmKind] = useState<AdminResendEmailKind | null>(null);
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<AdminOrderConfirmAction | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isChangeAmbassadorOpen, setIsChangeAmbassadorOpen] = useState(false);

  const showChangeAmbassador =
    canManageOrders && order != null && canShowChangeAmbassadorAction(order as Record<string, unknown>);
  const orderAmbassadorName =
    order != null
      ? String((order as Record<string, unknown>).ambassador_name ?? "—")
      : "—";

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

  const promoInfo: PromoOrderSnapshot | null = order ? parsePromoFromOrder(order as { notes?: unknown }) : null;
  const isPromoOrder = order ? orderHasPromoAttribution(order as { event_promo_code_id?: string | null; notes?: unknown }) : false;
  const promoBadgeColor = resolvePromoBadgeColor(promoInfo, order as { event_promo_codes?: { badge_color?: string } | null });

  const formatPresaleDiscount = () => formatPresaleOrderDiscountLabel(presaleInfo, language);
  const formatPromoDiscount = () => formatPromoOrderDiscountLabel(promoInfo, language);

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

  const openConfirmAction = (action: AdminOrderConfirmAction) => {
    setActionReason("");
    setConfirmAction(action);
    setIsConfirmOpen(true);
  };

  const scheduleConfirmCleanup = () => {
    window.setTimeout(() => {
      setConfirmAction(null);
      setActionReason("");
    }, ADMIN_ORDER_CONFIRM_CLOSE_MS);
  };

  const closeConfirmAction = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsConfirmOpen(true);
      return;
    }
    setIsConfirmOpen(false);
    scheduleConfirmCleanup();
  };

  const handleConfirmAction = async () => {
    if (!order?.id || !confirmAction) return;
    const orderId = String(order.id);

    if (confirmAction === "reject" && !actionReason.trim()) {
      toast({
        title: language === "en" ? "Reason required" : "Raison requise",
        description:
          language === "en"
            ? "Please enter a rejection reason."
            : "Veuillez saisir une raison de rejet.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingAction(true);
    try {
      if (confirmAction === "approve") {
        setIsApproving(true);
        await onApprove(orderId);
      } else if (confirmAction === "reject") {
        setIsRejecting(true);
        await onReject(orderId, actionReason.trim());
      } else if (confirmAction === "skip") {
        await onSkip(orderId, actionReason.trim() || undefined);
      } else {
        await onRemove(orderId);
      }
      setIsConfirmOpen(false);
      scheduleConfirmCleanup();
    } catch {
      // Error toast already shown by handler
    } finally {
      setIsSubmittingAction(false);
      setIsApproving(false);
      setIsRejecting(false);
    }
  };

  const openResendConfirm = (kind: AdminResendEmailKind) => {
    setResendConfirmKind(kind);
    setIsResendConfirmOpen(true);
  };

  const closeResendConfirm = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsResendConfirmOpen(true);
      return;
    }
    setIsResendConfirmOpen(false);
    window.setTimeout(() => setResendConfirmKind(null), ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS);
  };

  const handleResendCompletionEmail = async () => {
    if (!order?.id) return;
    setResendingEmail(true);
    try {
      const response = await apiFetch(API_ROUTES.RESEND_ORDER_COMPLETION_EMAIL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (response.ok) {
        toast({
          title:
            resendConfirmKind === "completion-first"
              ? language === "en"
                ? "Email sent"
                : "E-mail envoyé"
              : language === "en"
                ? "Email resent"
                : "E-mail renvoyé",
          description:
            resendConfirmKind === "completion-first"
              ? language === "en"
                ? "The completion email has been sent successfully."
                : "L'e-mail de confirmation a été envoyé avec succès."
              : language === "en"
                ? "The completion email has been resent successfully."
                : "L'e-mail de confirmation a été renvoyé avec succès.",
          variant: "default",
        });
        const logsResponse = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(order.id));
        if (logsResponse.ok) {
          const data = await logsResponse.json();
          setEmailDeliveryLogs(data.logs || []);
        }
        setIsResendConfirmOpen(false);
        window.setTimeout(() => setResendConfirmKind(null), ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        toast({
          title: language === "en" ? "Error" : "Erreur",
          description:
            errorData.details ||
            errorData.error ||
            (language === "en" ? "Failed to resend email." : "Échec du renvoi de l'e-mail."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error resending email:", error);
      toast({
        title: language === "en" ? "Error" : "Erreur",
        description: language === "en" ? "Failed to resend email." : "Échec du renvoi de l'e-mail.",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleConfirmResendEmail = async () => {
    if (!order?.id || !resendConfirmKind) return;
    if (resendConfirmKind === "ticket") {
      setIsResendConfirmOpen(false);
      window.setTimeout(() => setResendConfirmKind(null), ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS);
      await onResendTicket(String(order.id));
      return;
    }
    await handleResendCompletionEmail();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={ADMIN_ORDER_DETAILS_DIALOG_CLASS}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-border/60 px-5 py-4 sm:px-6">
            <DialogTitle className="text-base font-semibold">
              {language === "en" ? "Ambassador order details" : "Détails commande ambassadeur"}
            </DialogTitle>
          </DialogHeader>
          {order && (
            <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain break-words px-5 py-5 scrollbar-hidden sm:px-6">
              <AdminOrderDetailsSection title={language === "en" ? "Order summary" : "Résumé"}>
                <AdminOrderDetailsGrid>
                  <AdminOrderDetailsField label={language === "en" ? "Order number" : "N° commande"}>
                    <span className="font-mono">
                      #{order.order_number != null ? String(order.order_number) : String(order.id)}
                    </span>
                  </AdminOrderDetailsField>
                  <AdminOrderDetailsField label={language === "en" ? "Status" : "Statut"}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AdminOrderStatusPill status={String(order.status)} />
                      {isPresaleOrder && (
                        <AdminOrderTagPill>
                          {language === "en" ? "Presale" : "Presale"}
                          {presaleInfo?.code_label ? ` · ${presaleInfo.code_label}` : ""}
                        </AdminOrderTagPill>
                      )}
                      {isPromoOrder && promoInfo?.code && (
                        <PromoCodeColorBadge
                          color={promoBadgeColor}
                          className="inline-flex h-auto items-center gap-1 border px-2 py-0.5 text-xs font-medium"
                        >
                          {language === "en" ? "Promo" : "Promo"}
                          {` · ${promoInfo.code}`}
                        </PromoCodeColorBadge>
                      )}
                    </div>
                  </AdminOrderDetailsField>
                  <AdminOrderDetailsField label={language === "en" ? "Order type" : "Type"}>
                    {formatAdminOrderSource(order.source as string, language)}
                  </AdminOrderDetailsField>
                  <AdminOrderDetailsField label={language === "en" ? "Created" : "Créé le"}>
                    {formatAdminOrderDateTime(order.created_at as string, language)}
                  </AdminOrderDetailsField>
                  {order.status === "PENDING_CASH" && order.expires_at && (
                    <AdminOrderDetailsField label={language === "en" ? "Expires" : "Expire le"}>
                      {formatAdminOrderDateTime(order.expires_at as string, language)}
                    </AdminOrderDetailsField>
                  )}
                </AdminOrderDetailsGrid>
              </AdminOrderDetailsSection>

              <AdminOrderDetailsSection title={language === "en" ? "Passes" : "Passes"}>
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
                              <div className="hidden md:block overflow-hidden rounded-lg border border-border/70">
                                <Table className="w-full">
                                  <TableHeader>
                                    <TableRow className="border-border/70 hover:bg-transparent">
                                      <TableHead className="text-xs text-muted-foreground">{language === 'en' ? 'Pass' : 'Pass'}</TableHead>
                                      <TableHead className="text-xs text-muted-foreground">{language === 'en' ? 'Qty' : 'Qté'}</TableHead>
                                      <TableHead className="text-xs text-muted-foreground">{language === 'en' ? 'Unit' : 'Unité'}</TableHead>
                                      <TableHead className="text-right text-xs text-muted-foreground">{language === 'en' ? 'Subtotal' : 'Sous-total'}</TableHead>
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
                                        <TableRow key={index} className="border-border/70">
                                          <TableCell>
                                            <AdminPassTypePill label={String(passLabel)} />
                                          </TableCell>
                                          <TableCell className="tabular-nums">{pass.quantity || 0}</TableCell>
                                          <TableCell className="tabular-nums">{pass.price?.toFixed(2) || '0.00'} TND</TableCell>
                                          <TableCell className="text-right font-medium tabular-nums">
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
                                    {!presaleInfo && promoInfo && typeof promoInfo.original_subtotal === 'number' && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-right text-sm text-muted-foreground">
                                          {language === 'en' ? 'Original Subtotal' : 'Sous-total Initial'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground line-through">
                                          {promoInfo.original_subtotal.toFixed(2)} TND
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
                                    {promoInfo?.code && (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-right text-sm">
                                          <span className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                                            <Tag className="w-3.5 h-3.5" style={{ color: promoBadgeColor }} />
                                            <span className="text-muted-foreground">
                                              {language === 'en' ? 'Promo Code' : 'Code Promo'}:
                                            </span>
                                            <span className="font-mono font-semibold">{promoInfo.code}</span>
                                            {formatPromoDiscount() && (
                                              <PromoCodeColorBadge
                                                color={promoBadgeColor}
                                                className="text-[10px] px-1.5 py-0 h-5"
                                              >
                                                -{formatPromoDiscount()}
                                              </PromoCodeColorBadge>
                                            )}
                                          </span>
                                          {promoInfo.discount_mode === 'per_pass' &&
                                            (promoInfo.pass_breakdown?.length ?? 0) > 0 && (
                                              <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground text-right list-none">
                                                {promoInfo.pass_breakdown!.map((row, idx) => (
                                                  <li key={row.pass_id ?? idx}>
                                                    {formatPromoPassBreakdownRule(row, language)}
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm font-semibold text-green-600 dark:text-green-400">
                                          {typeof promoInfo.discount_amount === 'number'
                                            ? `-${promoInfo.discount_amount.toFixed(2)} TND`
                                            : typeof promoInfo.original_subtotal === 'number' &&
                                                typeof promoInfo.discounted_subtotal === 'number'
                                              ? `-${Math.max(0, promoInfo.original_subtotal - promoInfo.discounted_subtotal).toFixed(2)} TND`
                                              : '—'}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    <TableRow className="font-bold border-t-2">
                                      <TableCell colSpan={3} className="text-right">
                                        {presaleInfo || promoInfo
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
                                        <AdminPassTypePill label={String(passLabel)} />
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

                                {!presaleInfo && promoInfo && typeof promoInfo.original_subtotal === 'number' && (
                                  <div className="space-y-0.5">
                                    <div className="text-xs sm:text-sm text-muted-foreground">
                                      {language === 'en' ? 'Original Subtotal' : 'Sous-total Initial'}
                                    </div>
                                    <div className="text-xs sm:text-sm text-muted-foreground line-through">
                                      {promoInfo.original_subtotal.toFixed(2)} TND
                                    </div>
                                  </div>
                                )}

                                {promoInfo?.code && (
                                  <div className="space-y-0.5">
                                    <div className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
                                      <Tag className="w-3.5 h-3.5" style={{ color: promoBadgeColor }} />
                                      <span>{language === 'en' ? 'Promo Code' : 'Code Promo'}:</span>
                                      <span className="font-mono font-semibold text-foreground">{promoInfo.code}</span>
                                      {formatPromoDiscount() && (
                                        <PromoCodeColorBadge
                                          color={promoBadgeColor}
                                          className="text-[10px] px-1.5 py-0 h-5"
                                        >
                                          -{formatPromoDiscount()}
                                        </PromoCodeColorBadge>
                                      )}
                                    </div>
                                    {promoInfo.discount_mode === 'per_pass' &&
                                      (promoInfo.pass_breakdown?.length ?? 0) > 0 && (
                                        <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground list-none">
                                          {promoInfo.pass_breakdown!.map((row, idx) => (
                                            <li key={row.pass_id ?? idx}>
                                              {formatPromoPassBreakdownRule(row, language)}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    {(typeof promoInfo.discount_amount === 'number' ||
                                      (typeof promoInfo.original_subtotal === 'number' &&
                                        typeof promoInfo.discounted_subtotal === 'number')) && (
                                      <div className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400">
                                        {typeof promoInfo.discount_amount === 'number'
                                          ? `-${promoInfo.discount_amount.toFixed(2)} TND`
                                          : `-${Math.max(0, promoInfo.original_subtotal! - promoInfo.discounted_subtotal!).toFixed(2)} TND`}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="pt-2 border-t border-border">
                                  <div className="text-xs sm:text-sm font-semibold text-muted-foreground">
                                    {presaleInfo || promoInfo
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
              </AdminOrderDetailsSection>

              <AdminOrderDetailsSection title={language === "en" ? "Customer" : "Client"}>
                <AdminOrderDetailsGrid>
                  <AdminOrderDetailsField label={language === "en" ? "Name" : "Nom"}>
                    <span className="font-medium">{String(order.user_name || order.customer_name || "—")}</span>
                  </AdminOrderDetailsField>
                  <AdminOrderDetailsField label={language === "en" ? "Phone" : "Téléphone"}>
                    {String(order.user_phone || order.phone || "—")}
                  </AdminOrderDetailsField>
                  <AdminOrderDetailsField label={language === "en" ? "Email" : "Email"}>
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
                          <span className="break-all">{String(order.user_email || order.email || "—")}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingEmailValue(String(order.user_email || order.email || ""));
                              setIsEditingEmail(true);
                            }}
                            className="h-7 w-7 shrink-0 p-0"
                            title={language === "en" ? "Edit email" : "Modifier l'email"}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                  </AdminOrderDetailsField>
                  <AdminOrderDetailsField label={language === "en" ? "Location" : "Localisation"}>
                    {order.city || "—"}
                    {order.ville ? ` · ${order.ville}` : ""}
                  </AdminOrderDetailsField>
                </AdminOrderDetailsGrid>
              </AdminOrderDetailsSection>

              <AdminOrderDetailsSection title={language === "en" ? "Ambassador" : "Ambassadeur"}>
                <AdminOrderDetailsGrid>
                  <AdminOrderDetailsField label={language === "en" ? "Assigned ambassador" : "Ambassadeur assigné"}>
                    <span className="font-medium">{orderAmbassadorName}</span>
                  </AdminOrderDetailsField>
                  {showChangeAmbassador && (
                    <AdminOrderDetailsField label={language === "en" ? "Actions" : "Actions"}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setIsChangeAmbassadorOpen(true)}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        {language === "en" ? "Change ambassador" : "Changer d'ambassadeur"}
                      </Button>
                    </AdminOrderDetailsField>
                  )}
                </AdminOrderDetailsGrid>
              </AdminOrderDetailsSection>

              <AdminOrderDetailsSection title={language === "en" ? "Admin notes" : "Notes admin"}>
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
              </AdminOrderDetailsSection>

              <AdminOrderDetailsSection title={language === "en" ? "Activity" : "Activité"}>
                  <div className="max-h-96 overflow-y-auto scrollbar-hidden">
                    {!hasAnyActivity ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">{language === 'en' ? 'No activity logs found for this order' : "Aucun journal d'activité trouvé pour cette commande"}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {codApprovalAttribution ? (
                          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
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
                          <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
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
                              case "admin_reassigned":
                                return <ArrowRightLeft className="w-4 h-4 text-indigo-500" />;
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
                              admin_reassigned: {
                                label: language === "en" ? "Ambassador reassigned" : "Ambassadeur réassigné",
                                variant: "secondary",
                              },
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
                              className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
                            >
                              <div className="mt-0.5">{getActionIcon()}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {getActionBadge()}
                                  {getPerformedByBadge()}
                                </div>
                                {log.details && typeof log.details === "object" && (
                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    {log.action === "admin_reassigned" && (
                                      <>
                                        <p className="break-words whitespace-normal">
                                          {language === "en" ? "From" : "De"}:{" "}
                                          <span className="font-medium text-foreground">
                                            {log.details.old_ambassador_name || "—"}
                                          </span>
                                        </p>
                                        <p className="break-words whitespace-normal">
                                          {language === "en" ? "To" : "Vers"}:{" "}
                                          <span className="font-medium text-foreground">
                                            {log.details.new_ambassador_name || "—"}
                                          </span>
                                        </p>
                                        {log.details.admin_name && (
                                          <p className="break-words whitespace-normal">
                                            {language === "en" ? "By" : "Par"}:{" "}
                                            <span className="font-medium text-foreground">
                                              {log.details.admin_name}
                                            </span>
                                          </p>
                                        )}
                                        {log.details.reason && (
                                          <p className="italic break-words whitespace-normal">
                                            {language === "en" ? "Reason" : "Raison"}: {log.details.reason}
                                          </p>
                                        )}
                                        <p className="break-words whitespace-normal">
                                          {formatAdminReassignedAmbassadorNotificationResult(
                                            log.details as AdminReassignedLogDetails,
                                            language
                                          )}
                                        </p>
                                        <p className="break-words whitespace-normal">
                                          {formatAdminReassignedCustomerNotificationResult(
                                            log.details as AdminReassignedLogDetails,
                                            language
                                          )}
                                        </p>
                                        <p className="break-words whitespace-normal">
                                          {language === "en" ? "Date" : "Date"}:{" "}
                                          {formatOrderActivityDateTime(log.created_at, language)}
                                        </p>
                                      </>
                                    )}
                                    {log.action !== "admin_reassigned" && log.details.old_status && log.details.new_status && (
                                      <p className="break-words whitespace-normal">
                                        {language === "en" ? "Status" : "Statut"}:
                                        <span className="ml-1 font-medium break-all">{log.details.old_status}</span>
                                        <span className="mx-1">{"\u2192"}</span>
                                        <span className="font-medium break-all">{log.details.new_status}</span>
                                      </p>
                                    )}
                                    {log.action !== "admin_reassigned" && log.details.reason && (
                                      <p className="italic break-words whitespace-normal">
                                        {language === "en" ? "Reason" : "Raison"}: {log.details.reason}
                                      </p>
                                    )}
                                    {log.action !== "admin_reassigned" && log.details.email_sent !== undefined && (
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
                                    {log.action !== "admin_reassigned" && log.details.sms_sent !== undefined && (
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
              </AdminOrderDetailsSection>

              {(order.status === 'COMPLETED' || order.status === 'MANUAL_COMPLETED') && order.payment_method === 'ambassador_cash' && (
                <AdminOrderDetailsSection title={language === "en" ? "Email delivery" : "Livraison email"}>
                  <div className="mb-3 flex justify-end">
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
                                onClick={() => openResendConfirm("completion")}
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
                            onClick={() => openResendConfirm("completion-first")}
                            disabled={resendingEmail}
                          >
                            {resendingEmail ? <Loader size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            {language === 'en' ? 'Send Completion Email' : 'Envoyer l\'Email de Confirmation'}
                          </Button>
                        )}
                      </div>
                    )}
                </AdminOrderDetailsSection>
              )}

              {order.status === "PAID" && (
                <AdminOrderDetailsSection title={language === "en" ? "Ticket email" : "Email billets"}>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => openResendConfirm("ticket")}
                      variant="outline"
                      size="sm"
                      disabled={resendingTicketEmail}
                      className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/40"
                    >
                      {resendingTicketEmail ? <Loader size="sm" className="mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      {resendingTicketEmail
                        ? language === "en"
                          ? "Resending..."
                          : "Renvoi en cours..."
                        : language === "en"
                          ? "Resend Ticket Email"
                          : "Renvoyer l'Email des Billets"}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {language === "en"
                        ? "Resend ticket email using existing tickets (max 5 per hour per order)"
                        : "Renvoyer l'email des billets en utilisant les billets existants (max 5 par heure par commande)"}
                    </p>
                  </div>
                </AdminOrderDetailsSection>
              )}

              <AdminOrderQrTicketsSection
                orderId={order.id != null && String(order.id).length > 0 ? String(order.id) : null}
                open={open}
                language={language}
                isSuperAdmin={isSuperAdmin}
              />
            </div>

            {shouldShowAmbassadorOrderActions(order) && (
              <div className="admin-order-details-actions shrink-0 border-t border-border/60 bg-background px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-2 sm:items-end">
                  {(isAmbassadorCashOrder(order) && order.status === "PENDING_ADMIN_APPROVAL") ||
                  order.status === "PENDING_CASH" ||
                  (isAmbassadorCashOrder(order) && order.status === "APPROVED") ||
                  (order.status === "PENDING" && !isAmbassadorCashOrder(order)) ||
                  (order.status === "ACCEPTED" && !isAmbassadorCashOrder(order)) ? (
                    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                      {isAmbassadorCashOrder(order) && order.status === "PENDING_ADMIN_APPROVAL" && (
                        <>
                          <Button
                            type="button"
                            onClick={() => openConfirmAction("approve")}
                            variant="outline"
                            disabled={isApproving || isSubmittingAction}
                            className="h-9 w-full justify-center border-emerald-600/40 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 sm:min-w-[9rem] sm:w-auto"
                          >
                            {language === "en" ? "Approve" : "Approuver"}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => openConfirmAction("reject")}
                            variant="outline"
                            disabled={isRejecting || isSubmittingAction}
                            className="h-9 w-full justify-center border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 sm:min-w-[9rem] sm:w-auto"
                          >
                            {language === "en" ? "Reject" : "Rejeter"}
                          </Button>
                        </>
                      )}

                      {order.status === "PENDING_CASH" && (
                        <Button
                          type="button"
                          onClick={() => openConfirmAction("skip")}
                          variant="outline"
                          disabled={isSubmittingAction}
                          className="h-9 w-full justify-center border-amber-600/40 px-4 text-sm font-medium text-amber-800 hover:bg-amber-500/10 dark:text-amber-200 sm:min-w-[9rem] sm:w-auto"
                        >
                          {language === "en" ? "Skip ambassador" : "Sans ambassadeur"}
                        </Button>
                      )}

                      {isAmbassadorCashOrder(order) && order.status === "APPROVED" && (
                        <Button
                          type="button"
                          onClick={async () => {
                            setIsCompleting(true);
                            try {
                              await onComplete(String(order.id));
                            } finally {
                              setIsCompleting(false);
                            }
                          }}
                          variant="default"
                          size="sm"
                          disabled={isCompleting}
                          className="h-9 w-full justify-center px-4 text-sm font-medium sm:min-w-[9rem] sm:w-auto"
                        >
                          {isCompleting
                            ? language === "en"
                              ? "Completing…"
                              : "En cours…"
                            : language === "en"
                              ? "Complete"
                              : "Terminer"}
                        </Button>
                      )}

                      {order.status === "PENDING" && !isAmbassadorCashOrder(order) && (
                        <Button
                          type="button"
                          onClick={() => openConfirmAction("approve")}
                          variant="default"
                          size="sm"
                          disabled={isApproving || isSubmittingAction}
                          className="h-9 w-full justify-center px-4 text-sm font-medium sm:min-w-[9rem] sm:w-auto"
                        >
                          {language === "en" ? "Accept" : "Accepter"}
                        </Button>
                      )}

                      {order.status === "ACCEPTED" && !isAmbassadorCashOrder(order) && (
                        <Button
                          type="button"
                          onClick={async () => {
                            setIsCompleting(true);
                            try {
                              await onComplete(String(order.id));
                            } finally {
                              setIsCompleting(false);
                            }
                          }}
                          variant="default"
                          size="sm"
                          disabled={isCompleting}
                          className="h-9 w-full justify-center px-4 text-sm font-medium sm:min-w-[9rem] sm:w-auto"
                        >
                          {isCompleting
                            ? language === "en"
                              ? "Completing…"
                              : "En cours…"
                            : language === "en"
                              ? "Complete"
                              : "Terminer"}
                        </Button>
                      )}
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    onClick={() => openConfirmAction("remove")}
                    variant="ghost"
                    disabled={isSubmittingAction}
                    className="h-9 w-full justify-center px-4 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive sm:min-w-[9rem] sm:w-auto"
                  >
                    {language === "en" ? "Remove order" : "Retirer la commande"}
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AdminOrderActionConfirm
        open={isConfirmOpen}
        onOpenChange={closeConfirmAction}
        action={confirmAction}
        order={order}
        language={language}
        reason={actionReason}
        onReasonChange={setActionReason}
        onConfirm={handleConfirmAction}
        isSubmitting={isSubmittingAction}
      />

      <AdminResendEmailConfirm
        open={isResendConfirmOpen}
        onOpenChange={closeResendConfirm}
        kind={resendConfirmKind}
        language={language}
        order={order}
        recipientEmail={order?.user_email ? String(order.user_email) : null}
        onConfirm={handleConfirmResendEmail}
        isSubmitting={
          resendConfirmKind === "ticket" ? resendingTicketEmail : resendingEmail
        }
      />

      {order && (
        <ChangeAmbassadorDialog
          open={isChangeAmbassadorOpen}
          onOpenChange={setIsChangeAmbassadorOpen}
          orderId={String(order.id)}
          currentAmbassadorId={order.ambassador_id as string | undefined}
          currentAmbassadorName={orderAmbassadorName !== "—" ? orderAmbassadorName : null}
          customerCity={order.city as string | undefined}
          customerVille={order.ville as string | undefined}
          language={language}
          onSuccess={async (result) => {
            onOrderUpdate({
              ambassador_id: result.ambassador_id,
              ambassador_name: result.ambassador_name,
            });
            onRefresh(orderFilters?.status);
            await onRefreshOrderLogs?.();
          }}
        />
      )}
    </>
  );
}