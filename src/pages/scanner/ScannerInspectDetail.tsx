import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl, API_ROUTES } from "@/lib/api-routes";
import { ArrowLeft, ExternalLink, LogOut } from "lucide-react";
import { format } from "date-fns";

type InspectPanel = {
  qr_ticket_id: string;
  pass_type: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  event_name: string | null;
  payment_method: string | null;
  payment_method_label: string | null;
  pass_price: number | null;
  pass_price_formatted: string | null;
  order_number: string | null;
};

type OrderPassRow = {
  qr_ticket_id: string;
  pass_type: string | null;
  ticket_status: string | null;
  token_preview: string | null;
  is_current: boolean;
};

type ScanHistoryRow = {
  id: string;
  scan_time: string;
  scan_result: string;
  scanner_name?: string | null;
  notes?: string | null;
};

function inspectDetailPath(qrTicketId: string, eventId: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  const q = new URLSearchParams({ qr_ticket_id: qrTicketId, event_id: eventId }).toString();
  return `${prefix}/scanner/inspect-detail?${q}`;
}

function inspectDetailAbsoluteUrl(qrTicketId: string, eventId: string): string {
  if (typeof window === "undefined") return inspectDetailPath(qrTicketId, eventId);
  return `${window.location.origin}${inspectDetailPath(qrTicketId, eventId)}`;
}

