import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const UNIT_LETTERS = {
  en: ["D", "H", "M", "S"],
  fr: ["J", "H", "M", "S"],
} as const;

const DIGIT_GRADIENT =
  "bg-gradient-to-b from-[#ff7a8b] via-[hsl(var(--primary))] to-[#8f0f20] bg-clip-text text-transparent";

function digitString(value: number, minLen: number): string {
  const v = Math.max(0, Math.floor(value));
  const s = String(v);
  return s.length >= minLen ? s : s.padStart(minLen, "0");
}

function OdometerDigit({ digit }: { digit: number }) {
  const d = Math.min(9, Math.max(0, digit));
  return (
    <span className="inline-block h-[1em] w-[0.62em] shrink-0 overflow-hidden align-middle text-center leading-none">
      <span
        className="flex flex-col will-change-transform motion-reduce:!transition-none"
        style={{
          transform: `translateY(-${d}em)`,
          transition: "transform 520ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex h-[1em] min-h-[1em] w-full shrink-0 items-center justify-center leading-none font-heading font-bold",
              DIGIT_GRADIENT
            )}
          >
            {i}
          </span>
        ))}
      </span>
    </span>
  );
}

function OdometerPair({ value, minDigits = 2 }: { value: number; minDigits?: number }) {
  const s = digitString(value, minDigits);
  return (
    <span className="inline-flex items-center justify-center gap-px tabular-nums">
      {s.split("").map((ch, i) => (
        <OdometerDigit key={i} digit={parseInt(ch, 10)} />
      ))}
    </span>
  );
}

function TimeSegment({
  value,
  unitLetter,
}: {
  value: number;
  unitLetter: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={cn(
          "inline-flex font-heading text-lg font-bold tabular-nums md:text-2xl",
          "animate-luminous-timer motion-reduce:!animate-none [perspective:800px]"
        )}
      >
        <OdometerPair value={value} minDigits={2} />
      </div>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-white/45">
        {unitLetter}
      </span>
    </div>
  );
}

function CountdownColon() {
  return (
    <span
      className={cn(
        "mx-px select-none font-heading text-sm font-semibold leading-none sm:text-base md:text-lg",
        "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.45)]",
        "translate-y-[-0.05em]"
      )}
      aria-hidden
    >
      :
    </span>
  );
}

function useRemainingMs(targetMs: number, tick = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tick);
    return () => window.clearInterval(id);
  }, [tick]);

  return Math.max(0, targetMs - now);
}

export interface EventCountdownBannerProps {
  targetMs: number;
  language: "en" | "fr";
  /** When true, sets `document.documentElement` `--site-countdown-offset` from banner height (fixed strip above nav). */
  syncDocumentOffset?: boolean;
  leftLabel?: string;
  className?: string;
}

export function EventCountdownBanner({
  targetMs,
  language,
  syncDocumentOffset = false,
  leftLabel,
  className,
}: EventCountdownBannerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const remaining = useRemainingMs(targetMs);
  const letters = UNIT_LETTERS[language];

  const parts = useMemo(() => {
    const sec = Math.floor(remaining / 1000);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return { days, hours, minutes, seconds };
  }, [remaining]);

  const ariaTimeLabel = useMemo(() => {
    if (remaining <= 0) return language === "en" ? "Countdown ended" : "Compte à rebours terminé";
    const d = parts.days;
    const h = parts.hours;
    const m = parts.minutes;
    const s = parts.seconds;
    return language === "en"
      ? `${d} days, ${h} hours, ${m} minutes, ${s} seconds remaining`
      : `${d} jours, ${h} heures, ${m} minutes, ${s} secondes restantes`;
  }, [remaining, parts, language]);

  useLayoutEffect(() => {
    if (!syncDocumentOffset || typeof document === "undefined") return;
    const el = rootRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty("--site-countdown-offset", `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--site-countdown-offset");
    };
  }, [syncDocumentOffset]);

  const liveHeading =
    language === "en" ? "COLLECTION NOW LIVE" : "LA COLLECTION EST EN LIGNE";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative z-[60] flex min-h-12 w-full items-center justify-center overflow-hidden md:min-h-14",
        "bg-[#1A1A1A]",
        "border-b border-primary/45",
        "shadow-[0_0_20px_hsl(var(--primary)/0.08),inset_0_-1px_0_hsl(var(--primary)/0.25)]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.1)_0%,transparent_70%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className={cn(
            "absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/20 to-transparent",
            "animate-timer-bar-shimmer motion-reduce:!animate-none"
          )}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-1.5 px-4 py-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 sm:gap-x-8 md:gap-8 md:py-0">
        {leftLabel && String(leftLabel).trim().length > 0 ? (
          <>
            <span className="w-full truncate text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-white/75 sm:hidden">
              {leftLabel}
            </span>
            <span className="hidden max-w-[14rem] truncate text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80 sm:inline md:max-w-xs md:text-xs">
              {leftLabel}
            </span>
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4" aria-live="polite" aria-atomic>
          {remaining <= 0 ? (
            <span
              className={cn(
                "px-2 text-center font-heading text-base font-bold tracking-widest md:text-xl",
                DIGIT_GRADIENT,
                "animate-luminous-timer motion-reduce:!animate-none"
              )}
            >
              {liveHeading}
            </span>
          ) : (
            <>
              <span className="sr-only">{ariaTimeLabel}</span>
              <div aria-hidden className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
                <TimeSegment value={parts.days} unitLetter={letters[0]} />
                <CountdownColon />
                <TimeSegment value={parts.hours} unitLetter={letters[1]} />
                <CountdownColon />
                <TimeSegment value={parts.minutes} unitLetter={letters[2]} />
                <CountdownColon />
                <TimeSegment value={parts.seconds} unitLetter={letters[3]} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
