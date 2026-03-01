import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import Loader from "@/components/ui/Loader";
import { LogOut, History, Play, RotateCw, PenLine, Square, CheckCircle2, XCircle, Copy, MapPinOff, ScanLine, WifiOff, Cloud, BatteryWarning } from "lucide-react";

const STORAGE_KEY = "scanner_selected_event";
const TIMEOUT_MS = 90000; // 90s
const READER_ID = "scanner-qr-reader";
const RECENT_SCANS_LIMIT = 6;
const UNDO_WINDOW_SEC = 5;

function triggerHaptic(status: string) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  switch (status) {
    case "valid": navigator.vibrate(50); break;
    case "invalid":
    case "already_scanned": navigator.vibrate([40, 30, 40]); break;
    default: navigator.vibrate([40, 30, 40]);
  }
}

function getStatusConfig(result: string): { color: string; border: string; bg: string; icon: React.ElementType; label: string } {
  switch (result) {
    case "valid": return { color: "text-[#22C55E]", border: "border-[#22C55E]", bg: "bg-[#22C55E]/10", icon: CheckCircle2, label: "VALID" };
    case "already_scanned": return { color: "text-[#F59E0B]", border: "border-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: Copy, label: "ALREADY SCANNED" };
    case "wrong_event": return { color: "text-[#F59E0B]", border: "border-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: MapPinOff, label: "WRONG EVENT" };
    default: return { color: "text-[#EF4444]", border: "border-[#EF4444]", bg: "bg-[#EF4444]/10", icon: XCircle, label: "INVALID" };
  }
}

function formatSyncAgo(d: Date | null): string {
  if (!d) return "";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 120) return "1 min ago";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

function getStatusEdgeColor(r: string): string {
  switch (r) {
    case "valid": return "#22C55E";
    case "already_scanned":
    case "wrong_event": return "#F59E0B";
    default: return "#EF4444";
  }
}

interface SelectedEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
}

type Result = {
  success: boolean;
  result: string;
  message: string;
  ticket?: {
    pass_type?: string;
    buyer_name?: string;
    ambassador_name?: string;
    event_name?: string;
    is_invitation?: boolean;
    source?: string | null;
    scanned_at?: string;
    invitation_number?: string | null;
    recipient_name?: string | null;
    recipient_phone?: string | null;
    recipient_email?: string | null;
  };
  previous_scan?: { scanned_at?: string; scanner_name?: string };
  correct_event?: { event_name?: string; event_date?: string };
  event_date?: string;
  enabled?: boolean;
};

type ScanRow = { id: string; scan_time: string; scan_result: string; buyer_name: string | null; pass_type: string | null };
type Stats = { total: number; byStatus: Record<string, number>; byPass: Record<string, number> };

export default function ScannerScan() {
  const navigate = useNavigate();
  const [event, setEvent] = useState<SelectedEvent | null>(null);
  const [scanning, setScanning] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [validating, setValidating] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [err, setErr] = useState("");
  const [recentScans, setRecentScans] = useState<ScanRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingScans, setLoadingScans] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lowBattery, setLowBattery] = useState(false);
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const o = JSON.parse(s) as SelectedEvent;
        if (o && o.id) setEvent(o);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!event?.id) return;
    // if no event, redirect is done in render
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [event?.id]);

  const stopCamera = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear().catch(() => {});
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

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

  useEffect(() => {
    if (event?.id) loadScansAndStats();
  }, [event?.id, loadScansAndStats]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    const b = (navigator as { getBattery?: () => Promise<{ level: number; addEventListener: (a: string, f: () => void) => void }> }).getBattery?.();
    if (!b) return;
    b.then((bat) => {
      setLowBattery(bat.level < 0.2);
      bat.addEventListener("levelchange", () => setLowBattery(bat.level < 0.2));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (result?.result !== "valid") { setUndoSecondsLeft(0); return; }
    setUndoSecondsLeft(UNDO_WINDOW_SEC);
    const id = setInterval(() => {
      setUndoSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [result?.result]);

  const [, setSyncTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setSyncTick((t) => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  const validate = useCallback(async (secure_token: string) => {
    if (!event?.id) return;
    setValidating(true);
    setErr("");
    processedRef.current = true;
    try {
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
        message: d.message || "Error",
        ticket: d.ticket,
        previous_scan: d.previous_scan,
        correct_event: d.correct_event,
        event_date: d.event_date,
      });
      triggerHaptic(res);
    } catch {
      setResult({ success: false, result: "error", message: "Network error" });
      triggerHaptic("invalid");
    } finally {
      setValidating(false);
      loadScansAndStats();
    }
  }, [event?.id, loadScansAndStats]);

  const onStart = useCallback(() => {
    if (!event?.id) return;
    setResult(null);
    setTimedOut(false);
    setErr("");
    processedRef.current = false;
    setScanning(true);
  }, [event?.id]);

  useEffect(() => {
    if (!scanning || !event?.id) return;
    let mounted = true;
    const run = async () => {
      try {
        const sc = new Html5Qrcode(READER_ID);
        scannerRef.current = sc;
        await sc.start(
          { facingMode: "environment" },
          { fps: 8 },
          (decodedText) => {
            if (processedRef.current || !mounted) return;
            stopCamera().then(() => mounted && validate(decodedText));
          },
          () => {}
        );
        if (!mounted) { sc.stop().catch(() => {}); return; }
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          stopCamera();
          setTimedOut(true);
        }, TIMEOUT_MS);
      } catch {
        if (mounted) { setErr("Camera not available. Use Manual entry."); setScanning(false); }
      }
    };
    run();
    return () => {
      mounted = false;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current.clear().catch(() => {}); scannerRef.current = null; }
    };
  }, [scanning, event?.id, stopCamera, validate]);

  const onManualSubmit = () => {
    const t = manualToken.trim();
    if (!t || !event?.id) return;
    setManualOpen(false);
    setManualToken("");
    validate(t);
  };

  const logout = async () => {
    await stopCamera();
    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGOUT}`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/scanner/login", { replace: true });
  };

  if (!event?.id) {
    navigate("/scanner/events", { replace: true });
    return null;
  }

  const sc = result ? getStatusConfig(result.result) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header: Compact top bar with event name and status icons */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-[#1A1A1A] px-4 py-3">
        <div className="flex justify-between items-center gap-2">
          <h1 className="text-sm font-semibold text-white truncate flex-1">{event.name}</h1>
          <div className="flex items-center gap-1 shrink-0">
            {isOffline && <span className="p-1.5 text-[#EF4444]" title="Offline — scans will sync when back"><WifiOff className="w-4 h-4" /></span>}
            {!isOffline && lastSyncedAt && <span className="p-1.5 text-[#22C55E]" title={`Synced ${formatSyncAgo(lastSyncedAt)}`}><Cloud className="w-4 h-4" /></span>}
            {lowBattery && <span className="p-1.5 text-[#F59E0B]" title="Low battery"><BatteryWarning className="w-4 h-4" /></span>}
            <Button variant="ghost" size="icon" className="h-9 w-9 text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A]" onClick={() => navigate("/scanner/history")} aria-label="History"><History className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A]" onClick={logout} aria-label="Logout"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Camera View - Top Section */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {scanning ? (
          <div className="relative flex-1 bg-black overflow-hidden">
            <div id={READER_ID} className="w-full h-full" />
            {/* Overlay instructions */}
            <div className="absolute top-4 left-0 right-0 px-4">
              <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                <p className="text-white text-sm font-medium">Point camera at QR code</p>
              </div>
            </div>
          </div>
        ) : !result ? (
          <div className="flex-1 bg-gradient-to-b from-[#1A1A1A] to-[#0A0A0A] flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-[#1A1A1A] border-2 border-dashed border-[#2A2A2A] flex items-center justify-center">
                <ScanLine className="w-12 h-12 text-[#404040]" />
              </div>
              <p className="text-[#737373] text-sm font-medium">Camera ready</p>
              <p className="text-[#525252] text-xs mt-1">Press start to begin scanning</p>
            </div>
          </div>
        ) : null}

        {/* Validation Status Overlay */}
        {validating && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <Loader size="xl" className="mx-auto mb-4 [background:#E21836]" />
              <p className="text-white text-base font-medium">Validating ticket...</p>
            </div>
          </div>
        )}

        {/* Result Display Overlay */}
        {result && !validating && sc && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-md rounded-2xl border-2 ${sc.border} ${sc.bg} p-6 shadow-2xl`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-xl ${sc.bg}`}>
                  <sc.icon className={`w-8 h-8 ${sc.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${sc.color}`}>{sc.label}</p>
                  <p className="text-[#A3A3A3] text-sm mt-0.5">{result.message}</p>
                </div>
              </div>
              
              {result.ticket && (
                <div className="space-y-3 mb-4 p-4 rounded-xl bg-[#0A0A0A]/50 border border-[#1A1A1A]">
                  <div>
                    <p className="text-xs text-[#737373] mb-1">Pass Type</p>
                    <p className="text-lg font-semibold text-white">{result.ticket.pass_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#737373] mb-1">Name</p>
                    <p className="text-base font-medium text-[#F5F5F5]">{result.ticket.is_invitation ? (result.ticket.recipient_name || result.ticket.buyer_name || "—") : (result.ticket.buyer_name || "—")}</p>
                  </div>
                  {result.ticket.is_invitation && (result.ticket.invitation_number || result.ticket.recipient_email) && (
                    <div>
                      <p className="text-xs text-[#737373] mb-1">Invitation Details</p>
                      <p className="text-sm text-[#A3A3A3]">{(result.ticket.invitation_number ? `#${result.ticket.invitation_number}` : "") + (result.ticket.recipient_email ? ` · ${result.ticket.recipient_email}` : "")}</p>
                    </div>
                  )}
                  {!result.ticket.is_invitation && result.ticket.ambassador_name && (
                    <div>
                      <p className="text-xs text-[#737373] mb-1">Ambassador</p>
                      <p className="text-sm text-[#A3A3A3]">{result.ticket.ambassador_name}</p>
                    </div>
                  )}
                  {result.ticket.source === 'point_de_vente' && (
                    <div className="inline-block px-2 py-1 rounded bg-[#1A1A1A] border border-[#2A2A2A]">
                      <p className="text-xs text-[#A3A3A3]">Point de vente</p>
                    </div>
                  )}
                </div>
              )}
              
              {result.previous_scan && (
                <div className="mb-4 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                  <p className="text-xs text-[#F59E0B] font-medium mb-1">Previously Scanned</p>
                  <p className="text-xs text-[#A3A3A3]">{result.previous_scan.scanner_name || "—"} at {result.previous_scan.scanned_at ? new Date(result.previous_scan.scanned_at).toLocaleString() : "—"}</p>
                </div>
              )}
              
              {result.correct_event && (
                <div className="mb-4 p-3 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                  <p className="text-xs text-[#737373] mb-1">Correct Event</p>
                  <p className="text-sm text-[#A3A3A3]">{result.correct_event.event_name} — {result.correct_event.event_date ? new Date(result.correct_event.event_date).toLocaleDateString() : ""}</p>
                </div>
              )}
              
              <div className="flex gap-3">
                {result.result === "valid" && undoSecondsLeft > 0 && (
                  <Button variant="outline" className="flex-1 h-12 border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white" onClick={() => {}}>
                    Undo ({undoSecondsLeft}s)
                  </Button>
                )}
                <Button className="flex-1 h-12 rounded-xl bg-[#E21836] hover:bg-[#c4142e] font-semibold text-base shadow-lg" onClick={() => { setResult(null); onStart(); }}>
                  <ScanLine className="w-5 h-5 mr-2" />Scan Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {err && (
          <div className="absolute top-4 left-4 right-4 z-50">
            <div className="bg-[#EF4444]/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-[#EF4444]">
              <p className="text-white text-sm font-medium">{err}</p>
            </div>
          </div>
        )}

        {/* Timeout Message */}
        {timedOut && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2A2A2A] flex items-center justify-center">
                <RotateCw className="w-8 h-8 text-[#A3A3A3]" />
              </div>
              <p className="text-white text-lg font-semibold mb-2">Session Timeout</p>
              <p className="text-[#A3A3A3] text-sm mb-6">Camera session expired. Press restart to continue scanning.</p>
              <Button className="w-full h-12 bg-[#E21836] hover:bg-[#c4142e] font-semibold text-base" onClick={onStart}>
                <RotateCw className="w-5 h-5 mr-2" />Restart Scanning
              </Button>
            </div>
          </div>
        )}

        {/* Center Action Button - Always visible when not scanning */}
        {!scanning && !result && !timedOut && (
          <div className="absolute bottom-32 left-0 right-0 flex justify-center z-30">
            <div className="flex flex-col items-center gap-3">
              <Button 
                className="h-20 w-20 rounded-full bg-[#E21836] hover:bg-[#c4142e] shadow-2xl border-4 border-white/10 hover:scale-105 transition-transform" 
                onClick={onStart}
                size="lg"
              >
                <ScanLine className="w-10 h-10" />
              </Button>
              <p className="text-white text-base font-semibold">Start Scanning</p>
              <Button 
                variant="outline" 
                className="h-11 px-6 rounded-full border-[#2A2A2A] text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white hover:border-[#404040]" 
                onClick={() => setManualOpen(true)}
              >
                <PenLine className="w-4 h-4 mr-2" />Manual Entry
              </Button>
            </div>
          </div>
        )}

        {/* Stop Button - When scanning */}
        {scanning && (
          <div className="absolute bottom-32 left-0 right-0 flex justify-center z-30">
            <Button 
              className="h-20 w-20 rounded-full bg-[#EF4444] hover:bg-[#DC2626] shadow-2xl border-4 border-white/10 hover:scale-105 transition-transform" 
              onClick={stopCamera}
              size="lg"
            >
              <Square className="w-10 h-10 fill-white" />
            </Button>
          </div>
        )}
      </div>

      {/* History Section - Bottom */}
      <div className="bg-[#0A0A0A] border-t border-[#1A1A1A]">
        <div className="px-4 py-3">
          {/* Session Stats - Compact */}
          {stats && (
            <div className="mb-4 grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-[#1A1A1A] border border-[#22C55E]/20 p-2.5 text-center">
                <p className="text-[10px] text-[#737373] uppercase tracking-wide mb-1">Valid</p>
                <p className="text-xl font-bold text-[#22C55E]">{stats.byStatus.valid ?? 0}</p>
              </div>
              <div className="rounded-lg bg-[#1A1A1A] border border-[#EF4444]/20 p-2.5 text-center">
                <p className="text-[10px] text-[#737373] uppercase tracking-wide mb-1">Invalid</p>
                <p className="text-xl font-bold text-[#EF4444]">{stats.byStatus.invalid ?? 0}</p>
              </div>
              <div className="rounded-lg bg-[#1A1A1A] border border-[#F59E0B]/20 p-2.5 text-center">
                <p className="text-[10px] text-[#737373] uppercase tracking-wide mb-1">Already</p>
                <p className="text-xl font-bold text-[#F59E0B]">{stats.byStatus.already_scanned ?? 0}</p>
              </div>
              <div className="rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] p-2.5 text-center">
                <p className="text-[10px] text-[#737373] uppercase tracking-wide mb-1">Total</p>
                <p className="text-xl font-bold text-white">{stats.total ?? 0}</p>
              </div>
            </div>
          )}

          {/* Recent Scans */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Recent Scans</p>
              {recentScans.length >= RECENT_SCANS_LIMIT && (
                <button 
                  type="button" 
                  className="text-xs text-[#E21836] hover:text-[#c4142e] font-medium" 
                  onClick={() => navigate("/scanner/history")}
                >
                  View All
                </button>
              )}
            </div>
            
            {loadingScans ? (
              <div className="text-center py-4">
                <p className="text-[#737373] text-sm">Loading...</p>
              </div>
            ) : recentScans.length === 0 ? (
              <div className="text-center py-6 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A]">
                <p className="text-[#737373] text-sm">No scans yet</p>
                <p className="text-[#525252] text-xs mt-1">Start scanning to see history</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentScans.map((s) => (
                  <div 
                    key={s.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      expandedScanId === s.id ? "bg-[#1A1A1A] border border-[#2A2A2A]" : "bg-[#0F0F0F] hover:bg-[#151515]"
                    }`} 
                    style={{ borderLeft: `4px solid ${getStatusEdgeColor(s.scan_result)}` }}
                    onClick={() => setExpandedScanId(expandedScanId === s.id ? null : s.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          s.scan_result === "valid" 
                            ? "bg-[#22C55E]/20 text-[#22C55E]" 
                            : s.scan_result === "already_scanned" || s.scan_result === "wrong_event" 
                            ? "bg-[#F59E0B]/20 text-[#F59E0B]" 
                            : "bg-[#EF4444]/20 text-[#EF4444]"
                        }`}>
                          {s.scan_result === "valid" ? "Valid" : s.scan_result === "already_scanned" ? "Already" : s.scan_result === "wrong_event" ? "Wrong" : "Invalid"}
                        </span>
                        <span className="text-xs text-[#737373]">{new Date(s.scan_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-sm font-medium text-white truncate">{s.buyer_name || "—"}</p>
                      <p className="text-xs text-[#737373] mt-0.5">{s.pass_type || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setManualOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-[#1F1F1F] border border-[#2A2A2A] p-4" onClick={e => e.stopPropagation()}>
            <p className="text-white font-medium mb-2">Manual entry — Secure token</p>
            <input className="w-full rounded-lg bg-[#252525] border border-[#2A2A2A] px-3 py-2 text-white text-base" value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <div className="flex gap-2 mt-3">
              <Button variant="outline" className="flex-1 border-[#2A2A2A] text-[#A3A3A3] hover:text-white" onClick={() => { setManualOpen(false); setManualToken(""); }}>Cancel</Button>
              <Button className="flex-1 bg-[#E21836] hover:bg-[#c4142e]" onClick={onManualSubmit}>Validate</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
