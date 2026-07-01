import {
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
  type Html5QrcodeConfigs,
} from "html5-qrcode";

export const SCANNER_SESSION_TIMEOUT_MS = 60_000;
export const STATS_REFRESH_DEBOUNCE_MS = 1_500;
export const SCANNER_BATTERY_PAUSE_MESSAGE =
  "Camera paused to save battery. Tap Scan to continue.";

export function buildHtml5QrcodeConfig(): Html5QrcodeConfigs {
  return {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    useBarCodeDetectorIfSupported: true,
    verbose: false,
  };
}

export function buildCameraScanConfig(lowBattery: boolean): Html5QrcodeCameraScanConfig {
  if (lowBattery) {
    return {
      fps: 5,
      disableFlip: true,
      videoConstraints: {
        facingMode: "environment",
        width: { ideal: 640, max: 640 },
        height: { ideal: 480, max: 480 },
      },
    };
  }

  return {
    fps: 12,
    disableFlip: true,
    videoConstraints: {
      facingMode: "environment",
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
    },
  };
}

export function buildPinnedCameraConstraints(
  deviceId: string,
  lowBattery: boolean
): MediaTrackConstraints {
  const base = lowBattery
    ? { width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 } }
    : { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 } };

  return { deviceId: { exact: deviceId }, ...base };
}
