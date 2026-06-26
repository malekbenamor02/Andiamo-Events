import { formatDateDMY } from "@/lib/date-utils";
import type { ScanResult } from "./scannerTypes";
import { ScannerResultValid } from "./ScannerResultValid";

export function ScannerResultDuplicate({ result }: { result: ScanResult }) {
  return (
    <div className="space-y-3">
      {result.previous_scan && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            Previous scan
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {result.previous_scan.scanner_name || "Unknown scanner"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.previous_scan.scanned_at
              ? new Date(result.previous_scan.scanned_at).toLocaleString()
              : "—"}
          </p>
        </div>
      )}
      {result.ticket ? <ScannerResultValid result={result} /> : null}
    </div>
  );
}

export function ScannerResultWrongEvent({ result }: { result: ScanResult }) {
  return (
    <div className="space-y-3">
      {result.correct_event && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            Correct event
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">{result.correct_event.event_name || "—"}</p>
          {result.correct_event.event_date ? (
            <p className="mt-1 text-sm text-muted-foreground">{formatDateDMY(result.correct_event.event_date)}</p>
          ) : null}
        </div>
      )}
      {result.ticket ? <ScannerResultValid result={result} /> : null}
    </div>
  );
}

export function ScannerResultInvalid({ result }: { result: ScanResult }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{result.message}</p>;
}
