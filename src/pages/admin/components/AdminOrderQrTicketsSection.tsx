/**
 * Super admin only: loads QR ticket images and per-ticket scan/generation status from GET /api/admin/order-qr-tickets.
 */

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode } from "lucide-react";
import Loader from "@/components/ui/Loader";
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from "@/lib/api-routes";
import { cn } from "@/lib/utils";

export type AdminOrderQrTicketsTheme = "default" | "pos";

interface QrTicketRow {
  id: string;
  pass_type: string | null;
  qr_code_url: string | null;
  scan_status: string | null;
  generation_status: string | null;
  generated_at: string | null;
}

interface OrderQrTicketsResponse {
  success?: boolean;
  order?: {
    id: string;
    status?: string | null;
    payment_status?: string | null;
    source?: string | null;
  };
  tickets?: QrTicketRow[];
  error?: string;
  details?: string;
}

function statusBadgeClass(status: string | null | undefined, theme: AdminOrderQrTicketsTheme): string {
  if (!status) return "";
  const u = status.toUpperCase();
  if (u === "VALID" || u === "GENERATED" || u === "DELIVERED" || u === "PAID") {
    return theme === "pos" ? "bg-green-700/40 text-green-200 border-green-600/50" : "bg-green-600 text-white border-green-700";
  }
  if (u === "USED") {
    return theme === "pos" ? "bg-blue-700/40 text-blue-200 border-blue-600/50" : "bg-blue-600 text-white border-blue-700";
  }
  if (u === "PENDING") {
    return theme === "pos" ? "bg-yellow-700/40 text-yellow-100 border-yellow-600/50" : "bg-yellow-500 text-black border-yellow-600";
  }
  if (u === "FAILED" || u === "INVALID" || u === "EXPIRED" || u === "WRONG_EVENT") {
    return theme === "pos" ? "bg-red-900/50 text-red-200 border-red-700/50" : "bg-red-600 text-white border-red-700";
  }
  return theme === "pos" ? "bg-[#333] text-[#E0E0E0] border-[#444]" : "bg-secondary text-secondary-foreground";
}

export interface AdminOrderQrTicketsSectionProps {
  orderId: string | null | undefined;
  open: boolean;
  language: "en" | "fr";
  isSuperAdmin: boolean;
  /** POS order detail dialog uses dark surfaces */
  theme?: AdminOrderQrTicketsTheme;
}

export function AdminOrderQrTicketsSection({
  orderId,
  open,
  language,
  isSuperAdmin,
  theme = "default",
}: AdminOrderQrTicketsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<OrderQrTicketsResponse | null>(null);

  useEffect(() => {
    if (!open || !orderId || !isSuperAdmin) {
      setPayload(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = buildFullApiUrl(API_ROUTES.ADMIN_ORDER_QR_TICKETS(orderId), getApiBaseUrl());
    if (!url) {
      setError(language === "en" ? "Invalid API URL" : "URL API invalide");
      setLoading(false);
      return;
    }

    void fetch(url, { credentials: "include", method: "GET" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as OrderQrTicketsResponse;
        if (!res.ok) {
          const msg =
            data.details || data.error || (language === "en" ? "Failed to load QR tickets" : "Échec du chargement des QR");
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setPayload(null);
          setError(e.message || (language === "en" ? "Failed to load" : "Échec du chargement"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, orderId, isSuperAdmin, language]);

  if (!isSuperAdmin) return null;

  const title = language === "en" ? "Ticket QR codes (super admin)" : "Codes QR des billets (super admin)";
  const scanLabel = language === "en" ? "Scan" : "Scan";
  const genLabel = language === "en" ? "Ticket" : "Billet";
  const emptyMsg =
    language === "en"
      ? "No QR tickets found for this order yet (tickets may not be generated)."
      : "Aucun billet QR pour cette commande (les billets ne sont peut‑être pas encore générés).";

  const isPos = theme === "pos";

  return (
    <Card
      className={cn(
        isPos ? "bg-[#252525] border-[#2A2A2A]" : "bg-muted/30"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle
          className={cn(
            "text-lg flex items-center gap-2",
            isPos ? "text-[#E21836]" : ""
          )}
        >
          <QrCode className={cn("w-5 h-5", isPos ? "text-[#E21836]" : "text-primary")} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-2 py-4">
            <Loader size="sm" />
            <span className={cn("text-sm", isPos ? "text-[#B0B0B0]" : "text-muted-foreground")}>
              {language === "en" ? "Loading…" : "Chargement…"}
            </span>
          </div>
        )}

        {error && !loading && (
          <p className={cn("text-sm", isPos ? "text-red-300" : "text-destructive")}>{error}</p>
        )}

        {!loading && !error && payload && Array.isArray(payload.tickets) && payload.tickets.length === 0 && (
          <p className={cn("text-sm", isPos ? "text-[#B0B0B0]" : "text-muted-foreground")}>{emptyMsg}</p>
        )}

        {!loading && !error && payload?.tickets && payload.tickets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {payload.tickets.map((t, idx) => {
              const primaryStatus = t.scan_status || t.generation_status;
              const secondaryLabel = t.scan_status ? scanLabel : genLabel;
              return (
                <div
                  key={t.id || idx}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    isPos ? "border-[#2A2A2A] bg-[#1F1F1F]" : "border-border bg-background/40"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {t.pass_type && (
                      <Badge variant="secondary" className={cn(isPos && "bg-[#333] text-[#F5F5F5]")}>
                        {t.pass_type}
                      </Badge>
                    )}
                    {primaryStatus && (
                      <Badge variant="outline" className={statusBadgeClass(primaryStatus, theme)}>
                        {secondaryLabel}: {primaryStatus}
                      </Badge>
                    )}
                  </div>
                  {t.qr_code_url ? (
                    <div className="flex justify-center pt-1">
                      <img
                        src={t.qr_code_url}
                        alt=""
                        className="max-w-[200px] w-full h-auto rounded-md border border-border/50"
                      />
                    </div>
                  ) : (
                    <p className={cn("text-xs text-center py-2", isPos ? "text-[#888]" : "text-muted-foreground")}>
                      {language === "en" ? "No QR image URL" : "Pas d'URL d'image QR"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
