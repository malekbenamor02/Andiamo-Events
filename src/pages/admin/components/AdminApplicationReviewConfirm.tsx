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
import type { AmbassadorApplication } from "../types";

export type AdminApplicationReviewAction = "approve" | "reject";

export const ADMIN_APPLICATION_REVIEW_CONFIRM_CLOSE_MS = 300;

export interface AdminApplicationReviewConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AdminApplicationReviewAction | null;
  application: AmbassadorApplication | null;
  language: "en" | "fr";
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
}

type ActionMeta = {
  title: string;
  description: string;
  confirm: string;
  confirmLoading: string;
  cancel: string;
};

function getActionMeta(
  action: AdminApplicationReviewAction,
  language: "en" | "fr"
): ActionMeta {
  if (language === "en") {
    if (action === "approve") {
      return {
        title: "Approve application",
        description:
          "Creates an ambassador account and sends login credentials by email.",
        confirm: "Approve",
        confirmLoading: "Approving…",
        cancel: "Cancel",
      };
    }
    return {
      title: "Reject application",
      description:
        "The applicant will be notified by email. They can reapply after 30 days.",
      confirm: "Reject",
      confirmLoading: "Rejecting…",
      cancel: "Keep pending",
    };
  }

  if (action === "approve") {
    return {
      title: "Approuver la candidature",
      description:
        "Crée un compte ambassadeur et envoie les identifiants par e-mail.",
      confirm: "Approuver",
      confirmLoading: "Approbation…",
      cancel: "Annuler",
    };
  }
  return {
    title: "Rejeter la candidature",
    description:
      "Le candidat sera notifié par e-mail. Il pourra postuler à nouveau dans 30 jours.",
    confirm: "Rejeter",
    confirmLoading: "Rejet…",
    cancel: "Garder en attente",
  };
}

function ApplicantStrip({ application }: { application: AmbassadorApplication }) {
  const location = [application.city, application.ville].filter(Boolean).join(", ");

  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-3.5 py-3">
      <p className="truncate text-sm font-medium">{application.full_name}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {application.phone_number}
        {application.email ? ` · ${application.email}` : ""}
      </p>
      {location ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{location}</p>
      ) : null}
    </div>
  );
}

export function AdminApplicationReviewConfirm({
  open,
  onOpenChange,
  action,
  application,
  language,
  onConfirm,
  isSubmitting,
}: AdminApplicationReviewConfirmProps) {
  const isMobile = useIsMobile();
  const [heldAction, setHeldAction] = useState<AdminApplicationReviewAction | null>(null);
  const [heldApplication, setHeldApplication] = useState<AmbassadorApplication | null>(null);

  useEffect(() => {
    if (action) setHeldAction(action);
  }, [action]);

  useEffect(() => {
    if (application) setHeldApplication(application);
  }, [application]);

  useEffect(() => {
    if (!open && !action) {
      const timer = window.setTimeout(() => {
        setHeldAction(null);
        setHeldApplication(null);
      }, ADMIN_APPLICATION_REVIEW_CONFIRM_CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, action]);

  const activeAction = action ?? heldAction;
  if (!activeAction) return null;

  const activeApplication = application ?? heldApplication;
  const meta = getActionMeta(activeAction, language);
  const isReject = activeAction === "reject";

  const handleCancel = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

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
        variant={isReject ? "destructive" : "default"}
        onClick={onConfirm}
        disabled={isSubmitting}
        className={cn(
          "sm:min-w-[9rem]",
          !isReject &&
            "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40"
        )}
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

  const summary = activeApplication ? <ApplicantStrip application={activeApplication} /> : null;

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isSubmitting) return;
          onOpenChange(nextOpen);
        }}
      >
        <DrawerContent className="admin-application-review-confirm z-[60] max-h-[92dvh] border-border/60">
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSubmitting) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className={cn(
          "admin-application-review-confirm z-[60] gap-0 overflow-hidden p-0 sm:max-w-[400px]",
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
