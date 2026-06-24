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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AdminOrderSummaryStrip } from "./AdminOrderSummaryStrip";

export const ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS = 300;

export type AdminResendEmailKind = "ticket" | "completion" | "completion-first" | "approval";

export interface AdminResendEmailConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AdminResendEmailKind | null;
  language: "en" | "fr";
  order?: Record<string, unknown> | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
};

type ResendMeta = {
  title: string;
  description: string;
  confirm: string;
  confirmLoading: string;
  cancel: string;
};

function getResendMeta(kind: AdminResendEmailKind, language: "en" | "fr"): ResendMeta {
  if (language === "en") {
    switch (kind) {
      case "ticket":
        return {
          title: "Resend ticket email",
          description:
            "Sends the ticket email again using the existing tickets. Limited to 5 resends per hour per order.",
          confirm: "Resend",
          confirmLoading: "Sending…",
          cancel: "Cancel",
        };
      case "completion":
        return {
          title: "Resend confirmation email",
          description: "Sends the order completion email to the customer again.",
          confirm: "Resend",
          confirmLoading: "Sending…",
          cancel: "Cancel",
        };
      case "completion-first":
        return {
          title: "Send confirmation email",
          description: "Sends the order completion email to the customer.",
          confirm: "Send email",
          confirmLoading: "Sending…",
          cancel: "Cancel",
        };
      case "approval":
        return {
          title: "Resend approval email",
          description:
            "Sends the ambassador login credentials again. Use only if the original email was not received.",
          confirm: "Resend",
          confirmLoading: "Sending…",
          cancel: "Cancel",
        };
    }
  }

  switch (kind) {
    case "ticket":
      return {
        title: "Renvoyer l'email des billets",
        description:
          "Renvoie l'email des billets avec les billets existants. Limité à 5 renvois par heure et par commande.",
        confirm: "Renvoyer",
        confirmLoading: "Envoi…",
        cancel: "Annuler",
      };
    case "completion":
      return {
        title: "Renvoyer l'email de confirmation",
        description: "Renvoie l'email de confirmation de commande au client.",
        confirm: "Renvoyer",
        confirmLoading: "Envoi…",
        cancel: "Annuler",
      };
    case "completion-first":
      return {
        title: "Envoyer l'email de confirmation",
        description: "Envoie l'email de confirmation de commande au client.",
        confirm: "Envoyer",
        confirmLoading: "Envoi…",
        cancel: "Annuler",
      };
    case "approval":
      return {
        title: "Renvoyer l'email d'approbation",
        description:
          "Renvoie les identifiants de connexion ambassadeur. À utiliser seulement si l'email initial n'a pas été reçu.",
        confirm: "Renvoyer",
        confirmLoading: "Envoi…",
        cancel: "Annuler",
      };
  }
}

function RecipientStrip({
  name,
  email,
  phone,
}: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const displayName = name?.trim() || "—";
  const contact = email?.trim() || phone?.trim() || "—";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-3.5 py-3">
      <p className="truncate text-sm font-medium">{displayName}</p>
      <p className="truncate text-xs text-muted-foreground">{contact}</p>
    </div>
  );
}

export function AdminResendEmailConfirm({
  open,
  onOpenChange,
  kind,
  language,
  order,
  recipientEmail,
  recipientName,
  recipientPhone,
  onConfirm,
  isSubmitting,
}: AdminResendEmailConfirmProps) {
  const isMobile = useIsMobile();
  const [heldKind, setHeldKind] = useState<AdminResendEmailKind | null>(null);

  useEffect(() => {
    if (kind) setHeldKind(kind);
  }, [kind]);

  useEffect(() => {
    if (!open && !kind) {
      const timer = window.setTimeout(() => setHeldKind(null), ADMIN_RESEND_EMAIL_CONFIRM_CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, kind]);

  const activeKind = kind ?? heldKind;
  if (!activeKind) return null;

  const meta = getResendMeta(activeKind, language);
  const handleCancel = () => onOpenChange(false);

  const summary =
    order != null ? (
      <AdminOrderSummaryStrip order={order} />
    ) : (
      <RecipientStrip
        name={recipientName}
        email={recipientEmail}
        phone={recipientPhone}
      />
    );

  const actions = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={handleCancel}
        disabled={isSubmitting}
        className="sm:min-w-[7rem]"
      >
        {meta.cancel}
      </Button>
      <Button
        type="button"
        onClick={onConfirm}
        disabled={isSubmitting}
        className="sm:min-w-[9rem] bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600/40"
      >
        {isSubmitting ? (
          <>
            <Loader size="sm" className="mr-2" />
            {meta.confirmLoading}
          </>
        ) : (
          meta.confirm
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="admin-resend-email-confirm z-[60] max-h-[92dvh] border-border/60">
          <DrawerHeader className="px-5 pb-2 text-left">
            <DrawerTitle className="text-base font-semibold">{meta.title}</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">
              {meta.description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-5 pb-2">{summary}</div>

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
          "admin-resend-email-confirm z-[60] gap-0 overflow-hidden p-0 sm:max-w-[400px]",
          "duration-300 data-[state=closed]:duration-300"
        )}
      >
        <DialogHeader className="space-y-2 border-b border-border/50 px-6 py-5 text-left">
          <DialogTitle className="text-base font-semibold">{meta.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">{summary}</div>

        <DialogFooter className="border-t border-border/50 px-6 py-4">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
