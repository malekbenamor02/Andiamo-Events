import { useEffect, useMemo, useState } from "react";
import { EventCountdownBanner } from "@/components/countdown/EventCountdownBanner";
import { getPassPurchaseCountdownTarget } from "@/lib/countdown-pass-purchase";

type EventRow = Parameters<typeof getPassPurchaseCountdownTarget>[0];

interface PassPurchaseCountdownStripProps {
  event: EventRow & { event_status?: string | null };
  language: "en" | "fr";
  leftLabel: string;
  countdownEnabled: boolean;
  treatAsPresale: boolean;
}

/**
 * Recomputes presale phase targets once per second so boundaries (start → end → show) update without
 * ticking the entire PassPurchase page.
 */
export function PassPurchaseCountdownStrip({
  event,
  language,
  leftLabel,
  countdownEnabled,
  treatAsPresale,
}: PassPurchaseCountdownStripProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!countdownEnabled) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [countdownEnabled, event.id]);

  const target = useMemo(() => {
    if (event.event_status === "completed" || event.event_status === "cancelled") {
      return null;
    }
    return getPassPurchaseCountdownTarget(event, nowMs, { treatAsPresale });
  }, [event, nowMs, treatAsPresale]);

  if (!countdownEnabled || !target) {
    return null;
  }

  return (
    <EventCountdownBanner
      className="fixed left-0 right-0 top-0 z-[60] w-full"
      targetMs={target.targetMs}
      language={language}
      leftLabel={leftLabel}
      syncDocumentOffset
    />
  );
}
