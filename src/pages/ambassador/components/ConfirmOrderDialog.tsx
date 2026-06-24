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
import { CheckCircle } from "lucide-react";
import type { Order } from "../types";
import { OrderSummaryCard } from "./OrderSummaryCard";

export interface ConfirmOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onConfirm: () => void;
  language: "en" | "fr";
  title: string;
  confirmLabel: string;
  backLabel: string;
}

function getCopy(language: "en" | "fr") {
  return language === "en"
    ? {
        description:
          "Only confirm if you have collected the full cash payment from the client.",
        helper: "Once confirmed, the order is sent for admin approval.",
      }
    : {
        description:
          "Confirmez uniquement si vous avez bien reçu le paiement en espèces du client.",
        helper: "Une fois confirmée, la commande est envoyée pour approbation admin.",
      };
}

function ConfirmOrderActions({
  backLabel,
  confirmLabel,
  onBack,
  onConfirm,
  className,
}: {
  backLabel: string;
  confirmLabel: string;
  onBack: () => void;
  onConfirm: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>
      <Button type="button" variant="outline" onClick={onBack} className="sm:min-w-[7rem]">
        {backLabel}
      </Button>
      <Button
        type="button"
        onClick={onConfirm}
        className="sm:min-w-[9rem] bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40"
      >
        <CheckCircle className="mr-2 h-4 w-4" aria-hidden />
        {confirmLabel}
      </Button>
    </div>
  );
}

export function ConfirmOrderDialog({
  open,
  onOpenChange,
  order,
  onConfirm,
  language,
  title,
  confirmLabel,
  backLabel,
}: ConfirmOrderDialogProps) {
  const isMobile = useIsMobile();
  const copy = getCopy(language);

  const handleBack = () => onOpenChange(false);

  const body = order ? (
    <div className="space-y-3">
      <OrderSummaryCard order={order} />
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.helper}</p>
    </div>
  ) : null;

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

          <div className="overflow-y-auto px-5 pb-2">{body}</div>

          <DrawerFooter className="border-t border-border/50 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <ConfirmOrderActions
              backLabel={backLabel}
              confirmLabel={confirmLabel}
              onBack={handleBack}
              onConfirm={onConfirm}
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

        <div className="px-6 py-5">{body}</div>

        <DialogFooter className="border-t border-border/50 px-6 py-4">
          <ConfirmOrderActions
            backLabel={backLabel}
            confirmLabel={confirmLabel}
            onBack={handleBack}
            onConfirm={onConfirm}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
