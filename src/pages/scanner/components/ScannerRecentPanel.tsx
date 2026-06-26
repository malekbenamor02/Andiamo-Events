import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ScanRow, ScanStats } from "./scannerTypes";
import { getStatusConfig } from "./scannerStatus";
import { SCANNER_BG, SCANNER_BORDER, SCANNER_BRAND } from "./scannerTheme";

const RECENT_SCANS_LIMIT = 6;

interface ScannerRecentPanelProps {
  stats: ScanStats | null;
  recentScans: ScanRow[];
  loading: boolean;
  onViewAll: () => void;
  onExpand?: () => void;
}

export function ScanHistoryRow({ scan, showDate }: { scan: ScanRow; showDate?: boolean }) {
  const config = getStatusConfig(scan.scan_result);
  const timeLabel = (() => {
    if (!scan.scan_time) return "—";
    const d = new Date(scan.scan_time);
    if (Number.isNaN(d.getTime())) return "—";
    return showDate
      ? d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-[#0F0F0F] px-3 py-2.5"
      style={{ borderLeft: `3px solid ${config.accent}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              config.accentBg,
              config.textClass
            )}
          >
            {config.shortLabel}
          </span>
          <span className="text-xs text-[#737373]">{timeLabel}</span>
        </div>
        <p className="truncate text-sm font-medium text-white">{scan.buyer_name || "—"}</p>
        <p className="mt-0.5 truncate text-xs text-[#737373]">{scan.pass_type || "—"}</p>
      </div>
    </div>
  );
}

export function ScannerRecentPanel({ stats, recentScans, loading, onViewAll, onExpand }: ScannerRecentPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t" style={{ backgroundColor: SCANNER_BG, borderColor: SCANNER_BORDER }}>
      <Collapsible
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) onExpand?.();
        }}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[#141414]/80 transition-colors"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-[#737373] transition-transform duration-200",
                open && "rotate-90"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Recent scans</p>
              <p className="text-xs text-[#737373]">
                {stats ? `${stats.total ?? 0} total this event` : "Session history"}
              </p>
            </div>
          </button>
        </CollapsibleTrigger>
        {recentScans.length >= RECENT_SCANS_LIMIT && (
          <div className="flex justify-end px-4 -mt-2 mb-1">
            <button
              type="button"
              className="text-xs font-medium"
              style={{ color: SCANNER_BRAND }}
              onClick={onViewAll}
            >
              View all
            </button>
          </div>
        )}

        <CollapsibleContent className="px-4 pb-4">
          {stats && (
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[
                { label: "Valid", key: "valid", color: "#22C55E" },
                { label: "Invalid", key: "invalid", color: "#EF4444" },
                { label: "Already", key: "already_scanned", color: "#F59E0B" },
                { label: "Total", key: "_total", color: "#F5F5F5" },
              ].map(({ label, key, color }) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#2A2A2A]/80 bg-[#141414] p-2 text-center"
                >
                  <p className="mb-0.5 text-[10px] uppercase tracking-wide text-[#737373]">{label}</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color }}>
                    {key === "_total" ? stats.total ?? 0 : stats.byStatus[key] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <p className="py-4 text-center text-sm text-[#737373]">Loading…</p>
          ) : recentScans.length === 0 ? (
            <div className="rounded-xl border border-[#2A2A2A]/60 bg-[#141414] py-8 text-center">
              <p className="text-sm text-[#737373]">No scans yet</p>
              <p className="mt-1 text-xs text-[#525252]">Start scanning to see history</p>
            </div>
          ) : (
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {recentScans.map((s) => (
                <ScanHistoryRow key={s.id} scan={s} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
