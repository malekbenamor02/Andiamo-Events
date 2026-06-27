/**
 * Super admin only: server-generated QR previews from GET /api/admin/order-qr-tickets.
 * Tokens and public QR URLs are never exposed to the client.
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
  label?: string | null;
  pass_type: string | null;
  qr_preview_data_url: string | null;
  qr_preview_available?: boolean;
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
  total_count?: number;
  truncated?: boolean;
  preview_limit?: number;
  error?: string;
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

function safeLoadError(language: "en" | "fr"): string {
  return language === "en" ? "Could not load ticket QR previews" : "Impossible de charger les aperçus QR";
}

function previewUnavailableMessage(language: "en" | "fr"): string {
  return language === "en" ? "QR preview unavailable" : "Aperçu QR indisponible";
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
  const [failedQrIds, setFailedQrIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !orderId || !isSuperAdmin) {
      setPayload(null);
      setError(null);
      setFailedQrIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setFailedQrIds(new Set());

    const url = buildFullApiUrl(API_ROUTES.ADMIN_ORDER_QR_TICKETS(orderId), getApiBaseUrl());
    if (!url) {
      setError(safeLoadError(language));
      setLoading(false);
      return;
    }

    void fetch(url, { credentials: "include", method: "GET" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as OrderQrTicketsResponse;
        if (!res.ok) {
          throw new Error(safeLoadError(language));
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPayload(null);
          setError(safeLoadError(language));
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

        {!loading && !error && payload?.truncated && (
          <p className={cn("text-xs", isPos ? "text-[#B0B0B0]" : "text-muted-foreground")}>
            {language === "en"
              ? `Showing first ${payload.preview_limit ?? ""} of ${payload.total_count ?? ""} tickets.`
              : `Affichage des ${payload.preview_limit ?? ""} premiers billets sur ${payload.total_count ?? ""}.`}
          </p>
        )}

        {!loading && !error && payload && Array.isArray(payload.tickets) && payload.tickets.length === 0 && (
          <p className={cn("text-sm", isPos ? "text-[#B0B0B0]" : "text-muted-foreground")}>{emptyMsg}</p>
        )}

        {!loading && !error && payload?.tickets && payload.tickets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {payload.tickets.map((t, idx) => {
              const primaryStatus = t.scan_status || t.generation_status;
              const secondaryLabel = t.scan_status ? scanLabel : genLabel;
              const rowKey = t.id || String(idx);
              const qrFailed = failedQrIds.has(rowKey);
              const hasPreview = Boolean(t.qr_preview_data_url) && t.qr_preview_available !== false;
              return (
                <div
                  key={rowKey}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    isPos ? "border-[#2A2A2A] bg-[#1F1F1F]" : "border-border bg-background/40"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {t.label && (
                      <span className={cn("text-xs font-medium", isPos ? "text-[#E0E0E0]" : "text-foreground")}>
                        {t.label}
                      </span>
                    )}
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
                  {hasPreview && !qrFailed ? (
                    <div className="flex justify-center pt-1">
                      <img
                        src={t.qr_preview_data_url!}
                        alt={language === "en" ? "Ticket QR code" : "Code QR du billet"}
                        className="max-w-[200px] w-full h-auto rounded-md border border-border/50 bg-white p-1"
                        onError={() => {
                          setFailedQrIds((prev) => new Set(prev).add(rowKey));
                        }}
                      />
                    </div>
                  ) : (
                    <p className={cn("text-xs text-center py-2", isPos ? "text-[#888]" : "text-muted-foreground")}>
                      {qrFailed
                        ? language === "en"
                          ? "QR preview could not be displayed"
                          : "Impossible d'afficher l'aperçu QR"
                        : previewUnavailableMessage(language)}
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
