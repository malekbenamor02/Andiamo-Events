import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AcademyLanguage } from '@/types/academy';

export interface AcademyRegistrationSuccessScreenProps {
  registrationNumber: string | null;
  message: string;
  isOnlineSuccess: boolean;
  onBackToAcademy: () => void;
  language: AcademyLanguage;
}

function getCopy(language: AcademyLanguage) {
  if (language === 'en') {
    return {
      title: 'Registration received',
      thankYou: 'Thank you for registering',
      reference: 'Reference',
      close: 'Close',
      backToAcademy: 'Back to Academy',
    };
  }

  return {
    title: 'Inscription enregistrée',
    thankYou: 'Merci pour votre inscription',
    reference: 'Référence',
    close: 'Fermer',
    backToAcademy: "Retour à l'Academy",
  };
}

export function AcademyRegistrationSuccessScreen({
  registrationNumber,
  message,
  isOnlineSuccess,
  onBackToAcademy,
  language,
}: AcademyRegistrationSuccessScreenProps) {
  const reducedMotion = useReducedMotion();
  const copy = getCopy(language);
  const duration = reducedMotion ? 0 : undefined;

  const ringClass = isOnlineSuccess ? 'bg-emerald-500/15' : 'bg-amber-500/15';
  const circleClass = isOnlineSuccess ? 'bg-emerald-600' : 'bg-amber-600';
  const buttonClass = isOnlineSuccess
    ? 'w-full bg-emerald-600 text-white hover:bg-emerald-700'
    : 'w-full bg-amber-600 text-white hover:bg-amber-700';

  return (
    <AnimatePresence>
      <motion.div
        className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        role="status"
        aria-live="polite"
        aria-labelledby="academy-registration-success-title"
      >
        <motion.div
          className="relative w-full max-w-[380px] rounded-2xl border border-border/80 bg-card px-6 py-8 text-center shadow-xl"
          initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onBackToAcademy}
            aria-label={copy.close}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>

          <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
            <motion.div
              className={`absolute h-[4.5rem] w-[4.5rem] rounded-full ${ringClass}`}
              initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: duration ?? 0.3, ease: 'easeOut' }}
            />
            <motion.div
              className={`relative flex h-14 w-14 items-center justify-center rounded-full ${circleClass}`}
              initial={reducedMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 24, delay: 0.08 }
              }
            >
              <motion.div
                initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: duration ?? 0.2, delay: reducedMotion ? 0 : 0.22 }}
              >
                {isOnlineSuccess ? (
                  <Check className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Clock className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
                )}
              </motion.div>
            </motion.div>
          </div>

          <motion.h1
            id="academy-registration-success-title"
            className="text-lg font-semibold tracking-tight text-foreground"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.18 }}
          >
            {copy.title}
          </motion.h1>

          <motion.p
            className="mt-1 text-sm text-muted-foreground"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.22 }}
          >
            {copy.thankYou}
          </motion.p>

          <motion.div
            className="mt-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-left"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.28 }}
          >
            <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
          </motion.div>

          {registrationNumber && (
            <motion.div
              className="mt-4 border-t border-border/60 pt-4 text-sm text-foreground"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration ?? 0.2, delay: reducedMotion ? 0 : 0.32 }}
            >
              <p className="text-muted-foreground">{copy.reference}</p>
              <p className="mt-0.5 font-medium tabular-nums">{registrationNumber}</p>
            </motion.div>
          )}

          <motion.div
            className="mt-6"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.36 }}
          >
            <Button type="button" className={buttonClass} onClick={onBackToAcademy}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {copy.backToAcademy}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
