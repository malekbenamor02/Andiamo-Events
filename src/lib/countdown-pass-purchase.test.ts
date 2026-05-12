import { describe, expect, it } from "vitest";
import { getPassPurchaseCountdownTarget } from "./countdown-pass-purchase";

const SHOW = "2030-06-15T18:00:00.000Z";

describe("getPassPurchaseCountdownTarget non-presale", () => {
  it("returns event date when future", () => {
    const now = new Date("2030-01-01T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(
      { date: SHOW, presale_enabled: false },
      now,
      { treatAsPresale: false }
    );
    expect(r?.phase).toBe("event");
    expect(r?.targetMs).toBe(new Date(SHOW).getTime());
  });

  it("returns null when event is past", () => {
    const now = new Date("2031-01-01T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(
      { date: SHOW, presale_enabled: false },
      now,
      { treatAsPresale: false }
    );
    expect(r).toBeNull();
  });
});

describe("getPassPurchaseCountdownTarget presale P9 both bounds", () => {
  const from = "2030-03-01T10:00:00.000Z";
  const until = "2030-03-05T10:00:00.000Z";
  const ev = {
    date: SHOW,
    presale_enabled: true,
    presale_active_from: from,
    presale_active_until: until,
  };

  it("before from → presale_start", () => {
    const now = new Date("2030-02-01T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(from).getTime(), phase: "presale_start" });
  });

  it("between from and until → presale_end", () => {
    const now = new Date("2030-03-03T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(until).getTime(), phase: "presale_end" });
  });

  it("after until, before show → event", () => {
    const now = new Date("2030-03-06T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(SHOW).getTime(), phase: "event" });
  });
});

describe("getPassPurchaseCountdownTarget presale P10 from only", () => {
  const from = "2030-03-01T10:00:00.000Z";
  const ev = {
    date: SHOW,
    presale_enabled: true,
    presale_active_from: from,
    presale_active_until: null,
  };

  it("before from → presale_start", () => {
    const now = new Date("2030-02-01T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r?.phase).toBe("presale_start");
  });

  it("after from → event if show future", () => {
    const now = new Date("2030-03-02T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(SHOW).getTime(), phase: "event" });
  });
});

describe("getPassPurchaseCountdownTarget presale P11 until only", () => {
  const until = "2030-03-05T10:00:00.000Z";
  const ev = {
    date: SHOW,
    presale_enabled: true,
    presale_active_from: null,
    presale_active_until: until,
  };

  it("before until → presale_end", () => {
    const now = new Date("2030-03-01T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r?.phase).toBe("presale_end");
  });

  it("after until → event if show future", () => {
    const now = new Date("2030-03-06T00:00:00.000Z").getTime();
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(SHOW).getTime(), phase: "event" });
  });
});

describe("getPassPurchaseCountdownTarget presale P12 neither bound", () => {
  it("falls back to event date", () => {
    const now = new Date("2030-01-01T00:00:00.000Z").getTime();
    const ev = {
      date: SHOW,
      presale_enabled: true,
      presale_active_from: null,
      presale_active_until: null,
    };
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(SHOW).getTime(), phase: "event" });
  });
});

describe("treatAsPresale override", () => {
  it("forces presale ladder when row is false", () => {
    const now = new Date("2030-01-01T00:00:00.000Z").getTime();
    const ev = {
      date: SHOW,
      presale_enabled: false,
      presale_active_from: null,
      presale_active_until: null,
    };
    const r = getPassPurchaseCountdownTarget(ev, now, { treatAsPresale: true });
    expect(r).toEqual({ targetMs: new Date(SHOW).getTime(), phase: "event" });
  });

  it("defaults to row presale_enabled when options omitted", () => {
    const now = new Date("2030-01-01T00:00:00.000Z").getTime();
    const ev = {
      date: SHOW,
      presale_enabled: true,
      presale_active_from: null,
      presale_active_until: null,
    };
    const r = getPassPurchaseCountdownTarget(ev, now);
    expect(r?.phase).toBe("event");
  });
});
