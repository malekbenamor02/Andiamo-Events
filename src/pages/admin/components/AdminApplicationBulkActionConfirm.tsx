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

export type AdminApplicationBulkAction = "approve" | "reject" | "remove";

export const ADMIN_APPLICATION_BULK_CONFIRM_CLOSE_MS = 300;

export interface AdminApplicationBulkActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AdminApplicationBulkAction | null;
  applications: AmbassadorApplication[];
  language: "en" | "fr";
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
  draftName?: string;
}

type ActionMeta = {
  title: string;
  description: string;
  confirm: string;
  confirmLoading: string;
  cancel: string;
};

function getActionMeta(
  action: AdminApplicationBulkAction,
  count: number,
  language: "en" | "fr",
  draftName?: string,
): ActionMeta {
  const n = count.toLocaleString();
  const draft = draftName ? ` « ${draftName} »` : "";

  if (language === "en") {
    if (action === "approve") {
      return {
        title: `Approve ${n} application${count === 1 ? "" : "s"}`,
        description:
          "Each selected pending application will get an ambassador account and login credentials by email.",
        confirm: `Approve ${n}`,
        confirmLoading: "Approving…",
        cancel: "Cancel",
      };
    }
    if (action === "reject") {
      return {
        title: `Reject ${n} application${count === 1 ? "" : "s"}`,
        description:
          "Applicants will be notified by email. They can reapply after 30 days.",
        confirm: `Reject ${n}`,
        confirmLoading: "Rejecting…",
        cancel: "Keep pending",
      };
    }
    return {
      title: `Remove ${n} from draft${draft}`,
      description:
        "Applications stay in the system with their current status. Only the draft link is removed.",
      confirm: `Remove ${n}`,
      confirmLoading: "Removing…",
      cancel: "Cancel",
    };
  }

  if (action === "approve") {
    return {
      title: `Approuver ${n} candidature${count === 1 ? "" : "s"}`,
      description:
        "Chaque candidature en attente sélectionnée recevra un compte ambassadeur et ses identifiants par e-mail.",
      confirm: `Approuver ${n}`,
      confirmLoading: "Approbation…",
      cancel: "Annuler",
    };
  }
  if (action === "reject") {
    return {
      title: `Rejeter ${n} candidature${count === 1 ? "" : "s"}`,
      description:
        "Les candidats seront notifiés par e-mail. Ils pourront postuler à nouveau dans 30 jours.",
      confirm: `Rejeter ${n}`,
      confirmLoading: "Rejet…",
      cancel: "Garder en attente",
    };
  }
  return {
    title: `Retirer ${n} du brouillon${draft}`,
    description:
      "Les candidatures restent dans le système avec leur statut actuel. Seul le lien avec ce brouillon est supprimé.",
    confirm: `Retirer ${n}`,
    confirmLoading: "Retrait…",
    cancel: "Annuler",
  };
}

function ApplicantList({
  applications,
  language,
}: {
  applications: AmbassadorApplication[];
  language: "en" | "fr";
}) {
  const shown = applications.slice(0, 6);
  const remaining = applications.length - shown.length;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 divide-y divide-border/40 max-h-[220px] overflow-y-auto">
      {shown.map((app) => (
        <div key={app.id} className="px-3.5 py-2.5">
          <p className="truncate text-sm font-medium">{app.full_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {app.phone_number}
            {app.email ? ` · ${app.email}` : ""}
          </p>
        </div>
      ))}
      {remaining > 0 && (
        <p className="px-3.5 py-2 text-xs text-muted-foreground">
          +{remaining} {language === "en" ? "more" : "de plus"}
        </p>
      )}
    </div>
  );
}

export function AdminApplicationBulkActionConfirm({
  open,
  onOpenChange,
  action,
  applications,
  language,
  onConfirm,
  isSubmitting,
  draftName,
}: AdminApplicationBulkActionConfirmProps) {
  const isMobile = useIsMobile();
  const [heldAction, setHeldAction] = useState<AdminApplicationBulkAction | null>(null);
  const [heldApplications, setHeldApplications] = useState<AmbassadorApplication[]>([]);

  useEffect(() => {
    if (action) setHeldAction(action);
  }, [action]);

  useEffect(() => {
    if (applications.length > 0) setHeldApplications(applications);
  }, [applications]);

  useEffect(() => {
    if (!open && !action) {
      const timer = window.setTimeout(() => {
        setHeldAction(null);
        setHeldApplications([]);
      }, ADMIN_APPLICATION_BULK_CONFIRM_CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, action]);

  const activeAction = action ?? heldAction;
  if (!activeAction) return null;

  const activeApplications = applications.length > 0 ? applications : heldApplications;
  const meta = getActionMeta(activeAction, activeApplications.length, language, draftName);
  const isReject = activeAction === "reject";
  const isRemove = activeAction === "remove";

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
        variant={isReject || isRemove ? "destructive" : "default"}
        onClick={onConfirm}
        disabled={isSubmitting}
        className={cn(
          "sm:min-w-[9rem]",
          activeAction === "approve" &&
            "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40",
          isRemove &&
            "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600/40",
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

  const summary =
    activeApplications.length > 0 ? (
      <ApplicantList applications={activeApplications} language={language} />
    ) : null;

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isSubmitting) return;
          onOpenChange(nextOpen);
        }}
      >
        <DrawerContent className="admin-application-bulk-confirm z-[60] max-h-[92dvh] border-border/60">
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
          "admin-application-bulk-confirm z-[60] gap-0 overflow-hidden p-0 sm:max-w-[420px]",
          "duration-300 data-[state=closed]:duration-300",
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
