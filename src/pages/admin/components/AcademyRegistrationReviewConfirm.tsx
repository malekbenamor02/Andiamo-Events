import { useEffect, useState } from 'react';
import Loader from '@/components/ui/Loader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export const ACADEMY_REGISTRATION_REVIEW_CONFIRM_CLOSE_MS = 300;

export type AcademyRegistrationReviewAction = 'approve' | 'reject';

type AcademyLanguage = 'en' | 'fr';

export interface AcademyRegistrationReviewTarget {
  id: string;
  registration_number: string;
  full_name: string;
  email: string;
  formule: string;
}

export interface AcademyRegistrationReviewConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: AcademyRegistrationReviewAction | null;
  language: AcademyLanguage;
  registration: AcademyRegistrationReviewTarget | null;
  formulaLabel: string;
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

function getActionMeta(action: AcademyRegistrationReviewAction, language: AcademyLanguage): ActionMeta {
  if (language === 'en') {
    if (action === 'approve') {
      return {
        title: 'Approve registration',
        description:
          'Confirms this Academy registration and sends the approval email to the participant.',
        confirm: 'Approve',
        confirmLoading: 'Approving…',
        cancel: 'Cancel',
      };
    }
    return {
      title: 'Reject registration',
      description:
        'Marks this registration as rejected. This action cannot be undone from here.',
      confirm: 'Reject',
      confirmLoading: 'Rejecting…',
      cancel: 'Cancel',
    };
  }

  if (action === 'approve') {
    return {
      title: "Approuver l'inscription",
      description:
        "Confirme cette inscription Academy et envoie l'e-mail d'approbation au participant.",
      confirm: 'Approuver',
      confirmLoading: 'Approbation…',
      cancel: 'Annuler',
    };
  }
  return {
    title: "Refuser l'inscription",
    description: 'Marque cette inscription comme refusée. Cette action est définitive.',
    confirm: 'Refuser',
    confirmLoading: 'Refus…',
    cancel: 'Annuler',
  };
}

function RegistrationStrip({
  registration,
  formulaLabel,
}: {
  registration: AcademyRegistrationReviewTarget;
  formulaLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/20 px-3.5 py-3">
      <p className="truncate text-sm font-medium">{registration.full_name}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{registration.registration_number}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {registration.email} · {formulaLabel}
      </p>
    </div>
  );
}

const MOBILE_SHEET_CLASS =
  'z-[60] flex flex-col rounded-t-[1.25rem] border-border/50 shadow-[0_-12px_48px_rgba(0,0,0,0.45)]';

export function AcademyRegistrationReviewConfirm({
  open,
  onOpenChange,
  action,
  language,
  registration,
  formulaLabel,
  onConfirm,
  isSubmitting,
}: AcademyRegistrationReviewConfirmProps) {
  const isMobile = useIsMobile();
  const [heldAction, setHeldAction] = useState<AcademyRegistrationReviewAction | null>(null);
  const [heldRegistration, setHeldRegistration] = useState<AcademyRegistrationReviewTarget | null>(null);

  useEffect(() => {
    if (action) setHeldAction(action);
  }, [action]);

  useEffect(() => {
    if (registration) setHeldRegistration(registration);
  }, [registration]);

  useEffect(() => {
    if (!open && !action) {
      const timer = window.setTimeout(() => {
        setHeldAction(null);
        setHeldRegistration(null);
      }, ACADEMY_REGISTRATION_REVIEW_CONFIRM_CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, action]);

  const activeAction = action ?? heldAction;
  const activeRegistration = registration ?? heldRegistration;
  if (!activeAction || !activeRegistration) return null;

  const meta = getActionMeta(activeAction, language);
  const isReject = activeAction === 'reject';

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
        variant={isReject ? 'destructive' : 'default'}
        onClick={onConfirm}
        disabled={isSubmitting}
        className={cn(
          'sm:min-w-[9rem]',
          !isReject && 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40'
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

  const summary = (
    <RegistrationStrip registration={activeRegistration} formulaLabel={formulaLabel} />
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isSubmitting) return;
          onOpenChange(nextOpen);
        }}
      >
        <DrawerContent className={MOBILE_SHEET_CLASS}>
          <DrawerHeader className="px-5 pb-2 pt-1 text-left">
            <DrawerTitle className="text-base font-semibold tracking-tight">{meta.title}</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">{meta.description}</DrawerDescription>
          </DrawerHeader>

          <div className="px-5 pb-2">{summary}</div>

          <DrawerFooter className="border-t border-border/40 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          'z-[60] gap-0 overflow-hidden p-0 sm:max-w-[400px]',
          'duration-300 data-[state=closed]:duration-300'
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
