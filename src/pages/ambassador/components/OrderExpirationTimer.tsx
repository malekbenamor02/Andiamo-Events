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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
        <Clock className="w-4 h-4 text-red-500 animate-pulse" />
        <span className="text-xs font-semibold text-red-500">
          {language === "en" ? "Expired" : "Expiré"}
        </span>
      </div>
    );
  }

  const isUrgent = timeRemaining.days === 0 && timeRemaining.hours < 2;
  const isWarning = timeRemaining.days === 0 && timeRemaining.hours < 6;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
        isUrgent
          ? "bg-red-500/20 border-red-500/30"
          : isWarning
            ? "bg-orange-500/20 border-orange-500/30"
            : "bg-yellow-500/20 border-yellow-500/30"
      )}
    >
      <Clock
        className={cn(
          "w-4 h-4",
          isUrgent ? "text-red-500 animate-pulse" : isWarning ? "text-orange-500" : "text-yellow-500"
        )}
      />
      <div className="flex items-center gap-1 text-xs font-semibold">
        {timeRemaining.days > 0 && (
          <span
            className={
              isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-yellow-500"
            }
          >
            {timeRemaining.days}d
          </span>
        )}
        <span
          className={
            isUrgent ? "text-red-500" : isWarning ? "text-orange-500" : "text-yellow-500"
          }
        >
          {String(timeRemaining.hours).padStart(2, "0")}:
          {String(timeRemaining.minutes).padStart(2, "0")}:
          {String(timeRemaining.seconds).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
