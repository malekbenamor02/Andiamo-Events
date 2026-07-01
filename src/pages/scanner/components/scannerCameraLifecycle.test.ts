import { describe, expect, it } from "vitest";
import {
  manualEntryStartsCamera,
  scanNextUsesNewSession,
  shouldStopCameraAfterDecode,
} from "./scannerCameraLifecycle";
import {
  SCANNER_BATTERY_PAUSE_MESSAGE,
  SCANNER_SESSION_TIMEOUT_MS,
} from "./scannerCameraConfig";

describe("scannerCameraLifecycle", () => {
  it("shouldStopCameraAfterDecode when not yet processed", () => {
    expect(shouldStopCameraAfterDecode(false)).toBe(true);
  });

  it("shouldStopCameraAfterDecode blocks duplicate decode", () => {
    expect(shouldStopCameraAfterDecode(true)).toBe(false);
  });

  it("scanNextUsesNewSession instead of resumeDecode", () => {
    expect(scanNextUsesNewSession()).toBe(true);
  });

  it("manualEntryStartsCamera is false", () => {
    expect(manualEntryStartsCamera()).toBe(false);
  });
});

describe("scannerCameraConfig", () => {
  it("uses 60s idle session timeout", () => {
    expect(SCANNER_SESSION_TIMEOUT_MS).toBe(60_000);
  });

  it("exports battery pause copy", () => {
    expect(SCANNER_BATTERY_PAUSE_MESSAGE).toBe(
      "Camera paused to save battery. Tap Scan to continue."
    );
  });
});

describe("decode sequencing policy", () => {
  it("locks before validation via processedRef pattern", () => {
    let processed = false;
    const token = "test-token";

    if (shouldStopCameraAfterDecode(processed)) {
      processed = true;
    }

    expect(processed).toBe(true);
    expect(shouldStopCameraAfterDecode(processed)).toBe(false);

    void token;
  });
});
