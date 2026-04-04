/**
 * Isolated session countdown so the 1s tick does not re-render the full admin dashboard.
 */

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
            title: language === "en" ? "Session Expired" : "Session expirée",
            description:
              language === "en"
                ? "Your session has expired. Please login again."
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

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  if (variant === "mobile") {
    return (
      <>
        <Clock className="w-3.5 h-3.5" style={{ color: "#E21836" }} />
        <span>
          {h}h {m}m
        </span>
      </>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg shrink-0"
      style={{
        background: "#1F1F1F",
        border: "1px solid #2A2A2A",
        color: "#B8B8B8",
      }}
    >
      <Clock className="w-4 h-4 animate-pulse" style={{ color: "#E21836" }} />
      <span className="text-sm font-medium">
        {language === "en" ? "Session:" : "Session:"} {h}h {m}m {s}s
      </span>
    </div>
  );
}
