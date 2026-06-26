import { Badge } from "@/components/ui/badge";
import type { ScanResult } from "./scannerTypes";

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ScannerResultValid({ result }: { result: ScanResult }) {
  const ticket = result.ticket;
  if (!ticket) return null;

  const guestName = ticket.is_invitation
    ? ticket.recipient_name || ticket.buyer_name || "—"
    : ticket.buyer_name || "—";

  const invitationDetail = [
    ticket.invitation_number ? `#${ticket.invitation_number}` : "",
    ticket.recipient_email || "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <div className="border-b border-border/60 px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pass</p>
        <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{ticket.pass_type || "—"}</p>
      </div>
      <div className="px-4 py-1">
        <InfoRow label="Guest" value={guestName} />
        {ticket.is_invitation && invitationDetail ? (
          <InfoRow label="Invitation" value={invitationDetail} />
        ) : null}
        {!ticket.is_invitation && ticket.ambassador_name ? (
          <InfoRow label="Ambassador" value={ticket.ambassador_name} />
        ) : null}
        {ticket.event_name ? <InfoRow label="Event" value={ticket.event_name} /> : null}
      </div>
      {ticket.source === "point_de_vente" && (
        <div className="px-4 pb-4">
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Point de vente
          </Badge>
        </div>
      )}
    </div>
  );
}
