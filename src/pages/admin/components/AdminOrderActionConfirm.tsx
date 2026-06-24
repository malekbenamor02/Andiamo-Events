import { useEffect, useState } from "react";
import Loader from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AdminOrderSummaryStrip } from "./AdminOrderSummaryStrip";

export type AdminOrderConfirmAction = "approve" | "reject" | "skip" | "remove";

/** Keep in sync with dialog/drawer close animation duration. */
export const ADMIN_ORDER_CONFIRM_CLOSE_MS = 300;

export interface AdminOrderActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AdminOrderConfirmAction | null;
  order: Record<string, unknown> | null;
  language: "en" | "fr";
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
}

type ConfirmVariant = "approve" | "reject" | "skip" | "remove";

type ActionMeta = {
  title: string;
  description: string;
  confirm: string;
  confirmLoading: string;
  cancel: string;
  reasonLabel: string | null;
  reasonPlaceholder: string | null;
  reasonHelper: string | null;
  reasonRequired: boolean;
  variant: ConfirmVariant;
};

function getActionMeta(action: AdminOrderConfirmAction, language: "en" | "fr"): ActionMeta {
  if (language === "en") {
    switch (action) {
      case "approve":
        return {
          title: "Approve order",
          description:
            "The order will be marked approved and tickets will be generated for the customer.",
          confirm: "Approve",
          confirmLoading: "Approving…",
          cancel: "Cancel",
          reasonLabel: null,
          reasonPlaceholder: null,
          reasonHelper: null,
          reasonRequired: false,
          variant: "approve",
        };
      case "reject":
        return {
          title: "Reject order",
          description:
            "The order will be cancelled. The customer and ambassador will be notified.",
          confirm: "Reject order",
          confirmLoading: "Rejecting…",
          cancel: "Keep order",
          reasonLabel: "Reason",
          reasonPlaceholder: "Why is this order being rejected?",
          reasonHelper: "Required. This is stored in the order history.",
          reasonRequired: true,
          variant: "reject",
        };
      case "skip":
        return {
          title: "Approve without ambassador",
          description:
            "Skips waiting for the ambassador to confirm cash. Use only when payment was verified another way.",
          confirm: "Approve without ambassador",
          confirmLoading: "Processing…",
          cancel: "Cancel",
          reasonLabel: "Note",
          reasonPlaceholder: "Optional context for the audit log",
          reasonHelper: "Optional. Helps the team understand why this shortcut was used.",
          reasonRequired: false,
          variant: "skip",
        };
      case "remove":
        return {
          title: "Remove order",
          description:
            "Hides the order from reports and calculations. All data is preserved for audit. This cannot be undone.",
          confirm: "Remove order",
          confirmLoading: "Removing…",
          cancel: "Cancel",
          reasonLabel: null,
          reasonPlaceholder: null,
          reasonHelper: null,
          reasonRequired: false,
          variant: "remove",
        };
    }
  }

  switch (action) {
    case "approve":
      return {
        title: "Approuver la commande",
        description:
          "La commande sera approuvée et les billets seront générés pour le client.",
        confirm: "Approuver",
        confirmLoading: "Approbation…",
        cancel: "Annuler",
        reasonLabel: null,
        reasonPlaceholder: null,
        reasonHelper: null,
        reasonRequired: false,
        variant: "approve",
      };
    case "reject":
      return {
        title: "Rejeter la commande",
        description:
          "La commande sera annulée. Le client et l'ambassadeur seront notifiés.",
        confirm: "Rejeter la commande",
        confirmLoading: "Rejet…",
        cancel: "Garder la commande",
        reasonLabel: "Raison",
        reasonPlaceholder: "Pourquoi cette commande est-elle rejetée ?",
        reasonHelper: "Obligatoire. Enregistrée dans l'historique de la commande.",
        reasonRequired: true,
        variant: "reject",
      };
    case "skip":
      return {
        title: "Approuver sans ambassadeur",
        description:
          "Ignore l'attente de confirmation cash par l'ambassadeur. À utiliser seulement si le paiement a été vérifié autrement.",
        confirm: "Approuver sans ambassadeur",
        confirmLoading: "Traitement…",
        cancel: "Annuler",
        reasonLabel: "Note",
        reasonPlaceholder: "Contexte optionnel pour l'audit",
        reasonHelper: "Optionnel. Aide l'équipe à comprendre pourquoi ce raccourci a été utilisé.",
        reasonRequired: false,
        variant: "skip",
      };
    case "remove":
      return {
        title: "Retirer la commande",
        description:
          "Masque la commande des rapports et calculs. Toutes les données sont conservées. Irréversible.",
        confirm: "Retirer la commande",
        confirmLoading: "Retrait…",
        cancel: "Annuler",
        reasonLabel: null,
        reasonPlaceholder: null,
        reasonHelper: null,
        reasonRequired: false,
        variant: "remove",
      };
  }
}

