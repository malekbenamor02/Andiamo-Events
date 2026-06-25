/**
 * Isolated session countdown so the 1s tick does not re-render the full admin dashboard.
 */

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type AdminSessionCountdownState = {
  expiresAt: number;
  remainingSeconds: number;
} | null;

type AdminSessionCountdownProps = {
  session: AdminSessionCountdownState;
  language: "en" | "fr";
  suppress401Until: number | null;
  variant: "mobile" | "desktop";
};

function formatRemaining(secondsLeft: number) {
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return { h, m, s };
}

export function AdminSessionCountdown({
  session,
  language,
  suppress401Until,
  variant,
}: AdminSessionCountdownProps) {
  const { toast } = useToast();
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!session) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(session.remainingSeconds);
  }, [session?.expiresAt, session?.remainingSeconds]);

  useEffect(() => {
    if (!session) return;

    let didExpire = false;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next <= 0 && !didExpire) {
          if (suppress401Until && Date.now() < suppress401Until) {
            return prev;
          }
          didExpire = true;
          clearInterval(timer);

          toast({
            title: language === "en" ? "Session expired" : "Session expirée",
            description:
              language === "en"
                ? "Your session has expired. Please sign in again."
                : "Votre session a expiré. Veuillez vous reconnecter.",
            variant: "destructive",
          });
          window.location.href = "/admin/login";
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.expiresAt, language, suppress401Until, toast]);

  if (!session) return null;

  const { h, m, s } = formatRemaining(secondsLeft);
  const label = language === "en" ? "Session" : "Session";

  if (variant === "mobile") {
    return (
      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
        <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {h}h {m}m
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5",
        "text-xs tabular-nums text-muted-foreground",
      )}
    >
      <Clock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      <span>
        {label} · {h}h {m}m {s}s
      </span>
    </div>
  );
}
