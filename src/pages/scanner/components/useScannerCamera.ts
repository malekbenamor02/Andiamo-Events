import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  SCANNER_SESSION_TIMEOUT_MS,
  buildCameraScanConfig,
  buildHtml5QrcodeConfig,
  buildPinnedCameraConstraints,
} from "./scannerCameraConfig";

export interface UseScannerCameraOptions {
  sessionOpen: boolean;
  lowBattery: boolean;
  hostRef: React.RefObject<HTMLDivElement | null>;
  onDecode: (token: string) => void;
  onError: (message: string) => void;
  onTimeout: () => void;
  processedRef: React.MutableRefObject<boolean>;
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
  const pausedRef = useRef(false);
  const visibilityPausedRef = useRef(false);
  const mountedRef = useRef(true);

  const clearSessionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fullStop = useCallback(async () => {
    clearSessionTimeout();
    pausedRef.current = false;
    visibilityPausedRef.current = false;
    pinnedDeviceIdRef.current = null;
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear().catch(() => {});
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
  }, [clearSessionTimeout]);

  const armSessionTimeout = useCallback(() => {
    clearSessionTimeout();
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      void fullStop();
      onTimeout();
    }, SCANNER_SESSION_TIMEOUT_MS);
  }, [clearSessionTimeout, fullStop, onTimeout]);

  const pauseDecode = useCallback(() => {
    if (!scannerRef.current || pausedRef.current) return;
    try {
      scannerRef.current.pause(true);
      pausedRef.current = true;
      clearSessionTimeout();
    } catch {
      /* ignore */
    }
  }, [clearSessionTimeout]);

  const resumeDecode = useCallback(() => {
    if (!scannerRef.current || !pausedRef.current) return;
    try {
      scannerRef.current.resume();
      pausedRef.current = false;
      armSessionTimeout();
    } catch {
      /* ignore */
    }
  }, [armSessionTimeout]);

  const startCamera = useCallback(async () => {
    const host = hostRef.current;
    if (!host || !mountedRef.current) return;

    try {
      if (!scannerRef.current) {
        const sc = new Html5Qrcode(host.id, buildHtml5QrcodeConfig());
        scannerRef.current = sc;
      }

      const sc = scannerRef.current;
      if (sc.isScanning) {
        if (pausedRef.current) {
          resumeDecode();
        }
        return;
      }

      const scanConfig = buildCameraScanConfig(lowBattery);
      const cameraIdOrConfig = pinnedDeviceIdRef.current
        ? buildPinnedCameraConstraints(pinnedDeviceIdRef.current, lowBattery)
        : { facingMode: "environment" as const };

      await sc.start(
        cameraIdOrConfig,
        scanConfig,
        (decodedText) => {
          if (processedRef.current || !mountedRef.current) return;
          processedRef.current = true;
          pauseDecode();
          onDecode(decodedText);
        },
        () => {}
      );

      try {
        const settings = sc.getRunningTrackSettings();
        if (settings.deviceId) {
          pinnedDeviceIdRef.current = settings.deviceId;
        }
      } catch {
        /* ignore */
      }

      pausedRef.current = false;
      armSessionTimeout();
    } catch {
      if (mountedRef.current) {
        onError("Camera not available. Use Manual entry.");
        await fullStop();
      }
    }
  }, [
    armSessionTimeout,
    fullStop,
    hostRef,
    lowBattery,
    onDecode,
    onError,
    pauseDecode,
    processedRef,
    resumeDecode,
  ]);

  useLayoutEffect(() => {
    if (!sessionOpen) return;

    mountedRef.current = true;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    startTimer = window.setTimeout(() => {
      void startCamera();
    }, 50);

    return () => {
      mountedRef.current = false;
      if (startTimer != null) window.clearTimeout(startTimer);
    };
  }, [sessionOpen, startCamera]);

  useEffect(() => {
    if (!sessionOpen) {
      void fullStop();
    }
  }, [sessionOpen, fullStop]);

  useEffect(() => {
    const onVisibility = () => {
      if (!sessionOpen || !scannerRef.current) return;
      if (document.hidden) {
        if (!pausedRef.current && scannerRef.current.isScanning) {
          try {
            scannerRef.current.pause(true);
            visibilityPausedRef.current = true;
            clearSessionTimeout();
          } catch {
            /* ignore */
          }
        }
        return;
      }
      if (visibilityPausedRef.current && !processedRef.current) {
        try {
          scannerRef.current.resume();
          visibilityPausedRef.current = false;
          pausedRef.current = false;
          armSessionTimeout();
        } catch {
          /* ignore */
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [armSessionTimeout, clearSessionTimeout, processedRef, sessionOpen]);

  return {
    pauseDecode,
    resumeDecode,
    fullStop,
  };
}
