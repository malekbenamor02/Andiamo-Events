import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface OrderCancelledSuccessProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "en" | "fr";
  customerName?: string;
  amount?: number;
}

function getCopy(language: "en" | "fr") {
  return language === "en"
    ? {
        title: "Order cancelled",
        description: "The order has been removed from your active list.",
        close: "Close",
      }
    : {
        title: "Commande annulée",
        description: "La commande a été retirée de votre liste active.",
        close: "Fermer",
      };
}

export function OrderCancelledSuccess({
  open,
  onOpenChange,
  language,
  customerName,
  amount,
}: OrderCancelledSuccessProps) {
  const reducedMotion = useReducedMotion();
  const copy = getCopy(language);
  const duration = reducedMotion ? 0 : undefined;

  const dismiss = () => onOpenChange(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          onClick={dismiss}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-success-title"
        >
          <motion.div
            className="absolute inset-0 bg-background/75 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-[340px] rounded-2xl border border-border/80 bg-card px-6 py-8 text-center shadow-xl"
            initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={dismiss}
              aria-label={copy.close}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>

            <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
              <motion.div
                className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-muted"
                initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: duration ?? 0.3, ease: "easeOut" }}
              />
              <motion.div
                className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background"
                initial={reducedMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 24, delay: 0.08 }
                }
              >
                <motion.div
                  initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: duration ?? 0.2, delay: reducedMotion ? 0 : 0.22 }}
                >
                  <X className="h-6 w-6 text-muted-foreground" strokeWidth={2.25} aria-hidden />
                </motion.div>
              </motion.div>
            </div>

            <motion.h2
              id="cancel-success-title"
              className="text-lg font-semibold tracking-tight text-foreground"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.18 }}
            >
              {copy.title}
            </motion.h2>

            <motion.p
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.26 }}
            >
              {copy.description}
            </motion.p>

            {customerName && amount != null && (
              <motion.p
                className="mt-4 border-t border-border/60 pt-4 text-sm text-foreground"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: duration ?? 0.2, delay: reducedMotion ? 0 : 0.32 }}
              >
                <span className="font-medium">{customerName}</span>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <span className="tabular-nums">{amount.toFixed(2)} TND</span>
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