export default function ScannerInspectDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrTicketId = (searchParams.get("qr_ticket_id") || "").trim();
  const eventId = (searchParams.get("event_id") || "").trim();

  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [inspectPanel, setInspectPanel] = useState<InspectPanel | null>(null);
  const [orderPasses, setOrderPasses] = useState<OrderPassRow[] | null>(null);
  const [invitation, setInvitation] = useState<Record<string, unknown> | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryRow[]>([]);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [previousScan, setPreviousScan] = useState<{ scanned_at?: string; scanner_name?: string } | null>(null);
  const [showAllPasses, setShowAllPasses] = useState(false);

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

  const load = useCallback(async () => {
    if (!qrTicketId || !eventId) {
      setErr("Missing ticket or event.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const url = `${getApiBaseUrl()}${API_ROUTES.SCANNER_INSPECT_DETAIL(qrTicketId, eventId)}`;
      const r = await fetch(url, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) {
        navigate("/scanner/login", { replace: true });
        return;
      }
      if (r.status === 403) {
        setErr(d.error || "This ticket does not belong to the selected event.");
        setInspectPanel(null);
        setOrderPasses(null);
        return;
      }
      if (r.status === 404) {
        setErr(d.error || "Ticket not found.");
        setInspectPanel(null);
        setOrderPasses(null);
        return;
      }
      if (r.status === 503 && d.enabled === false) {
        setErr("Scan system is not started.");
        return;
      }
      if (!d.success && d.error) {
        setErr(d.error || "Could not load inspect details.");
        return;
      }
      setInspectPanel(d.inspect_panel && typeof d.inspect_panel === "object" ? d.inspect_panel : null);
      setOrderPasses(Array.isArray(d.order_passes) ? d.order_passes : null);
      setInvitation(
        d.invitation && typeof d.invitation === "object" && !Array.isArray(d.invitation)
          ? (d.invitation as Record<string, unknown>)
          : null
      );
      setScanHistory(Array.isArray(d.scan_history) ? d.scan_history : []);
      setTicketStatus(d.ticket_status ?? null);
      setPreviousScan(d.previous_scan || null);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [qrTicketId, eventId, navigate]);

  useEffect(() => {
    if (sessionRole === "supervisor" && qrTicketId && eventId) void load();
  }, [sessionRole, qrTicketId, eventId, load]);

  const logout = async () => {
    try {
      await fetch(`${getApiBaseUrl()}${API_ROUTES.SCANNER_LOGOUT}`, { method: "POST", credentials: "include" });
    } catch {}
    navigate("/scanner/login", { replace: true });
  };

  if (sessionRole === null || sessionRole !== "supervisor") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <p className="text-[#A3A3A3] text-sm">Loading…</p>
      </div>
    );
  }

  const passes = orderPasses || [];
  const currentOnly = passes.filter((p) => p.is_current);
  const defaultList = currentOnly.length > 0 ? currentOnly : passes.slice(0, Math.min(3, passes.length));
  const displayedPasses = showAllPasses ? passes : defaultList;
  const hasMorePasses = passes.length > displayedPasses.length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-12">
      <div className="sticky top-0 z-10 border-b border-[#1A1A1A] bg-[#0A0A0A]/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#A3A3A3] hover:text-white -ml-2"
          onClick={() => navigate("/scanner/scan")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex gap-1">
          {inspectPanel?.qr_ticket_id && eventId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#2A2A2A] text-[#E5E5E5]"
              onClick={() => window.open(inspectDetailAbsoluteUrl(inspectPanel.qr_ticket_id, eventId), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> New tab
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="text-[#A3A3A3]" onClick={logout} aria-label="Logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Inspect report</h1>

        {loading && <p className="text-[#A3A3A3]">Loading…</p>}
        {err && !loading && <p className="text-sm text-[#EF4444]">{err}</p>}

        {!loading && !err && inspectPanel && (
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 space-y-4 shadow-xl">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">This pass</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[#737373] text-xs">Pass type</dt>
                <dd className="text-lg font-semibold text-white mt-0.5">{inspectPanel.pass_type || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#737373] text-xs">Name</dt>
                <dd className="text-white font-medium mt-0.5">{inspectPanel.buyer_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#737373] text-xs">Email</dt>
                <dd className="text-[#E5E5E5] break-all mt-0.5">{inspectPanel.buyer_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#737373] text-xs">Phone</dt>
                <dd className="text-[#E5E5E5] mt-0.5">{inspectPanel.buyer_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#737373] text-xs">Event</dt>
                <dd className="text-[#E5E5E5] mt-0.5">{inspectPanel.event_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#737373] text-xs">Payment</dt>
                <dd className="text-[#E5E5E5] mt-0.5">{inspectPanel.payment_method_label || inspectPanel.payment_method || "—"}</dd>
              </div>
              <div>
                <dt className="text-[#737373] text-xs">Price</dt>
                <dd className="text-[#E5E5E5] mt-0.5">
                  {inspectPanel.pass_price_formatted != null ? `${inspectPanel.pass_price_formatted} TND` : "—"}
                </dd>
              </div>
              {inspectPanel.order_number != null && (
                <div>
                  <dt className="text-[#737373] text-xs">Order number</dt>
                  <dd className="text-white font-mono mt-0.5">#{inspectPanel.order_number}</dd>
                </div>
              )}
            </dl>
            {ticketStatus && (
              <p className="text-xs text-[#737373] pt-2 border-t border-[#1A1A1A]">
                Ticket status: <span className="text-[#E5E5E5]">{ticketStatus}</span>
              </p>
            )}
          </section>
        )}

        {!loading && !err && passes.length > 0 && (
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">Order passes</h2>
              <span className="text-xs text-[#525252]">{passes.length} total</span>
            </div>
            <ul className="space-y-2">
              {displayedPasses.map((p) => (
                <li
                  key={p.qr_ticket_id}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    p.is_current ? "border-[#E21836]/60 bg-[#E21836]/10" : "border-[#1A1A1A] bg-[#0F0F0F]"
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-white">{p.pass_type || "—"}</span>
                    <span className="text-[#737373] text-xs shrink-0">{p.ticket_status || "—"}</span>
                  </div>
                  {p.token_preview && <p className="text-xs text-[#737373] mt-1 font-mono">{p.token_preview}</p>}
                  {p.is_current && <p className="text-[10px] text-[#E21836] font-semibold mt-1 uppercase">This QR</p>}
                </li>
              ))}
            </ul>
            {hasMorePasses && !showAllPasses && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-[#2A2A2A] text-[#E5E5E5] hover:bg-[#1A1A1A]"
                onClick={() => setShowAllPasses(true)}
              >
                View all QR passes for this order
              </Button>
            )}
            {showAllPasses && passes.length > 1 && (
              <Button type="button" variant="ghost" className="w-full text-[#737373]" onClick={() => setShowAllPasses(false)}>
                Show less
              </Button>
            )}
          </section>
        )}

        {!loading && !err && invitation && Object.keys(invitation).length > 0 && (
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-3">Invitation</h2>
            <ul className="space-y-2 text-sm">
              {Object.entries(invitation)
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => (
                  <li key={k} className="flex gap-2">
                    <span className="text-[#737373] shrink-0 w-28 truncate">{k}</span>
                    <span className="text-[#E5E5E5] break-all">{String(v)}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {previousScan && (
          <section className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4 text-sm">
            <p className="text-[#F59E0B] font-medium text-xs uppercase mb-1">Previously scanned (valid)</p>
            <p className="text-[#A3A3A3]">
              {previousScan.scanner_name || "—"} ·{" "}
              {previousScan.scanned_at ? format(new Date(previousScan.scanned_at), "PPp") : "—"}
            </p>
          </section>
        )}

        {!loading && !err && scanHistory.length > 0 && (
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-3">Scan history</h2>
            <ul className="space-y-3 text-sm max-h-64 overflow-y-auto">
              {scanHistory.map((h) => (
                <li key={h.id} className="border-b border-[#1A1A1A] pb-2 last:border-0">
                  <span className="text-white">{h.scan_result}</span>
                  <span className="text-[#737373] ml-2 text-xs">{h.scan_time ? format(new Date(h.scan_time), "PPp") : ""}</span>
                  <p className="text-xs text-[#A3A3A3] mt-0.5">{h.scanner_name || "—"}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
  );
}
