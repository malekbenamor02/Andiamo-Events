/**
 * Online payment return flow — loading, success, failure, and unknown states.
 * Matches the pass order success overlay visual language.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type OnlinePaymentStatusVariant =
  | "loading"
  | "redirecting"
  | "success"
  | "failed"
  | "unknown";

export interface OnlinePaymentStatusScreenProps {
  variant: OnlinePaymentStatusVariant;
  title: string;
  subtitle?: string;
  message?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  closeLabel?: string;
  onClose?: () => void;
}

function StatusIcon({
  variant,
  reducedMotion,
  duration,
}: {
  variant: OnlinePaymentStatusVariant;
  reducedMotion: boolean | null;
  duration: number | undefined;
}) {
  if (variant === "loading" || variant === "redirecting") {
    return (
      <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
        <motion.div
          className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-muted/60"
          initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: duration ?? 0.3, ease: "easeOut" }}
        />
        <div className="relative flex h-14 w-14 items-center justify-center" aria-hidden>
          <div className="absolute inset-0 rounded-full border-2 border-border/80" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/70 animate-spin" />
        </div>
      </div>
    );
  }

  if (variant === "success") {
    return (
      <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
        <motion.div
          className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-emerald-500/15"
          initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: duration ?? 0.3, ease: "easeOut" }}
        />
        <motion.div
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600"
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
            <Check className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (variant === "unknown") {
    return (
      <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
        <motion.div
          className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-amber-500/15"
          initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: duration ?? 0.3, ease: "easeOut" }}
        />
        <motion.div
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-600"
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
            <AlertCircle className="h-7 w-7 text-white" strokeWidth={2.25} aria-hidden />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (variant === "failed") {
    return (
      <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
        <motion.div
          className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-red-500/10"
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
            <X className="h-6 w-6 text-red-600" strokeWidth={2.25} aria-hidden />
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return null;
}

export function OnlinePaymentStatusScreen({
  variant,
  title,
  subtitle,
  message,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  closeLabel,
  onClose,
}: OnlinePaymentStatusScreenProps) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : undefined;
  const showMessage = !!message && variant !== "loading" && variant !== "redirecting";
  const showActions = variant !== "loading" && variant !== "redirecting";
  const dismiss = onClose ?? onPrimaryAction;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="online-payment-status-title"
        aria-busy={variant === "loading" || variant === "redirecting"}
      >
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative w-full max-w-[380px] rounded-2xl border border-border/80 bg-card px-6 py-8 text-center shadow-xl"
          initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {showActions && closeLabel && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={dismiss}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          )}

          <StatusIcon variant={variant} reducedMotion={reducedMotion} duration={duration} />

          <motion.h2
            id="online-payment-status-title"
            className="text-lg font-semibold tracking-tight text-foreground"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.18 }}
          >
            {title}
          </motion.h2>

          {subtitle && (
            <motion.p
              className="mt-1 text-sm text-muted-foreground"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.22 }}
            >
              {subtitle}
            </motion.p>
          )}

          {showMessage && (
            <motion.div
              className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-left"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.28 }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
            </motion.div>
          )}

          {showActions && (
            <motion.div
              className="mt-6 space-y-2"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.36 }}
            >
              <Button
                type="button"
                className={
                  variant === "success"
                    ? "w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    : "w-full"
                }
                onClick={onPrimaryAction}
              >
                {primaryActionLabel}
              </Button>
              {secondaryActionLabel && onSecondaryAction && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onSecondaryAction}
                >
                  {secondaryActionLabel}
                </Button>
              )}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
