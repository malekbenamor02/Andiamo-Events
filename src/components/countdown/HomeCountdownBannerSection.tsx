import { useMemo } from "react";
import { useFeaturedEvents, isEventOmittedFromPublicListings, type Event } from "@/hooks/useEvents";
import { useCountdownBannerSettings } from "@/hooks/useCountdownBannerSettings";
import { EventCountdownBanner } from "@/components/countdown/EventCountdownBanner";
import { isLocalhostClient } from "@/lib/localhost";
import { isPassPurchaseWindowClosed } from "@/lib/date-utils";

interface HomeCountdownBannerSectionProps {
  language: "en" | "fr";
}

/**
 * Home page countdown: only when there is exactly one eligible upcoming event
 * (non-presale; test events follow the same rules on localhost only — production featured list excludes tests).
 * If there are zero or multiple such events, no home strip (each event keeps its strip on pass purchase).
 */
export function HomeCountdownBannerSection({ language }: HomeCountdownBannerSectionProps) {
  const { data: countdownSettings, isSuccess } = useCountdownBannerSettings();
  const { data: featured = [] } = useFeaturedEvents();

  const eligibleForHomeBanner = useMemo(() => {
    const out: Event[] = [];
    for (const e of featured) {
      if (isEventOmittedFromPublicListings(e)) continue;
      if (!isLocalhostClient() && e.is_test) continue;
      if (e.event_status === "completed" || e.event_status === "cancelled") continue;
      if (isPassPurchaseWindowClosed(e.date, e.event_status)) continue;
      const hasPasses = (e.passes?.length ?? 0) > 0;
      if (!hasPasses && !(isLocalhostClient() && e.is_test)) continue;
      const t = new Date(e.date).getTime();
      if (!Number.isFinite(t) || t <= Date.now()) continue;
      out.push(e);
    }
    return out;
  }, [featured]);

  const event = eligibleForHomeBanner.length === 1 ? eligibleForHomeBanner[0] : null;

  if (!isSuccess || countdownSettings?.enabled !== true || !event) {
    return null;
  }

  const targetMs = new Date(event.date).getTime();
  const leftLabel =
    language === "en" ? countdownSettings.label_en : countdownSettings.label_fr;

  return (
    <EventCountdownBanner
      className="fixed left-0 right-0 top-0 z-[60]"
      targetMs={targetMs}
      language={language}
      syncDocumentOffset
      leftLabel={leftLabel}
    />
  );
}
