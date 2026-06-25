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

export const POS_ORDER_APPROVE_CONFIRM_CLOSE_MS = 300;

export interface PosOrderApproveConfirmOrder {
  id: string;
  order_number?: number | null;
  user_name: string;
  user_phone: string;
  total_price: number;
  status: string;
  pos_outlets?: { name?: string } | null;
}

export interface PosOrderApproveConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PosOrderApproveConfirmOrder | null;
  language: "en" | "fr";
  onConfirm: () => void | Promise<void>;
  isSubmitting: boolean;
}

function getMeta(language: "en" | "fr") {
  if (language === "en") {
    return {
      title: "Approve order",
      description: "Tickets will be generated and sent to the customer by email.",
      confirm: "Approve",
      confirmLoading: "Approving…",
      cancel: "Cancel",
    };
  }
  return {
    title: "Approuver la commande",
    description: "Les billets seront générés et envoyés au client par e-mail.",
    confirm: "Approuver",
    confirmLoading: "Approbation…",
    cancel: "Annuler",
  };
}

function OrderStrip({ order }: { order: PosOrderApproveConfirmOrder }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-3.5 py-3">
      <p className="text-sm font-medium">
        #{order.order_number ?? order.id.slice(0, 8)} · {order.user_name}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {order.user_phone}
        {(order.pos_outlets as { name?: string } | null)?.name
          ? ` · ${(order.pos_outlets as { name?: string }).name}`
          : ""}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-primary">
        {order.total_price} DT
      </p>
    </div>
  );
}

export function PosOrderApproveConfirm({
  open,
  onOpenChange,
  order,
  language,
  onConfirm,
  isSubmitting,
}: PosOrderApproveConfirmProps) {
  const isMobile = useIsMobile();
  const [heldOrder, setHeldOrder] = useState<PosOrderApproveConfirmOrder | null>(null);

  useEffect(() => {
    if (order) setHeldOrder(order);
  }, [order]);

  useEffect(() => {
    if (!open && !order) {
      const timer = window.setTimeout(() => setHeldOrder(null), POS_ORDER_APPROVE_CONFIRM_CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open, order]);

  const activeOrder = order ?? heldOrder;
  if (!activeOrder) return null;

  const meta = getMeta(language);

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
        className="sm:min-w-[9rem] bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40"
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

  const summary = <OrderStrip order={activeOrder} />;

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isSubmitting) return;
          onOpenChange(nextOpen);
        }}
      >
        <DrawerContent className="z-[60] max-h-[92dvh] border-border/60">
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
          "z-[60] gap-0 overflow-hidden p-0 sm:max-w-[400px]",
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
