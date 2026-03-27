/**
 * Reports & Analytics Page Component
 * Main component that orchestrates all analytics sections
 */

import { useState, useEffect } from 'react';
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

export function ReportsAnalytics({ language = 'en', dashboardSelectedEventId, adminRole = null }: ReportsAnalyticsProps) {
  const [dateRange, setDateRange] = useState<DateRange>('ALL_TIME');
  const [animationKey, setAnimationKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const { data: events, isLoading: eventsLoading } = useEvents();
  const selectedEventId = dashboardSelectedEventId ?? null;
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(selectedEventId, dateRange);

  // Reset animations when event or date range changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [selectedEventId, dateRange]);

  const selectedEvent = selectedEventId 
    ? events?.find(e => e.id === selectedEventId)
    : null;

  const canExportExcel = canDownloadReportsExcel(adminRole);

  const handleExportExcel = async () => {
    if (!canDownloadReportsExcel(adminRole)) {
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Accès refusé' : 'Access denied',
        description:
          language === 'fr'
            ? 'Seuls les administrateurs peuvent exporter ce rapport.'
            : 'Only administrators can export this report.',
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
        title: language === 'fr' ? 'Export réussi' : 'Export ready',
        description:
          language === 'fr'
            ? 'Le fichier Excel (en ligne + ambassadeurs) a été téléchargé.'
            : 'Excel file downloaded with Online payments and Ambassador sales sheets.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Échec de l’export' : 'Export failed',
        description: msg,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6" key={animationKey}>
      {/* Event Context - Top of Page */}
      <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gradient-neon mb-2 animate-in slide-in-from-left-4 duration-1000">
              Reports & Analytics
            </h2>
            <p className="text-sm md:text-base text-muted-foreground font-heading animate-in slide-in-from-left-4 duration-1000 delay-200">
              Comprehensive analytics dashboard • Real-time insights • Performance metrics
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={dateRange}
              onValueChange={(v: DateRange) => setDateRange(v)}
            >
              <SelectTrigger className="w-[150px] font-heading text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_TIME">All Time</SelectItem>
                <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
            {canExportExcel && (
              <Button
                type="button"
                variant="outline"
                className="font-heading gap-2 border-primary/40 bg-card hover:bg-primary/10"
                disabled={exporting || analyticsLoading}
                onClick={handleExportExcel}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 text-primary" />
                )}
                {language === 'fr' ? 'Exporter Excel' : 'Export Excel'}
              </Button>
            )}
          </div>
        </div>

        {/* Selected Event Info */}
        {selectedEvent && (
          <div className="bg-card rounded-xl p-4 border border-border/50 animate-in slide-in-from-bottom-4 fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-heading font-semibold">{selectedEvent.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDateDMY(selectedEvent.date, language)} • {selectedEvent.venue}, {selectedEvent.city}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date Range Label */}
      {analyticsData && (
        <div className="text-sm text-muted-foreground font-heading animate-in slide-in-from-bottom-4 fade-in">
          Showing data for: <span className="font-semibold text-foreground">{analyticsData.dateRangeLabel}</span>
        </div>
      )}

      {/* Error State */}
      {analyticsError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 animate-in slide-in-from-bottom-4 fade-in">
          <p className="text-sm font-heading text-destructive">
            Failed to load analytics data. Please try again.
          </p>
        </div>
      )}

      {/* Global KPI Section */}
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300">
        <KPICards
          data={analyticsData ? {
            pendingCashAndApprovalOrders: analyticsData.pendingCashAndApprovalOrders,
            pendingCashAndApprovalPasses: analyticsData.pendingCashAndApprovalPasses,
            pendingCashAndApprovalRevenue: analyticsData.pendingCashAndApprovalRevenue,
            totalTicketsSold: analyticsData.totalTicketsSold,
            totalRevenue: analyticsData.totalRevenue,
            totalOrders: analyticsData.totalOrders,
            orderCompletionRate: analyticsData.orderCompletionRate,
            averageTicketsPerDay: analyticsData.averageTicketsPerDay,
            ambassadorsInvolved: analyticsData.ambassadorsInvolved,
            trends: analyticsData.trends
          } : null}
          loading={analyticsLoading}
          error={analyticsError ? true : false}
        />
      </div>

      {/* Insights Section */}
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400">
        <Insights
          data={analyticsData?.insights || null}
          loading={analyticsLoading}
        />
      </div>

      {/* Sales Over Time */}
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500">
        <SalesOverTime
          data={analyticsData?.salesOverTime || null}
          loading={analyticsLoading}
        />
      </div>

      {/* Pass Performance */}
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600">
        <PassPerformance
          data={analyticsData?.passPerformance || null}
          loading={analyticsLoading}
        />
      </div>

      {/* Sales Channel Breakdown */}
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-700">
        <SalesChannelBreakdown
          data={analyticsData?.channelBreakdown || null}
          loading={analyticsLoading}
          language={language}
        />
      </div>
    </div>
  );
}
