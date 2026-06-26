import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-routes";
import { API_ROUTES } from "@/lib/api-routes";
import { ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScanHistoryRow } from "./components/ScannerRecentPanel";
import { SCANNER_BG, SCANNER_BORDER, SCANNER_BRAND } from "./components/scannerTheme";

interface Scan {
  id: string;
  scan_time: string;
  scan_result: string;
  buyer_name: string | null;
  pass_type: string | null;
  ambassador_name: string | null;
  event_name: string | null;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPass: Record<string, number>;
}

type FilterKey = "all" | "valid" | "already_scanned" | "invalid" | "wrong_event";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "valid", label: "Valid" },
  { key: "already_scanned", label: "Already" },
  { key: "invalid", label: "Invalid" },
  { key: "wrong_event", label: "Wrong" },
];

export default function ScannerHistory() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rScans, rStats] = await Promise.all([
          fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_SCANS}`, { credentials: "include" }),
          fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_STATISTICS}`, { credentials: "include" }),
        ]);
        if (rScans.status === 401 || rStats.status === 401) {
          navigate("/scanner/login", { replace: true });
          return;
        }
        const dScans = await rScans.json().catch(() => ({}));
        const dStats = await rStats.json().catch(() => ({}));
        setScans(dScans.scans || []);
        setStats({ total: dStats.total ?? 0, byStatus: dStats.byStatus || {}, byPass: dStats.byPass || {} });
      } catch {
        setScans([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const filteredScans = useMemo(() => {
    if (filter === "all") return scans;
    return scans.filter((s) => s.scan_result === filter);
  }, [scans, filter]);

  const logout = async () => {
    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGOUT}`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/scanner/login", { replace: true });
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: SCANNER_BG }}>
      <div className="mx-auto max-w-lg">
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm"
          style={{ backgroundColor: `${SCANNER_BG}f2`, borderColor: SCANNER_BORDER }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="text-[#A3A3A3] hover:bg-[#141414] hover:text-white"
            onClick={() => navigate("/scanner/events")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-white">History</h1>
          <Button
            variant="ghost"
            size="icon"
            className="text-[#A3A3A3] hover:bg-[#141414] hover:text-white"
            onClick={logout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {stats && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hidden">
              {[
                { label: "Total", value: stats.total ?? 0, color: "#F5F5F5" },
                { label: "Valid", value: stats.byStatus.valid ?? 0, color: "#22C55E" },
                { label: "Already", value: stats.byStatus.already_scanned ?? 0, color: "#F59E0B" },
                { label: "Invalid", value: stats.byStatus.invalid ?? 0, color: "#EF4444" },
                { label: "Wrong", value: stats.byStatus.wrong_event ?? 0, color: "#EF4444" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="shrink-0 rounded-xl border border-[#2A2A2A]/80 bg-[#141414] px-4 py-3 min-w-[5.5rem]"
                >
                  <p className="text-[10px] uppercase tracking-wide text-[#737373]">{label}</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums" style={{ color }}>
                    {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === key
                    ? "text-white"
                    : "border border-[#2A2A2A] bg-[#141414] text-[#737373] hover:text-[#A3A3A3]"
                )}
                style={filter === key ? { backgroundColor: SCANNER_BRAND } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-[#737373]">Loading…</p>
          ) : filteredScans.length === 0 ? (
            <div className="rounded-xl border border-[#2A2A2A]/60 bg-[#141414] py-12 text-center">
              <p className="text-sm text-[#737373]">No scans found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredScans.map((s) => (
                <ScanHistoryRow
                  key={s.id}
                  scan={{
                    id: s.id,
                    scan_time: s.scan_time,
                    scan_result: s.scan_result,
                    buyer_name: s.buyer_name,
                    pass_type: s.pass_type,
                  }}
                  showDate
                />
              ))}
            </div>
          )}

          {stats && Object.keys(stats.byPass || {}).length > 0 && (
            <p className="text-xs text-[#737373] pt-2 border-t border-[#2A2A2A]/60">
              By pass:{" "}
              {Object.entries(stats.byPass)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
