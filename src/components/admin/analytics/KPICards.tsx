/**
 * KPI Cards Component
 * KPI metrics for Reports & Analytics
 */

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface KPICardsProps {
  data: {
    pendingCashAndApprovalOrders: number;
    pendingCashAndApprovalPasses: number;
    pendingCashAndApprovalRevenue: number;
    totalTicketsSold: number;
    totalRevenue: number;
    totalOrders: number;
    presalePaidTickets: number;
    presalePaidBreakdown: {
      online: { orders: number; tickets: number };
      cod: { orders: number; tickets: number };
    };
    averageTicketsPerDay: number;
    ambassadorsInvolved: number;
    trends: {
      tickets: number | null;
      revenue: number | null;
      orders: number | null;
      presaleTickets: number | null;
      avgTickets: number | null;
      ambassadors: number | null;
    };
  } | null;
  loading: boolean;
  error?: boolean;
  language?: 'en' | 'fr';
}

interface MetricCardProps {
  label: string | React.ReactNode;
  value: number;
  suffix?: string;
  trend?: number | null;
  className?: string;
  accent?: 'amber' | 'green' | 'primary' | 'violet' | 'neutral';
}

const accentClasses = {
  amber: { border: 'border-l-amber-500', value: 'text-amber-500' },
  green: { border: 'border-l-emerald-500', value: 'text-emerald-500' },
  primary: { border: 'border-l-primary', value: 'text-primary' },
  violet: { border: 'border-l-violet-500', value: 'text-violet-500' },
  neutral: { border: 'border-l-border', value: 'text-foreground' },
} as const;

function formatMetricValue(val: number, suffix: string) {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  if (suffix.includes('TND')) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return val.toLocaleString();
}

function MetricCard({ label, value, suffix = '', trend, className, accent = 'neutral' }: MetricCardProps) {
  const styles = accentClasses[accent];
  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 border-l-[3px] bg-card px-4 py-3.5',
        styles.border,
        className,
      )}
    >
      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', styles.value)}>
          {formatMetricValue(value, suffix)}
          {suffix}
        </p>
        {trend != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend >= 0 ? 'text-emerald-500' : 'text-destructive',
            )}
          >
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3.5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2.5 h-7 w-20" />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function presaleKpiCopy(language: 'en' | 'fr') {
  if (language === 'fr') {
    return {
      cardTitle: 'Presale',
      cardSubtitle: 'Billets payés (en ligne + COD)',
      breakdownTitle: 'Presale — détail',
      online: 'En ligne',
      cod: 'COD (ambassadeur)',
      ordersLabel: 'commandes',
      ticketsLabel: 'billets',
      tapHint: 'Appuyez pour le détail',
    };
  }
  return {
    cardTitle: 'Presale',
    cardSubtitle: 'Paid tickets (online + COD)',
    breakdownTitle: 'Presale breakdown',
    online: 'Online',
    cod: 'COD (ambassador)',
    ordersLabel: 'orders',
    ticketsLabel: 'tickets',
    tapHint: 'Tap for breakdown',
  };
}

