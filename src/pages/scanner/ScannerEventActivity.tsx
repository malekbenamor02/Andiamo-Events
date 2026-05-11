import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { format } from "date-fns";
import { ArrowLeft, LogOut, Search } from "lucide-react";

const STORAGE_KEY = "scanner_selected_event";

interface SelectedEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
}

interface ScanRow {
  id: string;
  scan_time: string;
  scan_result: string;
  buyer_name: string | null;
  pass_type: string | null;
  ambassador_name: string | null;
  event_name: string | null;
  scanner_name?: string | null;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPass: Record<string, number>;
  byScannerStatus?: Record<string, { total: number; valid: number; invalid: number; already_scanned: number; wrong_event: number }>;
  scannerNames?: Record<string, string>;
  remaining_valid_passes?: number | null;
}

export default function ScannerEventActivity() {
  const navigate = useNavigate();
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [event, setEvent] = useState<SelectedEvent | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const o = JSON.parse(s) as SelectedEvent;
        if (o?.id) setEvent(o);
      }
    } catch {
      setEvent(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_SESSION}`, { credentials: "include" });
      if (r.status === 401) {
        navigate("/scanner/login", { replace: true });
        return;
      }
      const d = await r.json().catch(() => ({}));
      const role = d.role === "supervisor" ? "supervisor" : "scanner";
      setSessionRole(role);
      if (role !== "supervisor") {
        navigate("/scanner/events", { replace: true });
      }
    })();
  }, [navigate]);

  const loadData = useCallback(async () => {
    if (!event?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const qParam = appliedSearch.length >= 3 ? `&q=${encodeURIComponent(appliedSearch)}` : "";
      const [rStats, rScans] = await Promise.all([
        fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_EVENT_STATISTICS}?event_id=${encodeURIComponent(event.id)}`, { credentials: "include" }),
        fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_EVENT_SCANS}?event_id=${encodeURIComponent(event.id)}${qParam}`, { credentials: "include" }),
      ]);
      if (rStats.status === 403 || rScans.status === 403) {
        navigate("/scanner/events", { replace: true });
        return;
      }
      if (rStats.status === 401 || rScans.status === 401) {
        navigate("/scanner/login", { replace: true });
        return;
      }
      const dStats = await rStats.json().catch(() => ({}));
      const dScans = await rScans.json().catch(() => ({}));
      if (dStats.error) setErr(dStats.error);
      setStats(
        dStats.total != null
          ? {
              total: dStats.total,
              byStatus: dStats.byStatus || {},
              byPass: dStats.byPass || {},
              byScannerStatus: dStats.byScannerStatus,
              scannerNames: dStats.scannerNames,
              remaining_valid_passes: dStats.remaining_valid_passes,
            }
          : null
      );
      setScans(dScans.scans || []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [event?.id, appliedSearch, navigate]);

  useEffect(() => {
    if (sessionRole === "supervisor" && event?.id) void loadData();
  }, [sessionRole, event?.id, appliedSearch, loadData]);

  const logout = async () => {
    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGOUT}`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/scanner/login", { replace: true });
  };

  if (sessionRole === null) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
        <p className="text-[#B0B0B0]">Loading…</p>
      </div>
    );
  }

  if (sessionRole !== "supervisor") {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
        <p className="text-[#B0B0B0]">Loading…</p>
      </div>
    );
  }

  if (!event?.id) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-white text-center">Select an event first to view activity for that event.</p>
        <Button className="bg-[#E21836] hover:bg-[#c4142e]" onClick={() => navigate("/scanner/events")}>
          Choose event
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex justify-between items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[#B0B0B0]" onClick={() => navigate("/scanner/events")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Events
          </Button>
          <Button variant="ghost" size="icon" className="text-[#B0B0B0]" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
        <h1 className="text-lg font-semibold text-white">Event activity</h1>
        <p className="text-sm text-[#B0B0B0] truncate">{event.name}</p>

        {err && <p className="text-sm text-[#EF4444]">{err}</p>}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] p-3">
              <p className="text-xs text-[#737373]">Total scans</p>
              <p className="text-xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] p-3">
              <p className="text-xs text-[#737373]">Valid</p>
              <p className="text-xl font-bold text-[#22C55E]">{stats.byStatus.valid ?? 0}</p>
            </div>
            <div className="rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] p-3">
              <p className="text-xs text-[#737373]">Remaining passes</p>
              <p className="text-xl font-bold text-[#A3A3A3]">{(stats.remaining_valid_passes ?? 0).toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
            <Input
              className="pl-9 bg-[#1F1F1F] border-[#2A2A2A] text-white"
              placeholder="Search name, email, phone, or token (min 3 chars)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setAppliedSearch(search.trim());
              }}
            />
          </div>
          <Button className="bg-[#E21836] hover:bg-[#c4142e]" onClick={() => setAppliedSearch(search.trim())}>
            Search
          </Button>
        </div>

        {loading ? (
          <p className="text-[#B0B0B0]">Loading…</p>
        ) : (
          <div className="rounded-lg border border-[#2A2A2A] overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#2A2A2A]">
              {scans.length === 0 ? (
                <p className="p-4 text-[#737373] text-sm">No scans match.</p>
              ) : (
                scans.map((r) => (
                  <div key={r.id} className="p-3 bg-[#151515]">
                    <div className="flex justify-between gap-2 text-xs text-[#737373]">
                      <span>{r.scan_time ? format(new Date(r.scan_time), "PPp") : "—"}</span>
                      <span className={r.scan_result === "valid" ? "text-[#22C55E]" : "text-[#F59E0B]"}>{r.scan_result}</span>
                    </div>
                    <p className="text-white text-sm font-medium mt-1">{r.buyer_name || "—"}</p>
                    <p className="text-xs text-[#A3A3A3]">
                      {r.pass_type || "—"} · {r.scanner_name || "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {stats?.byScannerStatus && Object.keys(stats.byScannerStatus).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">By scanner</p>
            {Object.entries(stats.byScannerStatus)
              .sort((a, b) => (b[1]?.total || 0) - (a[1]?.total || 0))
              .map(([id, st]) => (
                <div key={id} className="rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] p-3 text-xs text-[#A3A3A3]">
                  <p className="text-white font-medium mb-1">{stats.scannerNames?.[id] || id.slice(0, 8)}</p>
                  <p>
                    total {st.total} · valid {st.valid} · dup {st.already_scanned} · invalid {st.invalid} · wrong {st.wrong_event}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
