import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  SCANNER_SESSION_TIMEOUT_MS,
  buildCameraScanConfig,
  buildHtml5QrcodeConfig,
  buildPinnedCameraConstraints,
} from "./scannerCameraConfig";
import { shouldStopCameraAfterDecode } from "./scannerCameraLifecycle";

export interface UseScannerCameraOptions {
  sessionOpen: boolean;
  lowBattery: boolean;
  hostRef: React.RefObject<HTMLDivElement | null>;
  onDecode: (token: string) => void;
  onError: (message: string) => void;
  onTimeout: () => void;
  processedRef: React.MutableRefObject<boolean>;
}

function stopHostMediaTracks(host: HTMLElement | null) {
  if (!host) return;
  host.querySelectorAll("video").forEach((video) => {
    const stream = video.srcObject;
    if (stream && typeof (stream as MediaStream).getTracks === "function") {
      (stream as MediaStream).getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
    }
    video.srcObject = null;
  });
}

export function useScannerCamera({
  sessionOpen,
  lowBattery,
  hostRef,
  onDecode,
  onError,
  onTimeout,
  processedRef,
}: UseScannerCameraOptions) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedDeviceIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const clearSessionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fullStop = useCallback(async () => {
    clearSessionTimeout();
    pinnedDeviceIdRef.current = null;
    const host = hostRef.current;
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear().catch(() => {});
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    stopHostMediaTracks(host);
  }, [clearSessionTimeout, hostRef]);

  const armSessionTimeout = useCallback(() => {
    clearSessionTimeout();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      void fullStop();
      onTimeout();
    }, SCANNER_SESSION_TIMEOUT_MS);
  }, [clearSessionTimeout, fullStop, onTimeout]);

  const handleDecode = useCallback(
    (decodedText: string) => {
      if (!shouldStopCameraAfterDecode(processedRef.current) || !mountedRef.current) return;
      processedRef.current = true;
      clearSessionTimeout();
      void (async () => {
        await fullStop();
        if (mountedRef.current) onDecode(decodedText);
      })();
    },
    [clearSessionTimeout, fullStop, onDecode, processedRef]
  );

  const startCamera = useCallback(async () => {
    const host = hostRef.current;
    if (!host || !mountedRef.current) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(host.id, buildHtml5QrcodeConfig());
      }

      const sc = scannerRef.current;
      if (sc.isScanning) return;

      const scanConfig = buildCameraScanConfig(lowBattery);
      const cameraIdOrConfig = pinnedDeviceIdRef.current
        ? buildPinnedCameraConstraints(pinnedDeviceIdRef.current, lowBattery)
        : { facingMode: "environment" as const };

      await sc.start(cameraIdOrConfig, scanConfig, handleDecode, () => {});

      try {
        const settings = sc.getRunningTrackSettings();
        if (settings.deviceId) {
          pinnedDeviceIdRef.current = settings.deviceId;
        }
      } catch {
        /* ignore */
      }

      armSessionTimeout();
    } catch {
      if (mountedRef.current) {
        onError("Camera not available. Use Manual entry.");
        await fullStop();
      }
    }
  }, [armSessionTimeout, fullStop, handleDecode, hostRef, lowBattery, onError]);

  useLayoutEffect(() => {
    if (!sessionOpen) return;

    mountedRef.current = true;
    const startTimer = window.setTimeout(() => {
      void startCamera();
    }, 50);

    return () => {
      if (startTimer != null) window.clearTimeout(startTimer);
    };
  }, [sessionOpen, startCamera]);

  useEffect(() => {
    if (!sessionOpen) {
      void fullStop();
    }
  }, [sessionOpen, fullStop]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      void fullStop();
    };
  }, [fullStop]);

  useEffect(() => {
    const onVisibility = () => {
      if (!sessionOpen || !document.hidden) return;
      void (async () => {
        await fullStop();
        onTimeout();
      })();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fullStop, onTimeout, sessionOpen]);

  return { fullStop };
}