function PresaleTicketsMetricCard({
  totalTickets,
  breakdown,
  trend,
  language,
}: {
  totalTickets: number;
  breakdown: {
    online: { orders: number; tickets: number };
    cod: { orders: number; tickets: number };
  };
  trend: number | null;
  language: 'en' | 'fr';
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const t = presaleKpiCopy(language);

  const breakdownBody = (
    <div className="space-y-3 text-xs">
      <p className="font-medium text-foreground border-b border-border/60 pb-2">{t.breakdownTitle}</p>
      <div className="space-y-2">
        <div>
          <p className="text-muted-foreground mb-0.5">{t.online}</p>
          <p className="text-foreground tabular-nums">
            {breakdown.online.orders.toLocaleString()} {t.ordersLabel} · {breakdown.online.tickets.toLocaleString()}{' '}
            {t.ticketsLabel}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">{t.cod}</p>
          <p className="text-foreground tabular-nums">
            {breakdown.cod.orders.toLocaleString()} {t.ordersLabel} · {breakdown.cod.tickets.toLocaleString()}{' '}
            {t.ticketsLabel}
          </p>
        </div>
      </div>
    </div>
  );

  const labelNode = (
    <span className="inline-flex items-start gap-1">
      <span>
        {t.cardTitle}
        <span className="block text-[11px] font-normal text-muted-foreground/80">{t.cardSubtitle}</span>
      </span>
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
    </span>
  );

  const card = <MetricCard label={labelNode} value={totalTickets} trend={trend} accent="violet" />;

  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background rounded-lg"
            aria-expanded={open}
            aria-label={t.breakdownTitle}
          >
            {card}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,20rem)] p-4" align="center" side="bottom">
          {breakdownBody}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default rounded-lg">{card}</div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-4" side="top">
          {breakdownBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function kpiCopy(language: 'en' | 'fr') {
  if (language === 'fr') {
    return {
      pending: 'En attente',
      sales: 'Ventes',
      activity: 'Activité',
      pendingOrders: 'Commandes cash en attente',
      pendingPasses: 'Pass en attente',
      pendingRevenue: 'Revenus en attente',
      totalTickets: 'Billets vendus',
      totalRevenue: 'Revenus totaux',
      totalOrders: 'Commandes',
      avgTickets: 'Moy. billets / jour',
      ambassadors: 'Ambassadeurs actifs',
      loadError: 'Impossible de charger les données. Actualisez la page.',
      noData: 'Aucune vente pour le moment. Les chiffres apparaîtront ici.',
    };
  }
  return {
    pending: 'Pending',
    sales: 'Sales',
    activity: 'Activity',
    pendingOrders: 'Pending cash orders',
    pendingPasses: 'Pending passes',
    pendingRevenue: 'Pending revenue',
    totalTickets: 'Tickets sold',
    totalRevenue: 'Total revenue',
    totalOrders: 'Orders',
    avgTickets: 'Avg tickets / day',
    ambassadors: 'Active ambassadors',
    loadError: 'Unable to load analytics data. Please refresh the page.',
    noData: 'No sales yet. Numbers will appear here once orders are placed.',
  };
}

export function KPICards({ data, loading, error, language = 'en' }: KPICardsProps) {
  const t = kpiCopy(language);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((section) => (
          <div key={section}>
            <Skeleton className="mb-2.5 h-3 w-16" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <MetricCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{t.loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t.noData}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading>{t.pending}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label={t.pendingOrders} value={data.pendingCashAndApprovalOrders} accent="amber" />
          <MetricCard label={t.pendingPasses} value={data.pendingCashAndApprovalPasses} accent="amber" />
          <MetricCard label={t.pendingRevenue} value={data.pendingCashAndApprovalRevenue} suffix=" TND" accent="amber" />
        </div>
      </section>

      <section>
        <SectionHeading>{t.sales}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label={t.totalTickets} value={data.totalTicketsSold} trend={data.trends.tickets} accent="green" />
          <MetricCard label={t.totalRevenue} value={data.totalRevenue} suffix=" TND" trend={data.trends.revenue} accent="primary" />
          <MetricCard label={t.totalOrders} value={data.totalOrders} trend={data.trends.orders} accent="primary" />
          <PresaleTicketsMetricCard
            totalTickets={data.presalePaidTickets}
            breakdown={data.presalePaidBreakdown}
            trend={data.trends.presaleTickets}
            language={language}
          />
        </div>
      </section>

      <section>
        <SectionHeading>{t.activity}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label={t.avgTickets}
            value={Math.round(data.averageTicketsPerDay)}
            trend={data.trends.avgTickets}
            accent="green"
          />
          <MetricCard
            label={t.ambassadors}
            value={data.ambassadorsInvolved}
            trend={data.trends.ambassadors}
            accent="violet"
          />
        </div>
      </section>
    </div>
  );
}
