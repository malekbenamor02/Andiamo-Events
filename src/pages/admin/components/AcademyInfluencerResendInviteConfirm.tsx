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

export const ACADEMY_INFLUENCER_RESEND_CONFIRM_CLOSE_MS = 300;

type AcademyLanguage = 'en' | 'fr';

export interface AcademyInfluencerResendTarget {
  id: string;
  full_name: string;
  email: string;
}

export interface AcademyInfluencerResendInviteConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: AcademyLanguage;
  influencer: AcademyInfluencerResendTarget | null;
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
}

type ResendMeta = {
  title: string;
  description: string;
  confirm: string;
  confirmLoading: string;
  cancel: string;
};

function getResendMeta(language: AcademyLanguage): ResendMeta {
  if (language === 'en') {
    return {
      title: 'Resend invitation',
      description:
        'A new temporary password will be emailed to this influencer. Use only if the original invite was not received.',
      confirm: 'Resend invite',
      confirmLoading: 'Sending…',
      cancel: 'Cancel',
    };
  }
  return {
    title: "Renvoyer l'invitation",
    description:
      "Un nouveau mot de passe temporaire sera envoyé par e-mail à cet influenceur. À utiliser seulement si l'invitation initiale n'a pas été reçue.",
    confirm: "Renvoyer l'invitation",
    confirmLoading: 'Envoi…',
    cancel: 'Annuler',
  };
}

function InfluencerStrip({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/20 px-3.5 py-3">
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="truncate text-xs text-muted-foreground">{email}</p>
    </div>
  );
}

const MOBILE_SHEET_CLASS =
  'z-[60] flex flex-col rounded-t-[1.25rem] border-border/50 shadow-[0_-12px_48px_rgba(0,0,0,0.45)]';

export function AcademyInfluencerResendInviteConfirm({
  open,
  onOpenChange,
  language,
  influencer,
  onConfirm,
  isSubmitting,
}: AcademyInfluencerResendInviteConfirmProps) {
  const isMobile = useIsMobile();
  const [heldInfluencer, setHeldInfluencer] = useState<AcademyInfluencerResendTarget | null>(null);

  useEffect(() => {
    if (influencer) setHeldInfluencer(influencer);
  }, [influencer]);

  useEffect(() => {
    if (!open && !influencer) {
      const timer = window.setTimeout(
        () => setHeldInfluencer(null),
        ACADEMY_INFLUENCER_RESEND_CONFIRM_CLOSE_MS
      );
      return () => window.clearTimeout(timer);
    }
  }, [open, influencer]);

  const activeInfluencer = influencer ?? heldInfluencer;
  if (!activeInfluencer) return null;

  const meta = getResendMeta(language);

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
        onClick={onConfirm}
        disabled={isSubmitting}
        className="sm:min-w-[9rem]"
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
    <InfluencerStrip name={activeInfluencer.full_name} email={activeInfluencer.email} />
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
