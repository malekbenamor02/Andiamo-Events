import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderExpirationTimerProps {
  expiresAt: string;
  language: "en" | "fr";
}

export function OrderExpirationTimer({ expiresAt, language }: OrderExpirationTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeRemaining = () => {
      const expirationDate = new Date(expiresAt);
      const now = new Date();
      const diff = expirationDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeRemaining) return null;

  if (timeRemaining.isExpired) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {language === "en" ? "Expired" : "Expiré"}
      </div>
    );
  }

  const isUrgent = timeRemaining.days === 0 && timeRemaining.hours < 2;
  const isWarning = timeRemaining.days === 0 && timeRemaining.hours < 6;

  const tone = isUrgent
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : isWarning
      ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
      : "border-border bg-muted/50 text-muted-foreground";

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular-nums", tone)}>
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {timeRemaining.days > 0 && `${timeRemaining.days}d `}
        {String(timeRemaining.hours).padStart(2, "0")}:
        {String(timeRemaining.minutes).padStart(2, "0")}:
        {String(timeRemaining.seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
