import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NewsletterSuccessScreenProps {
  open: boolean;
  onClose: () => void;
  language?: "en" | "fr";
}

function getCopy(language: "en" | "fr") {
  return language === "en"
    ? {
        title: "You're subscribed",
        subtitle: "Thanks for joining our list",
        message:
          "We'll send you updates on upcoming events and ticket releases. You can unsubscribe anytime from any email we send.",
        close: "Close",
      }
    : {
        title: "Inscription confirmée",
        subtitle: "Merci de rejoindre notre liste",
        message:
          "Vous recevrez nos prochains événements et mises en vente de billets. Vous pourrez vous désabonner à tout moment depuis nos emails.",
        close: "Fermer",
      };
}

export function NewsletterSuccessScreen({
  open,
  onClose,
  language = "en",
}: NewsletterSuccessScreenProps) {
  const reducedMotion = useReducedMotion();
  const copy = getCopy(language);
  const duration = reducedMotion ? 0 : undefined;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="newsletter-success-title"
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
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              aria-label={copy.close}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>

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

            <motion.h2
              id="newsletter-success-title"
              className="text-lg font-semibold tracking-tight text-foreground"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.18 }}
            >
              {copy.title}
            </motion.h2>

            <motion.p
              className="mt-1 text-sm text-muted-foreground"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.22 }}
            >
              {copy.subtitle}
            </motion.p>

            <motion.div
              className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-left"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.28 }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.message}</p>
            </motion.div>

            <motion.div
              className="mt-6"
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.36 }}
            >
              <Button
                type="button"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={onClose}
              >
                {copy.close}
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
