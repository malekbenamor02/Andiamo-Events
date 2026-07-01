/** Whether a QR decode should trigger a full camera stop (single-session policy). */
export function shouldStopCameraAfterDecode(alreadyProcessed: boolean): boolean {
  return !alreadyProcessed;
}

/** Scan next opens a new camera session; never resume a paused stream. */
export function scanNextUsesNewSession(): boolean {
  return true;
}

/** Manual token entry must not start the camera. */
export function manualEntryStartsCamera(): boolean {
  return false;
}
