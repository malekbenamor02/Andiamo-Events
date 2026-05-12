export type PassPurchaseCountdownPhase = "presale_start" | "presale_end" | "event";

export interface PassPurchaseCountdownTarget {
  targetMs: number;
  phase: PassPurchaseCountdownPhase;
}

export interface GetPassPurchaseCountdownTargetOptions {
  /** When set, overrides row `presale_enabled` for targeting (API / gate synthetic presale). */
  treatAsPresale?: boolean;
}

interface EventLike {
  date: string;
  presale_enabled?: unknown;
  presale_active_from?: string | null;
  presale_active_until?: string | null;
}

function isPresaleEnabledLike(ev: EventLike): boolean {
  const v = ev.presale_enabled;
  return (
    v === true ||
    v === 1 ||
    v === "1" ||
    v === "t" ||
    v === "T" ||
    v === "true" ||
    v === "TRUE"
  );
}

function parseInstantMs(raw: string | null | undefined): number {
  if (raw == null || raw === "") return NaN;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function presaleBranch(
  eventMs: number,
  eventValid: boolean,
  fromMs: number,
  untilMs: number,
  fromValid: boolean,
  untilValid: boolean,
  nowMs: number
): PassPurchaseCountdownTarget | null {
  // P9: both bounds valid
  if (fromValid && untilValid) {
    if (nowMs < fromMs) {
      return { targetMs: fromMs, phase: "presale_start" };
    }
    if (nowMs < untilMs) {
      return { targetMs: untilMs, phase: "presale_end" };
    }
    if (eventValid && eventMs > nowMs) {
      return { targetMs: eventMs, phase: "event" };
    }
    return null;
  }

  // P10: only from
  if (fromValid && !untilValid) {
    if (nowMs < fromMs) {
      return { targetMs: fromMs, phase: "presale_start" };
    }
    if (eventValid && eventMs > nowMs) {
      return { targetMs: eventMs, phase: "event" };
    }
    return null;
  }

  // P11: only until
  if (!fromValid && untilValid) {
    if (nowMs < untilMs) {
      return { targetMs: untilMs, phase: "presale_end" };
    }
    if (eventValid && eventMs > nowMs) {
      return { targetMs: eventMs, phase: "event" };
    }
    return null;
  }

  // P12: neither valid — fallback to show date if still upcoming
  if (eventValid && eventMs > nowMs) {
    return { targetMs: eventMs, phase: "event" };
  }
  return null;
}

/**
 * Pass purchase page countdown target: non-presale uses event `date`;
 * presale uses from/until ladder (P9–P12), including partial bounds and event-date fallback.
 */
export function getPassPurchaseCountdownTarget(
  event: EventLike,
  nowMs: number = Date.now(),
  options?: GetPassPurchaseCountdownTargetOptions
): PassPurchaseCountdownTarget | null {
  const eventMs = new Date(event.date).getTime();
  const eventValid = Number.isFinite(eventMs);

  const treatAsPresale =
    options?.treatAsPresale !== undefined
      ? options.treatAsPresale
      : isPresaleEnabledLike(event);

  if (treatAsPresale) {
    const fromMs = parseInstantMs(event.presale_active_from);
    const untilMs = parseInstantMs(event.presale_active_until);
    const fromValid = Number.isFinite(fromMs);
    const untilValid = Number.isFinite(untilMs);
    return presaleBranch(eventMs, eventValid, fromMs, untilMs, fromValid, untilValid, nowMs);
  }

  if (!eventValid || eventMs <= nowMs) {
    return null;
  }
  return { targetMs: eventMs, phase: "event" };
}
