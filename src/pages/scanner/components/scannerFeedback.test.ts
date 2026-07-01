import { describe, expect, it } from "vitest";
import { shouldPlayScanSuccessSound } from "./scannerFeedback";
import type { ScanResult } from "./scannerTypes";

function base(overrides: Partial<ScanResult>): ScanResult {
  return {
    success: false,
    result: "invalid",
    message: "",
    ...overrides,
  };
}

describe("shouldPlayScanSuccessSound", () => {
  it("plays for gate valid success", () => {
    expect(
      shouldPlayScanSuccessSound(base({ success: true, result: "valid" }))
    ).toBe(true);
  });

  it("plays for supervisor inspect lookup success", () => {
    expect(
      shouldPlayScanSuccessSound(base({ success: true, result: "ok", lookup: true }))
    ).toBe(true);
  });

  it("does not play when lookup is set on gate valid", () => {
    expect(
      shouldPlayScanSuccessSound(base({ success: true, result: "valid", lookup: true }))
    ).toBe(false);
  });

  it("does not play for ok without lookup flag", () => {
    expect(shouldPlayScanSuccessSound(base({ success: true, result: "ok" }))).toBe(false);
  });

  it("does not play for failed results", () => {
    for (const result of ["invalid", "already_scanned", "wrong_event", "disabled", "error"] as const) {
      expect(shouldPlayScanSuccessSound(base({ success: false, result }))).toBe(false);
      expect(shouldPlayScanSuccessSound(base({ success: true, result, lookup: true }))).toBe(false);
    }
  });

  it("does not play for null/undefined", () => {
    expect(shouldPlayScanSuccessSound(null)).toBe(false);
    expect(shouldPlayScanSuccessSound(undefined)).toBe(false);
  });
});
