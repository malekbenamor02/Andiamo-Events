/**
 * Reports & Analytics Page Component
 * Main component that orchestrates all analytics sections
 */

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAnalytics, DateRange } from '@/hooks/useAnalytics';
import { useEvents } from '@/hooks/useEvents';
import { KPICards } from './KPICards';
import { SalesOverTime } from './SalesOverTime';
import { PassPerformance } from './PassPerformance';
import { SalesChannelBreakdown } from './SalesChannelBreakdown';
import { Insights } from './Insights';
import { Download, Loader2 } from 'lucide-react';
import { formatDateDMY } from '@/lib/date-utils';
import { canDownloadReportsExcel, downloadReportsExcel } from '@/lib/analytics/reportsExcelExport';
import { useToast } from '@/hooks/use-toast';

interface ReportsAnalyticsProps {
  language?: 'en' | 'fr';
  /** When provided, syncs the event selector with the main Dashboard filter so both show the same event and consistent numbers. */
  dashboardSelectedEventId?: string | null;
  /** Logged-in admin role from session; export is only for admin / super_admin. */
  adminRole?: string | null;
}

function pageCopy(language: 'en' | 'fr') {
  if (language === 'fr') {
    return {
      title: 'Rapports & analyses',
      noEvent: 'Sélectionnez un événement dans la barre d’outils',
      allTime: 'Tout',
      last30: '30 derniers jours',
      last7: '7 derniers jours',
      export: 'Exporter Excel',
      period: 'Période',
      loadError: 'Impossible de charger les données. Réessayez.',
      accessDenied: 'Accès refusé',
      accessDeniedDesc: 'Seuls les administrateurs peuvent exporter ce rapport.',
      exportReady: 'Export réussi',
      exportReadyDesc:
        'Le fichier Excel (synthèse, en ligne, ambassadeurs, PDV et stock) a été téléchargé.',
      exportFailed: 'Échec de l’export',
    };
  }
  return {
    title: 'Reports & analytics',
    noEvent: 'Select an event from the toolbar above',
    allTime: 'All time',
    last30: 'Last 30 days',
    last7: 'Last 7 days',
    export: 'Export Excel',
    period: 'Period',
    loadError: 'Failed to load analytics data. Please try again.',
    accessDenied: 'Access denied',
    accessDeniedDesc: 'Only administrators can export this report.',
    exportReady: 'Export ready',
    exportReadyDesc:
      'Excel file downloaded with Summary, Online, Ambassador, POS, and Pass stock sheets.',
    exportFailed: 'Export failed',
  };
}

function dateRangeLabel(range: DateRange, language: 'en' | 'fr') {
  const t = pageCopy(language);
  if (range === 'LAST_30_DAYS') return t.last30;
  if (range === 'LAST_7_DAYS') return t.last7;
  return t.allTime;
}

export function ReportsAnalytics({
  language = 'en',
  dashboardSelectedEventId,
  adminRole = null,
}: ReportsAnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>('ALL_TIME');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const { data: events } = useEvents();
  const selectedEventId = dashboardSelectedEventId ?? null;
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(
    selectedEventId,
    dateRange,
  );

  const selectedEvent = selectedEventId ? events?.find((e) => e.id === selectedEventId) : null;
  const t = pageCopy(language);
  const canExportExcel = canDownloadReportsExcel(adminRole);

  const handleExportExcel = async () => {
    if (!canDownloadReportsExcel(adminRole)) {
      toast({
        variant: 'destructive',
        title: t.accessDenied,
        description: t.accessDeniedDesc,
      });
      return;
    }
    setExporting(true);
    try {
      await downloadReportsExcel({
        eventId: selectedEventId,
        eventName: selectedEvent?.name ?? null,
        dateRange,
        language: language === 'fr' ? 'fr' : 'en',
        adminRole,
      });
      toast({
        title: t.exportReady,
        description: t.exportReadyDesc,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: t.exportFailed,
        description: msg,
      });
    } finally {
      setExporting(false);
    }
  };

  const lang = language === 'fr' ? 'fr' : 'en';

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{t.title}</h2>
            {selectedEvent ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedEvent.name}
                <span className="mx-1.5 text-border">·</span>
                {formatDateDMY(selectedEvent.date, language)}
                {(selectedEvent.venue || selectedEvent.city) && (
                  <>
                    <span className="mx-1.5 text-border">·</span>
                    {[selectedEvent.venue, selectedEvent.city].filter(Boolean).join(', ')}
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{t.noEvent}</p>
            )}
            {analyticsData && (
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                {dateRangeLabel(dateRange, language)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
              <SelectTrigger className="h-9 w-[9.5rem] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_TIME">{t.allTime}</SelectItem>
                <SelectItem value="LAST_30_DAYS">{t.last30}</SelectItem>
                <SelectItem value="LAST_7_DAYS">{t.last7}</SelectItem>
              </SelectContent>
            </Select>
            {canExportExcel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2"
                disabled={exporting || analyticsLoading}
                onClick={handleExportExcel}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t.export}
              </Button>
            )}
          </div>
        </div>
      </div>

      {analyticsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{t.loadError}</p>
        </div>
      )}

      <KPICards
        data={
          analyticsData
            ? {
                pendingCashAndApprovalOrders: analyticsData.pendingCashAndApprovalOrders,
                pendingCashAndApprovalPasses: analyticsData.pendingCashAndApprovalPasses,
                pendingCashAndApprovalRevenue: analyticsData.pendingCashAndApprovalRevenue,
                totalTicketsSold: analyticsData.totalTicketsSold,
                totalRevenue: analyticsData.totalRevenue,
                totalOrders: analyticsData.totalOrders,
                presalePaidTickets: analyticsData.presalePaidTickets,
                presalePaidBreakdown: analyticsData.presalePaidBreakdown,
                averageTicketsPerDay: analyticsData.averageTicketsPerDay,
                ambassadorsInvolved: analyticsData.ambassadorsInvolved,
                trends: analyticsData.trends,
              }
            : null
        }
        loading={analyticsLoading}
        error={!!analyticsError}
        language={lang}
      />

      <Insights data={analyticsData?.insights || null} loading={analyticsLoading} language={lang} />

      <SalesOverTime
        data={analyticsData?.salesOverTime || null}
        loading={analyticsLoading}
        language={lang}
      />

      <PassPerformance
        data={analyticsData?.passPerformance || null}
        loading={analyticsLoading}
        language={lang}
      />

      <SalesChannelBreakdown
        data={analyticsData?.channelBreakdown || null}
        loading={analyticsLoading}
        language={lang}
      />
    </div>
  );
}
