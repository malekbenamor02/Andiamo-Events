import { Button } from "@/components/ui/button";
import { BarChart2, BatteryWarning, Cloud, History, LogOut, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSyncAgo, SCANNER_BG, SCANNER_BORDER } from "./scannerTheme";

interface ScannerScanHeaderProps {
  eventName: string;
  scannerRole: "scanner" | "supervisor" | null;
  scanMode: "gate" | "inspect";
  onScanModeChange: (mode: "gate" | "inspect") => void;
  isOffline: boolean;
  lastSyncedAt: Date | null;
  lowBattery: boolean;
  onEventActivity: () => void;
  onHistory: () => void;
  onLogout: () => void;
}

export function ScannerScanHeader({
  eventName,
  scannerRole,
  scanMode,
  onScanModeChange,
  isOffline,
  lastSyncedAt,
  lowBattery,
  onEventActivity,
  onHistory,
  onLogout,
}: ScannerScanHeaderProps) {
  return (
    <div
      className="sticky top-0 z-40 backdrop-blur-sm border-b px-4 py-3"
      style={{ backgroundColor: `${SCANNER_BG}f2`, borderColor: SCANNER_BORDER }}
    >
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{eventName}</h1>
        <div className="flex shrink-0 items-center gap-0.5">
          {scannerRole === "supervisor" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white"
              onClick={onEventActivity}
              aria-label="Event activity"
            >
              <BarChart2 className="h-4 w-4" />
            </Button>
          )}
          {isOffline && (
            <span className="p-1.5 text-red-500" title="Offline">
              <WifiOff className="h-4 w-4" />
            </span>
          )}
          {!isOffline && lastSyncedAt && (
            <span className="p-1.5 text-emerald-500" title={`Synced ${formatSyncAgo(lastSyncedAt)}`}>
              <Cloud className="h-4 w-4" />
            </span>
          )}
          {lowBattery && (
            <span className="p-1.5 text-amber-500" title="Low battery">
              <BatteryWarning className="h-4 w-4" />
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white"
            onClick={onHistory}
            aria-label="History"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-white"
            onClick={onLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {scannerRole === "supervisor" && (
        <div className="mt-2.5 flex rounded-full border border-[#2A2A2A] bg-[#141414] p-0.5">
          {(["gate", "inspect"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onScanModeChange(mode)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition-all duration-200",
                scanMode === mode
                  ? "bg-[#E21836] text-white shadow-sm"
                  : "text-[#737373] hover:text-[#A3A3A3]"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