function confirmButtonClass(variant: ConfirmVariant): string {
  switch (variant) {
    case "approve":
      return "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40";
    case "reject":
    case "remove":
      return "";
    case "skip":
      return "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600/40";
  }
}

function ConfirmActions({
  cancelLabel,
  confirmLabel,
  confirmLoadingLabel,
  onCancel,
  onConfirm,
  isSubmitting,
  canSubmit,
  variant,
  className,
}: {
  cancelLabel: string;
  confirmLabel: string;
  confirmLoadingLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  variant: ConfirmVariant;
  className?: string;
}) {
  const isDestructive = variant === "reject" || variant === "remove";

  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
        className="sm:min-w-[7rem]"
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        variant={isDestructive ? "destructive" : "default"}
        onClick={onConfirm}
        disabled={!canSubmit || isSubmitting}
        className={cn("sm:min-w-[9rem]", !isDestructive && confirmButtonClass(variant))}
      >
        {isSubmitting ? (
          <>
            <Loader size="sm" className="mr-2" />
            {confirmLoadingLabel}
          </>
        ) : (
          confirmLabel
        )}
      </Button>
    </div>
  );
}

function ConfirmBody({
  order,
  meta,
  reason,
  onReasonChange,
}: {
  order: Record<string, unknown> | null;
  meta: ActionMeta;
  reason: string;
  onReasonChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {order && <AdminOrderSummaryStrip order={order} />}

      {meta.reasonLabel && (
        <div className="space-y-2">
          <Label htmlFor="admin-order-action-reason" className="text-sm font-medium">
            {meta.reasonLabel}
            {meta.reasonRequired && (
              <span className="ml-0.5 text-destructive" aria-hidden>
                *
              </span>
            )}
          </Label>
          <Textarea
            id="admin-order-action-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={meta.reasonPlaceholder ?? undefined}
            rows={4}
            className={cn(
              "admin-order-action-confirm-textarea min-h-[100px] resize-none",
              "border-border/80 bg-background text-[15px] leading-relaxed",
              "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"
            )}
          />
          {meta.reasonHelper && (
            <p className="text-xs leading-relaxed text-muted-foreground">{meta.reasonHelper}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminOrderActionConfirm({
  open,
  onOpenChange,
  action,
  order,
  language,
  reason,
  onReasonChange,
  onConfirm,
  isSubmitting,
}: AdminOrderActionConfirmProps) {
  const isMobile = useIsMobile();
  const [heldAction, setHeldAction] = useState<AdminOrderConfirmAction | null>(null);
  const [heldOrder, setHeldOrder] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (action) setHeldAction(action);
  }, [action]);

  useEffect(() => {
    if (order) setHeldOrder(order);
  }, [order]);

  useEffect(() => {
    if (!open && !action) {
      const timer = window.setTimeout(() => {
        setHeldAction(null);
        setHeldOrder(null);
      }, ADMIN_ORDER_CONFIRM_CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, action]);

  const activeAction = action ?? heldAction;
  if (!activeAction) return null;

  const activeOrder = order ?? heldOrder;
  const meta = getActionMeta(activeAction, language);
  const canSubmit = meta.reasonRequired ? reason.trim().length > 0 : true;
  const handleCancel = () => onOpenChange(false);

  const actions = (
    <ConfirmActions
      cancelLabel={meta.cancel}
      confirmLabel={meta.confirm}
      confirmLoadingLabel={meta.confirmLoading}
      onCancel={handleCancel}
      onConfirm={onConfirm}
      isSubmitting={isSubmitting}
      canSubmit={canSubmit}
      variant={meta.variant}
    />
  );

  const body = (
    <ConfirmBody
      order={activeOrder}
      meta={meta}
      reason={reason}
      onReasonChange={onReasonChange}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="admin-order-action-confirm z-[60] max-h-[92dvh] border-border/60">
          <DrawerHeader className="px-5 pb-2 text-left">
            <DrawerTitle className="text-base font-semibold">{meta.title}</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">
              {meta.description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-5 pb-2">{body}</div>

          <DrawerFooter className="border-t border-border/50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            {actions}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "admin-order-action-confirm z-[60] gap-0 overflow-hidden p-0 sm:max-w-[420px]",
          "duration-300 data-[state=closed]:duration-300"
        )}
      >
        <DialogHeader className="space-y-2 border-b border-border/50 px-6 py-5 text-left">
          <DialogTitle className="text-base font-semibold">{meta.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">{body}</div>

        <DialogFooter className="border-t border-border/50 px-6 py-4">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
