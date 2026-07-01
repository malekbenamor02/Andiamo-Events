/**
 * Presale gate — code entry before ticket selection unlocks.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PresaleInlineError } from "@/lib/presale/presaleRedeemFeedback";
import { cn } from "@/lib/utils";

export interface PresalePortalScreenProps {
  language: "en" | "fr";
  eventName?: string;
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  processingLabel: string;
  inlineError?: PresaleInlineError | null;
  onBackToEvents?: () => void;
}

function getCopy(language: "en" | "fr", eventName?: string) {
  if (language === "en") {
    return {
      title: "Presale access",
      subtitle: eventName
        ? `Enter your code to unlock tickets for ${eventName}.`
        : "Enter your presale code to unlock ticket selection.",
      placeholder: "Presale code",
      submit: "Continue",
      backToHome: "Back to home",
    };
  }

  return {
    title: "Accès prévente",
    subtitle: eventName
      ? `Entrez votre code pour accéder aux billets de ${eventName}.`
      : "Entrez votre code prévente pour débloquer la sélection des billets.",
    placeholder: "Code prévente",
    submit: "Continuer",
    backToHome: "Retour à l'accueil",
  };
}

export function PresalePortalScreen({
  language,
  eventName,
  code,
  onCodeChange,
  onSubmit,
  isSubmitting,
  processingLabel,
  inlineError,
  onBackToEvents,
}: PresalePortalScreenProps) {
  const reducedMotion = useReducedMotion();
  const copy = getCopy(language, eventName);
  const duration = reducedMotion ? 0 : undefined;
  const isWarning = inlineError?.variant === "warning";
  const isError = inlineError?.variant === "error";

  return (
    <AnimatePresence>
      <motion.div
        className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
      >
        <motion.div
          className="relative w-full max-w-[380px] rounded-2xl border border-border/80 bg-card px-6 py-8 text-center shadow-xl"
          initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          role="region"
          aria-labelledby="presale-portal-title"
        >
          <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
            <motion.div
              className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-primary/10"
              initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: duration ?? 0.3, ease: "easeOut" }}
            />
            <motion.div
              className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border/80 bg-muted/40"
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
                <Lock className="h-6 w-6 text-foreground/80" strokeWidth={2.1} aria-hidden />
              </motion.div>
            </motion.div>
          </div>

          <motion.h1
            id="presale-portal-title"
            className="text-lg font-semibold tracking-tight text-foreground"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.18 }}
          >
            {copy.title}
          </motion.h1>

          <motion.p
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.24 }}
          >
            {copy.subtitle}
          </motion.p>

          <motion.form
            onSubmit={onSubmit}
            className="mt-6 space-y-3 text-left"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.3 }}
          >
            <label htmlFor="presale-code" className="sr-only">
              {copy.placeholder}
            </label>
            <Input
              id="presale-code"
              type="text"
              name="presale-code"
              autoComplete="off"
              value={code}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
              placeholder={copy.placeholder}
              disabled={isSubmitting}
              aria-invalid={inlineError ? true : undefined}
              aria-describedby={inlineError ? "presale-code-feedback" : undefined}
              className={cn(
                "h-11 bg-muted/30 text-center tracking-[0.12em] placeholder:tracking-normal",
                isWarning &&
                  "border-amber-400 focus:border-amber-500 focus-visible:border-amber-500 dark:border-amber-500/50 dark:focus:border-amber-500/70 dark:focus-visible:border-amber-500/70",
                isError && "border-destructive focus:border-destructive focus-visible:border-destructive",
                !inlineError && "border-border/60"
              )}
            />
            {inlineError ? (
              <p
                id="presale-code-feedback"
                role={isWarning ? "status" : "alert"}
                className={cn(
                  "rounded-md px-2.5 py-2 text-sm leading-snug",
                  isWarning &&
                    "border bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
                  isError && "bg-destructive/10 text-destructive"
                )}
              >
                {inlineError.message}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn("h-11 w-full", isSubmitting && "disabled:opacity-100")}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin"
                    aria-hidden
                  />
                  {processingLabel}
                </span>
              ) : (
                copy.submit
              )}
            </Button>
          </motion.form>

          {onBackToEvents && (
            <motion.div
              className="mt-5 border-t border-border/60 pt-4"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration ?? 0.2, delay: reducedMotion ? 0 : 0.36 }}
            >
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full py-1 text-sm text-muted-foreground hover:text-foreground"
                onClick={onBackToEvents}
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                {copy.backToHome}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
