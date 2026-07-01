import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import Loader from "@/components/ui/Loader";
import { RotateCw, PenLine, Square, ScanLine } from "lucide-react";
import type { InspectPanel, OrderPassRow, ScanResult, ScanRow, ScanStats, SelectedEvent } from "./components/scannerTypes";
import {
  triggerHaptic,
  preloadScanSuccessSound,
  playScanSuccessSound,
  shouldPlayScanSuccessSound,
} from "./components/scannerFeedback";
import { SCANNER_BG, SCANNER_BORDER, SCANNER_BRAND } from "./components/scannerTheme";
import { ScannerScanHeader } from "./components/ScannerScanHeader";
import { ScannerResultSheet } from "./components/ScannerResultSheet";
import { ScannerManualEntrySheet } from "./components/ScannerManualEntrySheet";
import { ScannerRecentPanel } from "./components/ScannerRecentPanel";
import { ScannerQrViewport } from "./components/ScannerQrViewport";
import { useScannerCamera } from "./components/useScannerCamera";
import { scanNextUsesNewSession } from "./components/scannerCameraLifecycle";
import { SCANNER_BATTERY_PAUSE_MESSAGE, STATS_REFRESH_DEBOUNCE_MS } from "./components/scannerCameraConfig";

const STORAGE_KEY = "scanner_selected_event";
const RECENT_SCANS_LIMIT = 6;
const UNDO_WINDOW_SEC = 5;

function readStoredSelectedEvent(): SelectedEvent | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const o = JSON.parse(s) as SelectedEvent;
    return o?.id ? o : null;
  } catch {
    return null;
  }
}

