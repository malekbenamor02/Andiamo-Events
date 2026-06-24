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
import type { Order } from "../types";
import { OrderSummaryCard } from "./OrderSummaryCard";

export interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  language: "en" | "fr";
  title: string;
  reasonLabel: string;
  confirmLabel: string;
  keepOrderLabel: string;
}

function getCopy(language: "en" | "fr") {
  return language === "en"
    ? {
        description: "This action cannot be undone. Please explain why you're cancelling.",
        placeholder: "e.g. client unreachable, wrong address, client changed their mind…",
        helper: "Your reason is recorded and may be reviewed by the team.",
      }
    : {
        description: "Cette action est irréversible. Expliquez pourquoi vous annulez.",
        placeholder: "ex. client injoignable, mauvaise adresse, client a changé d'avis…",
        helper: "Votre raison est enregistrée et peut être consultée par l'équipe.",
      };
}

function OrderSummary({ order }: { order: Order }) {
  return <OrderSummaryCard order={order} />;
}

function CancelOrderForm({
  order,
  language,
  reasonLabel,
  reason,
  onReasonChange,
  autoFocus,
}: {
  order: Order | null;
  language: "en" | "fr";
  reasonLabel: string;
  reason: string;
  onReasonChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const copy = getCopy(language);
  const canSubmit = reason.trim().length > 0;

  return (
    <div className="space-y-4">
      {order && <OrderSummary order={order} />}

      <div className="space-y-2">
        <Label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
          {reasonLabel}
          <span className="text-destructive ml-0.5" aria-hidden>
            *
          </span>
        </Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder={copy.placeholder}
          rows={4}
          className={cn(
            "min-h-[112px] resize-none bg-background text-[15px] leading-relaxed",
            "border-border/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0",
            !canSubmit && reason.length > 0 && "border-destructive/40"
          )}
          autoFocus={autoFocus}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.helper}</p>
      </div>
    </div>
  );
}

function CancelOrderActions({
  keepOrderLabel,
  confirmLabel,
  onKeep,
  onConfirm,
  canSubmit,
  className,
}: {
  keepOrderLabel: string;
  confirmLabel: string;
  onKeep: () => void;
  onConfirm: () => void;
  canSubmit: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      <Button type="button" variant="outline" onClick={onKeep} className="sm:min-w-[7rem]">
        {keepOrderLabel}
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={onConfirm}
        disabled={!canSubmit}
        className="sm:min-w-[9rem]"
      >
        {confirmLabel}
      </Button>
    </div>
  );
}

export function CancelOrderDialog({
  open,
  onOpenChange,
  order,
  reason,
  onReasonChange,
  onConfirm,
  language,
  title,
  reasonLabel,
  confirmLabel,
  keepOrderLabel,
}: CancelOrderDialogProps) {
  const isMobile = useIsMobile();
  const copy = getCopy(language);
  const canSubmit = reason.trim().length > 0;

  const handleKeep = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] border-border/60">
          <DrawerHeader className="px-5 pb-2 text-left">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">
              {copy.description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-5 pb-2">
            <CancelOrderForm
              order={order}
              language={language}
              reasonLabel={reasonLabel}
              reason={reason}
              onReasonChange={onReasonChange}
            />
          </div>

          <DrawerFooter className="border-t border-border/50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <CancelOrderActions
              keepOrderLabel={keepOrderLabel}
              confirmLabel={confirmLabel}
              onKeep={handleKeep}
              onConfirm={onConfirm}
              canSubmit={canSubmit}
            />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]">
        <DialogHeader className="space-y-2 border-b border-border/50 px-6 py-5 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <CancelOrderForm
            order={order}
            language={language}
            reasonLabel={reasonLabel}
            reason={reason}
            onReasonChange={onReasonChange}
            autoFocus
          />
        </div>

        <DialogFooter className="border-t border-border/50 px-6 py-4">
          <CancelOrderActions
            keepOrderLabel={keepOrderLabel}
            confirmLabel={confirmLabel}
            onKeep={handleKeep}
            onConfirm={onConfirm}
            canSubmit={canSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
