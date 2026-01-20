import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { LogOut, History, Play, RotateCw, PenLine, Square, CheckCircle2, XCircle, Copy, Clock, MapPinOff, ScanLine, WifiOff, Cloud, BatteryWarning } from "lucide-react";

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
    case "expired": navigator.vibrate(80); break;
    default: navigator.vibrate([40, 30, 40]);
  }
}

function getStatusConfig(result: string): { color: string; border: string; bg: string; icon: React.ElementType; label: string } {
  switch (result) {
    case "valid": return { color: "text-[#22C55E]", border: "border-[#22C55E]", bg: "bg-[#22C55E]/10", icon: CheckCircle2, label: "VALID" };
    case "already_scanned": return { color: "text-[#F59E0B]", border: "border-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: Copy, label: "ALREADY SCANNED" };
    case "wrong_event": return { color: "text-[#F59E0B]", border: "border-[#F59E0B]", bg: "bg-[#F59E0B]/10", icon: MapPinOff, label: "WRONG EVENT" };
    case "expired": return { color: "text-[#D4D4D4]", border: "border-[#A3A3A3]", bg: "bg-[#525252]/80", icon: Clock, label: "EXPIRED" };
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
    case "expired": return "#A3A3A3";
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
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col p-4 pb-28">
      {/* Header: event + ConnectionStatus + History + Logout */}
      <div className="flex justify-between items-center mb-3 gap-2">
        <h1 className="text-base font-semibold text-white truncate min-w-0">{event.name}</h1>
        <div className="flex items-center gap-0.5 shrink-0">
          {isOffline && <span className="p-1.5 text-[#EF4444]" title="Offline — scans will sync when back"><WifiOff className="w-4 h-4" /></span>}
          {!isOffline && lastSyncedAt && <span className="p-1.5 text-[#A3A3A3]" title={`Synced ${formatSyncAgo(lastSyncedAt)}`}><Cloud className="w-4 h-4" /></span>}
          {lowBattery && <span className="p-1.5 text-[#F59E0B]" title="Low battery"><BatteryWarning className="w-4 h-4" /></span>}
          <Button variant="ghost" size="icon" className="h-11 w-11 text-[#A3A3A3] hover:text-white" onClick={() => navigate("/scanner/history")} aria-label="History"><History className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11 text-[#A3A3A3] hover:text-white" onClick={logout} aria-label="Logout"><LogOut className="w-5 h-5" /></Button>
        </div>
      </div>

      {!scanning && !result && !timedOut && (
        <div className="flex gap-2 mb-3">
          <Button className="flex-1 h-12 rounded-lg bg-[#E21836] hover:bg-[#c4142e] text-base font-medium" onClick={onStart}><ScanLine className="w-4 h-4 mr-2" />Start scanning</Button>
          <Button variant="outline" className="h-12 rounded-lg border-[#2A2A2A] text-[#A3A3A3] hover:border-[#404040] hover:text-white" onClick={() => setManualOpen(true)}><PenLine className="w-4 h-4 mr-2" />Manual</Button>
        </div>
      )}

      {timedOut && (
        <div className="mb-3 p-3 rounded-lg bg-[#2A2A2A] text-[#A3A3A3]">
          Timeout. Press Restart to try again.
          <Button className="mt-2 w-full h-12 bg-[#E21836] hover:bg-[#c4142e]" onClick={onStart}><RotateCw className="w-4 h-4 mr-2" />Restart</Button>
        </div>
      )}

      {err && <p className="text-[#EF4444] text-sm mb-2">{err}</p>}

      {scanning && (
        <div className="rounded-lg overflow-hidden border-2 border-[#E21836] mb-2" style={{ maxHeight: "40vh" }}>
          <div id={READER_ID} className="w-full" />
        </div>
      )}
      {scanning && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[#A3A3A3] text-sm">Point at QR code</p>
          <Button variant="outline" size="sm" className="h-10 border-[#E21836] text-[#E21836] hover:bg-[#E21836]/10 shrink-0" onClick={stopCamera}><Square className="w-4 h-4 mr-1.5 fill-current" />Stop</Button>
        </div>
      )}

      {validating && <div className="text-[#A3A3A3] text-center py-8 text-sm">Validating…</div>}

      {result && !validating && sc && (
        <div className={`mt-3 p-4 rounded-xl border-2 ${sc.border} ${sc.bg} ${result.result === "valid" ? "scan-status-valid-in" : ""}`}>
          <div className="flex items-center gap-2 mb-3">
            <sc.icon className={`w-7 h-7 shrink-0 ${sc.color}`} />
            <p className={`text-xl font-bold ${sc.color}`}>{sc.label}</p>
          </div>
          <p className="text-[#A3A3A3] text-sm mb-3">{result.message}</p>
          {result.ticket && (
            <div className="space-y-1.5">
              <p className="text-[17px] font-semibold text-white">{result.ticket.pass_type || "—"}</p>
              <p className="text-base font-medium text-[#F5F5F5]">{result.ticket.is_invitation ? (result.ticket.recipient_name || result.ticket.buyer_name || "—") : (result.ticket.buyer_name || "—")}</p>
              {result.ticket.is_invitation && (result.ticket.invitation_number || result.ticket.recipient_email) && (
                <p className="text-sm text-[#A3A3A3]">{(result.ticket.invitation_number ? `${result.ticket.invitation_number}` : "") + (result.ticket.recipient_email ? ` · ${result.ticket.recipient_email}` : "")}</p>
              )}
              {!result.ticket.is_invitation && result.ticket.ambassador_name && <p className="text-sm text-[#A3A3A3]">Ambassador: {result.ticket.ambassador_name}</p>}
              {result.ticket.source === 'point_de_vente' && <p className="text-sm text-[#A3A3A3]">Point de vente</p>}
              {(result.ticket.recipient_phone || result.ticket.recipient_email) && result.ticket.is_invitation && (
                <p className="text-[13px] text-[#A3A3A3]">Contact: {[result.ticket.recipient_phone, result.ticket.recipient_email].filter(Boolean).join(" · ")}</p>
              )}
              {result.ticket.scanned_at && result.result === "valid" && <p className="text-xs text-[#737373]">{new Date(result.ticket.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
            </div>
          )}
          {result.previous_scan && <p className="mt-2 text-[13px] text-[#F59E0B]">Previously: {result.previous_scan.scanner_name || "—"} at {result.previous_scan.scanned_at ? new Date(result.previous_scan.scanned_at).toLocaleString() : "—"}</p>}
          {result.correct_event && <p className="mt-1 text-[13px] text-[#A3A3A3]">Correct event: {result.correct_event.event_name} — {result.correct_event.event_date ? new Date(result.correct_event.event_date).toLocaleDateString() : ""}</p>}
          <div className="flex gap-2 mt-4">
            {result.result === "valid" && undoSecondsLeft > 0 && (
              <Button variant="outline" size="sm" className="shrink-0 border-[#2A2A2A] text-[#A3A3A3] h-12" onClick={() => {}}>Undo ({undoSecondsLeft}s)</Button>
            )}
            <Button className="flex-1 h-12 rounded-lg bg-[#E21836] hover:bg-[#c4142e] font-medium" onClick={() => { setResult(null); onStart(); }}><ScanLine className="w-4 h-4 mr-2" />Scan next</Button>
          </div>
        </div>
      )}

      {/* Session stats: Valid primary, progress, problems, by pass */}
      <div className="mt-4 p-3 rounded-lg bg-[#1C1C1C] border border-[#2A2A2A]">
        <p className="text-[13px] font-medium text-[#A3A3A3] mb-1.5">Session stats</p>
        {loadingScans ? <p className="text-[#A3A3A3] text-sm">Loading…</p> : stats ? (
          <div className="space-y-1.5">
            <div>
              <span className="text-[13px] text-[#A3A3A3]">Valid </span><span className="text-[15px] font-semibold text-[#22C55E]">{stats.byStatus.valid ?? 0}</span>
              {stats.total > 0 && <div className="h-1 mt-1 rounded-full bg-[#2A2A2A] overflow-hidden"><div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${(100 * (stats.byStatus.valid ?? 0)) / stats.total}%` }} /></div>}
            </div>
            {((stats.byStatus.invalid ?? 0) + (stats.byStatus.already_scanned ?? 0) + (stats.byStatus.expired ?? 0) + (stats.byStatus.wrong_event ?? 0)) > 0 && (
              <p className="text-[13px] text-[#A3A3A3]">
                <span className="text-[#EF4444]">Invalid {stats.byStatus.invalid ?? 0}</span>
                <span className="text-[#525252] mx-1">·</span>
                <span className="text-[#F59E0B]">Already {stats.byStatus.already_scanned ?? 0}</span>
                <span className="text-[#525252] mx-1">·</span>
                <span className="text-[#A3A3A3]">Expired {stats.byStatus.expired ?? 0}</span>
                <span className="text-[#525252] mx-1">·</span>
                <span className="text-[#F59E0B]">Wrong {stats.byStatus.wrong_event ?? 0}</span>
              </p>
            )}
            {Object.keys(stats.byPass || {}).length > 0 && <p className="text-xs text-[#737373]">By pass: {Object.entries(stats.byPass || {}).map(([k, v]) => `${k} ${v}`).join(", ")}</p>}
          </div>
        ) : <p className="text-[#A3A3A3] text-sm">—</p>}

        <p className="text-white font-medium text-[13px] mt-3 mb-1">Recent scans</p>
        {recentScans.length === 0 && !loadingScans ? <p className="text-[#A3A3A3] text-sm">No scans yet</p> : (
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {recentScans.map((s) => (
              <li key={s.id} className={`flex items-center gap-2 py-2 rounded pr-1 pl-2 cursor-pointer ${expandedScanId === s.id ? "bg-[#252525]" : ""}`} style={{ borderLeft: `3px solid ${getStatusEdgeColor(s.scan_result)}` }} onClick={() => setExpandedScanId(expandedScanId === s.id ? null : s.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#737373] shrink-0">{new Date(s.scan_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium ${s.scan_result === "valid" ? "bg-[#22C55E]/20 text-[#22C55E]" : s.scan_result === "already_scanned" || s.scan_result === "wrong_event" ? "bg-[#F59E0B]/20 text-[#F59E0B]" : s.scan_result === "expired" ? "bg-[#A3A3A3]/20 text-[#A3A3A3]" : "bg-[#EF4444]/20 text-[#EF4444]"}`}>{s.scan_result === "valid" ? "Valid" : s.scan_result === "already_scanned" ? "Already" : s.scan_result === "wrong_event" ? "Wrong" : s.scan_result === "expired" ? "Exp" : "Invalid"}</span>
                    <span className="text-sm font-medium text-[#F5F5F5] truncate">{s.buyer_name || "—"}</span>
                  </div>
                  <p className="text-xs text-[#A3A3A3] pt-0.5">{s.pass_type || "—"}</p>
                  {expandedScanId === s.id && <p className="text-xs text-[#737373] pt-1">{s.buyer_name || "—"} · {s.pass_type || "—"}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {recentScans.length >= RECENT_SCANS_LIMIT && <button type="button" className="mt-1 text-xs text-[#E21836] hover:underline" onClick={() => navigate("/scanner/history")}>View full history</button>}
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