export default function ScannerScan() {
  const navigate = useNavigate();
  const [scannerRole, setScannerRole] = useState<"scanner" | "supervisor" | null>(null);
  const [scanMode, setScanMode] = useState<"gate" | "inspect">("gate");
  const [event, setEvent] = useState<SelectedEvent | null>(readStoredSelectedEvent);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [err, setErr] = useState("");
  const [recentScans, setRecentScans] = useState<ScanRow[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loadingScans, setLoadingScans] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const qrHostRef = useRef<HTMLDivElement | null>(null);
  const scannerRoleRef = useRef(scannerRole);
  const scanModeRef = useRef(scanMode);
  const processedRef = useRef(false);
  const statsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  scannerRoleRef.current = scannerRole;
  scanModeRef.current = scanMode;

  useEffect(() => {
    if (!event?.id) {
      navigate("/scanner/events", { replace: true });
    }
  }, [event?.id, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_SESSION}`, { credentials: "include" });
        if (r.status === 401) {
          navigate("/scanner/login", { replace: true });
          return;
        }
        const d = await r.json().catch(() => ({}));
        setScannerRole(d.role === "supervisor" ? "supervisor" : "scanner");
      } catch {
        setScannerRole("scanner");
      }
    })();
  }, [navigate]);

  const loadScansAndStats = useCallback(async () => {
    if (!event?.id) return;
    setLoadingScans(true);
    try {
      const [rScans, rStats] = await Promise.all([
        fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_SCANS}?event_id=${encodeURIComponent(event.id)}`, { credentials: "include" }),
        fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_STATISTICS}?event_id=${encodeURIComponent(event.id)}`, { credentials: "include" }),
      ]);
      const dScans = await rScans.json().catch(() => ({}));
      const dStats = await rStats.json().catch(() => ({}));
      setRecentScans((dScans.scans || []).slice(0, RECENT_SCANS_LIMIT));
      setStats(dStats.total != null ? { total: dStats.total, byStatus: dStats.byStatus || {}, byPass: dStats.byPass || {} } : null);
      setLastSyncedAt(new Date());
    } catch {
      setRecentScans([]);
      setStats(null);
    } finally {
      setLoadingScans(false);
    }
  }, [event?.id]);

  const scheduleStatsRefresh = useCallback(() => {
    if (statsDebounceRef.current) clearTimeout(statsDebounceRef.current);
    statsDebounceRef.current = setTimeout(() => {
      statsDebounceRef.current = null;
      void loadScansAndStats();
    }, STATS_REFRESH_DEBOUNCE_MS);
  }, [loadScansAndStats]);

  useEffect(() => {
    return () => {
      if (statsDebounceRef.current) clearTimeout(statsDebounceRef.current);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const b = (navigator as { getBattery?: () => Promise<{ level: number; addEventListener: (a: string, f: () => void) => void }> }).getBattery?.();
    if (!b) return;
    b.then((bat) => {
      const update = () => setLowBattery(bat.level < 0.25);
      update();
      bat.addEventListener("levelchange", update);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (result?.result !== "valid") {
      setUndoSecondsLeft(0);
      return;
    }
    setUndoSecondsLeft(UNDO_WINDOW_SEC);
    undoTimeoutRef.current = setTimeout(() => {
      undoTimeoutRef.current = null;
      setUndoSecondsLeft(0);
    }, UNDO_WINDOW_SEC * 1000);
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
    };
  }, [result?.result]);

  useEffect(() => {
    if (shouldPlayScanSuccessSound(result)) {
      playScanSuccessSound();
    }
  }, [result]);

  const validate = useCallback(async (secure_token: string) => {
    if (!event?.id) return;
    setValidating(true);
    setErr("");
    const isInspect = scannerRoleRef.current === "supervisor" && scanModeRef.current === "inspect";
    try {
      if (isInspect) {
        const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOOKUP_TICKET}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            secure_token: secure_token.trim(),
            event_id: event.id,
            scan_location: "",
            device_info: typeof navigator !== "undefined" ? navigator.userAgent : "",
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 503 && d.enabled === false) {
          setResult({ success: false, result: "disabled", message: "Scan system is not started", enabled: false, lookup: true });
          return;
        }
        const res = d.result || "invalid";
        const inv = d.invitation;
        const invitationNorm =
          inv && typeof inv === "object" && !Array.isArray(inv) ? (inv as Record<string, unknown>) : null;
        const scanHistoryNorm = Array.isArray(d.scan_history) ? d.scan_history : [];
        setResult({
          success: !!d.success,
          result: res,
          message:
            typeof d.message === "string" && d.message.trim()
              ? d.message
              : d.success
                ? "Lookup successful"
                : "Error",
          ticket: d.ticket && typeof d.ticket === "object" && !Array.isArray(d.ticket) ? d.ticket : undefined,
          previous_scan: d.previous_scan,
          correct_event: d.correct_event,
          event_date: d.event_date,
          lookup: true,
          invitation: invitationNorm,
          scan_history: scanHistoryNorm,
          ticket_status: d.ticket_status ?? null,
          inspect_panel:
            d.inspect_panel && typeof d.inspect_panel === "object" && d.inspect_panel.qr_ticket_id
              ? (d.inspect_panel as InspectPanel)
              : null,
          order_passes: Array.isArray(d.order_passes) ? (d.order_passes as OrderPassRow[]) : null,
        });
        triggerHaptic(d.success ? "ok" : res === "wrong_event" ? "wrong_event" : "invalid");
      } else {
        const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_VALIDATE_TICKET}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            secure_token: secure_token.trim(),
            event_id: event.id,
            scan_location: "",
            device_info: typeof navigator !== "undefined" ? navigator.userAgent : "",
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 503 && d.enabled === false) {
          setResult({ success: false, result: "disabled", message: "Scan system is not started", enabled: false });
          return;
        }
        const res = d.result || "invalid";
        setResult({
          success: !!d.success,
          result: res,
          message:
            typeof d.message === "string" && d.message.trim()
              ? d.message
              : d.success
                ? "Ticket validated"
                : "Error",
          ticket: d.ticket,
          previous_scan: d.previous_scan,
          correct_event: d.correct_event,
          event_date: d.event_date,
        });
        triggerHaptic(res);
      }
    } catch {
      setResult({ success: false, result: "error", message: "Network error", lookup: isInspect });
      triggerHaptic("invalid");
    } finally {
      setValidating(false);
      scheduleStatsRefresh();
    }
  }, [event?.id, scheduleStatsRefresh]);

  const handleCameraTimeout = useCallback(() => {
    setSessionOpen(false);
    setTimedOut(true);
  }, []);

  const handleCameraError = useCallback((message: string) => {
    setErr(message);
    setSessionOpen(false);
  }, []);

  const { fullStop } = useScannerCamera({
    sessionOpen,
    lowBattery,
    hostRef: qrHostRef,
    onDecode: (token) => {
      setSessionOpen(false);
      void validate(token);
    },
    onError: handleCameraError,
    onTimeout: handleCameraTimeout,
    processedRef,
  });

  const stopSession = useCallback(async () => {
    await fullStop();
    setSessionOpen(false);
  }, [fullStop]);

  const onStart = useCallback(() => {
    if (!event?.id) return;
    preloadScanSuccessSound();
    setResult(null);
    setTimedOut(false);
    setErr("");
    processedRef.current = false;
    setSessionOpen(true);
  }, [event?.id]);

  const onScanNext = useCallback(() => {
    if (!scanNextUsesNewSession()) return;
    onStart();
  }, [onStart]);

  const navigateAfterStop = useCallback(
    async (path: string) => {
      await stopSession();
      setTimedOut(false);
      setResult(null);
      navigate(path);
    },
    [navigate, stopSession]
  );

  const onManualSubmit = () => {
    const t = manualToken.trim();
    if (!t || !event?.id) return;
    setManualOpen(false);
    setManualToken("");
    if (sessionOpen) void stopSession();
    void validate(t);
  };

  const logout = async () => {
    await stopSession();
    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGOUT}`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/scanner/login", { replace: true });
  };

  if (!event?.id) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: SCANNER_BG }}>
        <p className="text-sm text-[#A3A3A3]">Loading…</p>
      </div>
    );
  }

  const manualSubmitLabel =
    scannerRole === "supervisor" && scanMode === "inspect" ? "Lookup" : "Validate";

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: SCANNER_BG }}>
      <ScannerScanHeader
        eventName={event.name}
        scannerRole={scannerRole}
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        isOffline={isOffline}
        lastSyncedAt={lastSyncedAt}
        lowBattery={lowBattery}
        onEventActivity={() => void navigateAfterStop("/scanner/event-activity")}
        onHistory={() => void navigateAfterStop("/scanner/history")}
        onLogout={logout}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {sessionOpen ? (
          <div className="relative flex min-h-0 flex-1 flex-col bg-black pb-[7rem]">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <ScannerQrViewport ref={qrHostRef} />
              <div className="absolute left-0 right-0 top-4 px-4">
                <div className="rounded-full bg-black/70 px-4 py-2 text-center backdrop-blur-sm">
                  <p className="text-sm font-medium text-white">
                    {scannerRole === "supervisor" && scanMode === "inspect"
                      ? "Point at QR — inspect only"
                      : "Point at QR code"}
                  </p>
                </div>
              </div>
            </div>
            <div
              className="fixed inset-x-0 bottom-0 z-[60] flex justify-center border-t border-white/10 bg-black/80 px-4 py-4"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
            >
              <Button
                className="h-[4.5rem] w-[4.5rem] rounded-full border-4 border-white/10 bg-red-600 shadow-2xl transition-transform hover:scale-105 hover:bg-red-700"
                onClick={() => void stopSession()}
                size="lg"
                aria-label="Stop scanning"
              >
                <Square className="h-9 w-9 fill-white" />
              </Button>
            </div>
          </div>
        ) : !result ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#141414] ring-1 ring-[#2A2A2A]">
                  <ScanLine className="h-8 w-8 text-[#525252]" />
                </div>
                <p className="text-sm font-medium text-[#A3A3A3]">Ready to scan</p>
                <p className="mt-1 text-xs text-[#525252]">Tap below to open the camera</p>
              </div>
            </div>
            {!timedOut && (
              <div
                className="flex shrink-0 flex-col items-center gap-3 border-t px-4 py-5"
                style={{
                  borderColor: SCANNER_BORDER,
                  backgroundColor: `${SCANNER_BG}f5`,
                  paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
                }}
              >
                <Button
                  className="h-[4.5rem] w-[4.5rem] rounded-full border-4 border-white/10 shadow-2xl transition-transform hover:scale-105"
                  style={{ backgroundColor: SCANNER_BRAND }}
                  onClick={onStart}
                  size="lg"
                >
                  <ScanLine className="h-9 w-9 text-white" />
                </Button>
                <p className="text-base font-semibold text-white">Start scanning</p>
                <Button
                  variant="outline"
                  className="h-11 rounded-full border-[#2A2A2A] px-6 text-[#A3A3A3] hover:border-[#404040] hover:bg-[#141414] hover:text-white"
                  onClick={() => setManualOpen(true)}
                >
                  <PenLine className="mr-2 h-4 w-4" />
                  Manual entry
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="min-h-0 flex-1" style={{ backgroundColor: SCANNER_BG }} aria-hidden />
        )}

        {validating && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85">
            <div className="text-center">
              <Loader size="xl" className="mx-auto mb-4 [background:#E21836]" />
              <p className="text-base font-medium text-white">
                {scannerRole === "supervisor" && scanMode === "inspect"
                  ? "Loading ticket info…"
                  : "Validating ticket…"}
              </p>
            </div>
          </div>
        )}

        <ScannerResultSheet
          open={Boolean(result && !validating)}
          result={result}
          undoSecondsLeft={undoSecondsLeft}
          onOpenChange={(open) => {
            if (!open) setResult(null);
          }}
          onScanNext={onScanNext}
        />

        {err && (
          <div className="absolute left-4 right-4 top-4 z-50">
            <div className="rounded-xl border border-red-500/50 bg-red-500/90 px-4 py-3 backdrop-blur-sm">
              <p className="text-sm font-medium text-white">{err}</p>
            </div>
          </div>
        )}

        {timedOut && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A]">
                <RotateCw className="h-7 w-7 text-[#A3A3A3]" />
              </div>
              <p className="mb-2 text-lg font-semibold text-white">Camera paused</p>
              <p className="mb-6 text-sm text-[#A3A3A3]">{SCANNER_BATTERY_PAUSE_MESSAGE}</p>
              <Button
                className="h-12 w-full font-semibold text-white"
                style={{ backgroundColor: SCANNER_BRAND }}
                onClick={onStart}
              >
                <ScanLine className="mr-2 h-5 w-5" />
                Scan to continue
              </Button>
            </div>
          </div>
        )}
      </div>

      {!sessionOpen && (
        <ScannerRecentPanel
          stats={stats}
          recentScans={recentScans}
          loading={loadingScans}
          onViewAll={() => void navigateAfterStop("/scanner/history")}
          onExpand={() => void loadScansAndStats()}
        />
      )}

      <ScannerManualEntrySheet
        open={manualOpen}
        token={manualToken}
        submitLabel={manualSubmitLabel}
        onOpenChange={setManualOpen}
        onTokenChange={setManualToken}
        onSubmit={onManualSubmit}
        onCancel={() => {
          setManualOpen(false);
          setManualToken("");
        }}
      />
    </div>
  );
}
