import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, AlertCircle, Copy, MapPinOff, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanResult } from "./scannerTypes";
import { getStatusConfig, normalizeResultKind, type ScanResultKind } from "./scannerStatus";
import { SCANNER_BRAND } from "./scannerTheme";
import { ScannerResultValid } from "./ScannerResultValid";
import { ScannerResultDuplicate, ScannerResultWrongEvent, ScannerResultInvalid } from "./ScannerResultDuplicate";
import { ScannerResultInspect } from "./ScannerResultInspect";

interface ScannerResultSheetProps {
  open: boolean;
  result: ScanResult | null;
  undoSecondsLeft: number;
  onOpenChange: (open: boolean) => void;
  onScanNext: () => void;
}

type OverlayTone = "success" | "warning" | "error" | "info";

function overlayTone(kind: ScanResultKind): OverlayTone {
  if (kind === "valid") return "success";
  if (kind === "ok") return "info";
  if (kind === "already_scanned" || kind === "wrong_event") return "warning";
  return "error";
}

function ResultBody({ result }: { result: ScanResult }) {
  const kind = normalizeResultKind(result.result === "disabled" ? "invalid" : result.result);

  if (kind === "ok" && result.lookup && result.inspect_panel) {
    return <ScannerResultInspect result={result} />;
  }

  switch (kind) {
    case "valid":
      return <ScannerResultValid result={result} />;
    case "already_scanned":
      return <ScannerResultDuplicate result={result} />;
    case "wrong_event":
      return <ScannerResultWrongEvent result={result} />;
    default:
      return <ScannerResultInvalid result={result} />;
  }
}

function hasDetailBody(result: ScanResult, kind: ScanResultKind): boolean {
  if (kind === "ok" && result.inspect_panel) return true;
  if (kind === "valid" && result.ticket) return true;
  if (kind === "already_scanned" && (result.previous_scan || result.ticket)) return true;
  if (kind === "wrong_event" && (result.correct_event || result.ticket)) return true;
  return false;
}

function OverlayStatusIcon({
  tone,
  kind,
  reducedMotion,
  duration,
}: {
  tone: OverlayTone;
  kind: ScanResultKind;
  reducedMotion: boolean | null;
  duration: number | undefined;
}) {
  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 24, delay: 0.08 };

  if (tone === "success") {
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
          transition={spring}
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

  if (tone === "info") {
    return (
      <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
        <motion.div
          className="absolute h-[4.5rem] w-[4.5rem] rounded-full bg-sky-500/15"
          initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: duration ?? 0.3, ease: "easeOut" }}
        />
        <motion.div
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-sky-600"
          initial={reducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring}
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

  if (tone === "warning") {
    const WarningIcon = kind === "wrong_event" ? MapPinOff : Copy;
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
          transition={spring}
        >
          <motion.div
            initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: duration ?? 0.2, delay: reducedMotion ? 0 : 0.22 }}
          >
            <WarningIcon className="h-7 w-7 text-white" strokeWidth={2.25} aria-hidden />
          </motion.div>
        </motion.div>
      </div>
    );
  }

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
        transition={spring}
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

export function ScannerResultSheet({
  open,
  result,
  undoSecondsLeft,
  onScanNext,
}: ScannerResultSheetProps) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : undefined;

  const kind = result
    ? normalizeResultKind(result.result === "disabled" ? "invalid" : result.result)
    : "invalid";
  const config = getStatusConfig(kind);
  const tone = overlayTone(kind);
  const showDetails = result ? hasDetailBody(result, kind) : false;

  return (
    <AnimatePresence>
      {open && result ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="scanner-result-title"
        >
          <motion.div
            className="absolute inset-0 bg-background/80 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`relative w-full rounded-2xl border border-border/80 bg-card text-center shadow-xl ${
              showDetails ? "max-w-[400px] max-h-[90vh] flex flex-col" : "max-w-[380px]"
            }`}
            initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 pt-8 ${showDetails ? "shrink-0" : "pb-8"}`}>
              <OverlayStatusIcon tone={tone} kind={kind} reducedMotion={reducedMotion} duration={duration} />

              <motion.h2
                id="scanner-result-title"
                className="text-lg font-semibold tracking-tight text-foreground"
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.18 }}
              >
                {config.label}
              </motion.h2>

              <motion.p
                className="mt-1 text-sm text-muted-foreground"
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.22 }}
              >
                {result.message}
              </motion.p>
            </div>

            {showDetails && (
              <motion.div
                className="overflow-y-auto px-6 pb-2 text-left"
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.28 }}
              >
                <ResultBody result={result} />
              </motion.div>
            )}

            <motion.div
              className={`px-6 space-y-2 ${showDetails ? "shrink-0 border-t border-border/60 py-4" : "pb-8 pt-2"}`}
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration ?? 0.22, delay: reducedMotion ? 0 : 0.36 }}
            >
              {kind === "valid" && undoSecondsLeft > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {}}
                >
                  Undo ({undoSecondsLeft}s)
                </Button>
              )}
              <Button
                type="button"
                className={
                  tone === "success"
                    ? "h-12 w-full rounded-xl bg-emerald-600 font-semibold text-base text-white shadow-lg hover:bg-emerald-700"
                    : "h-12 w-full rounded-xl font-semibold text-base text-white shadow-lg hover:opacity-90"
                }
                style={tone === "success" ? undefined : { backgroundColor: SCANNER_BRAND }}
                onClick={onScanNext}
              >
                <ScanLine className="mr-2 h-5 w-5" aria-hidden />
                Scan next
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
