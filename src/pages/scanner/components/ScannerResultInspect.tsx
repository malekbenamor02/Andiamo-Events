import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ScanResult } from "./scannerTypes";
import { SCANNER_BRAND } from "./scannerTheme";

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        >
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-90")}
          />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="py-2 border-b border-[#2A2A2A]/40 last:border-0">
      <p className="text-[11px] text-[#737373]">{label}</p>
      <p className="mt-0.5 text-sm text-[#F5F5F5] break-all">{value || "—"}</p>
    </div>
  );
}

export function ScannerResultInspect({ result }: { result: ScanResult }) {
  const panel = result.inspect_panel;
  if (!panel) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#2A2A2A]/80 bg-[#0A0A0A]/60 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#737373]">Summary</p>
        <p className="mt-1 text-lg font-semibold text-white">{panel.pass_type || "—"}</p>
        <p className="mt-1 text-sm text-[#E5E5E5]">{panel.buyer_name || "—"}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-[#737373]">Event</p>
            <p className="text-sm text-[#F5F5F5]">{panel.event_name || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#737373]">Status</p>
            <p className="text-sm text-[#F5F5F5]">{result.ticket_status || "—"}</p>
          </div>
        </div>
      </div>

      <Section title="Contact">
        <Field label="Email" value={panel.buyer_email} />
        <Field label="Phone" value={panel.buyer_phone} />
      </Section>

      <Section title="Order">
        <Field label="Payment" value={panel.payment_method_label || panel.payment_method} />
        <Field
          label="Price"
          value={
            panel.pass_price_formatted != null ? `${panel.pass_price_formatted} TND` : null
          }
        />
        {panel.order_number != null ? (
          <Field label="Order number" value={`#${panel.order_number}`} />
        ) : null}
      </Section>

      {result.order_passes && result.order_passes.length > 0 && (
        <Section title="Passes on this order">
          <ul className="space-y-2">
            {result.order_passes.map((p) => (
              <li
                key={p.qr_ticket_id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm",
                  p.is_current
                    ? "border-[#E21836]/40 bg-[#E21836]/10"
                    : "border-[#2A2A2A] bg-[#0F0F0F]"
                )}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-white">{p.pass_type || "—"}</span>
                  <span className="text-xs text-[#737373]">{p.ticket_status || "—"}</span>
                </div>
                {p.token_preview && (
                  <p className="mt-1 font-mono text-[10px] text-[#737373]">{p.token_preview}</p>
                )}
                {p.is_current && (
                  <p className="mt-1 text-[10px] font-semibold uppercase" style={{ color: SCANNER_BRAND }}>
                    This QR
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(result.scan_history) && result.scan_history.length > 0 && (
        <Section title="Scan history">
          <ul className="space-y-3">
            {result.scan_history.map((h) => (
              <li key={h.id} className="border-b border-[#2A2A2A]/40 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#F5F5F5]">{h.scan_result}</span>
                  <span className="text-xs text-[#737373]">
                    {h.scan_time ? new Date(h.scan_time).toLocaleString() : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#A3A3A3]">
                  {h.scanner_name || "—"}
                  {h.notes ? ` · ${h.notes}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
