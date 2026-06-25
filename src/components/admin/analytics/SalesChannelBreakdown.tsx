/**
 * Sales Channel Breakdown Component
 * Donut chart showing revenue breakdown by payment method
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SalesChannelBreakdownData {
  online: number;
  /** Pass line subtotals for paid online orders only (excl. fees). */
  onlineSubtotal?: number;
  ambassadorCash: number;
  pos?: number;
  manual: number;
  other: number;
  total: number;
}

interface SalesChannelBreakdownProps {
  data: SalesChannelBreakdownData | null;
  loading: boolean;
  language?: 'en' | 'fr';
}

const SLICE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--muted-foreground) / 0.55)',
  'hsl(var(--muted-foreground) / 0.35)',
  'hsl(var(--muted-foreground) / 0.2)',
];

type ChartRow = {
  name: string;
  value: number;
  color: string;
  onlineFeeDetail?: { withFees: number; subtotal: number };
};

export function SalesChannelBreakdown({ data, loading, language = 'en' }: SalesChannelBreakdownProps) {
  const t =
    language === 'fr'
      ? {
          title: 'Répartition par canal',
          empty: 'Aucune donnée de vente',
          centerTotal: 'TND total',
          pctOfTotal: 'du total',
          withFees: 'Avec frais (encaissé)',
          withoutFees: 'Sans frais (lignes)',
          fees: 'Frais',
          hoverOnlineTitle: 'Paiement en ligne',
        }
      : {
          title: 'Sales channels',
          empty: 'No sales data available',
          centerTotal: 'TND total',
          pctOfTotal: 'of total',
          withFees: 'With fees (collected)',
          withoutFees: 'Without fees (line items)',
          fees: 'Fees',
          hoverOnlineTitle: 'Online payments',
        };

  if (loading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <Skeleton className="mb-4 h-3 w-28" />
        <Skeleton className="mx-auto h-52 w-52 rounded-full" />
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <section>
        <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t.title}
        </h3>
        <div className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        </div>
      </section>
    );
  }

  const posValue = data.pos ?? 0;
  const onlineSub = data.onlineSubtotal ?? 0;
  const onlineRow: ChartRow = {
    name: language === 'fr' ? 'Paiement en ligne' : 'Online',
    value: data.online,
    color: SLICE_COLORS[0],
    onlineFeeDetail:
      data.online > 0 && onlineSub > 0
        ? { withFees: data.online, subtotal: onlineSub }
        : data.online > 0
          ? { withFees: data.online, subtotal: Math.min(onlineSub, data.online) }
          : undefined,
  };

  const chartData: ChartRow[] = [
    onlineRow,
    {
      name: language === 'fr' ? 'Ambassadeurs' : 'Ambassador',
      value: data.ambassadorCash,
      color: SLICE_COLORS[1],
    },
    {
      name: language === 'fr' ? 'Point de vente' : 'POS',
      value: posValue,
      color: SLICE_COLORS[2],
    },
    {
      name: language === 'fr' ? 'Manuel' : 'Manual',
      value: data.manual,
      color: SLICE_COLORS[3],
    },
    ...(data.other > 0
      ? [{ name: language === 'fr' ? 'Autre' : 'Other', value: data.other, color: SLICE_COLORS[4] }]
      : []),
  ].filter((item) => item.value > 0);

  const totalForTooltip = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const value = row.value;
    const pct = totalForTooltip > 0 ? ((value / totalForTooltip) * 100).toFixed(1) : '0';
    const detail = row.onlineFeeDetail;
    const feePart =
      detail && detail.withFees > detail.subtotal
        ? detail.withFees - detail.subtotal
        : detail && detail.withFees === detail.subtotal
          ? 0
          : null;

    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm min-w-[160px]">
        <p className="mb-1 font-medium text-foreground">{row.name}</p>
        {detail && row.name === onlineRow.name ? (
          <>
            <p className="text-muted-foreground">
              {t.withFees}: {detail.withFees.toLocaleString()} TND
            </p>
            <p className="text-muted-foreground">
              {t.withoutFees}: {detail.subtotal.toLocaleString()} TND
            </p>
            {feePart != null && feePart > 0.005 && (
              <p className="text-muted-foreground">
                {t.fees}: {feePart.toFixed(2)} TND
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">{value.toLocaleString()} TND</p>
        )}
        <p className="mt-1 text-muted-foreground/80">
          {pct}% {t.pctOfTotal}
        </p>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <section>
        <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t.title}
        </h3>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start">
            <div className="relative h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={92}
                    innerRadius={58}
                    dataKey="value"
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    animationDuration={400}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {data.total.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t.centerTotal}</p>
                </div>
              </div>
            </div>

            <div className="w-full min-w-0 flex-1 space-y-1">
              {chartData.map((item, index) => {
                const percentage = ((item.value / data.total) * 100).toFixed(1);
                const isOnline = item.name === onlineRow.name && item.onlineFeeDetail;

                const row = (
                  <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2.5 hover:bg-muted/30">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-sm text-foreground">{item.name}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums font-medium text-foreground">
                        {item.value.toLocaleString()} TND
                      </p>
                      <p className="text-[11px] text-muted-foreground">{percentage}%</p>
                    </div>
                  </div>
                );

                if (isOnline) {
                  return (
                    <UiTooltip key={index}>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        <p className="mb-1 font-medium">{t.hoverOnlineTitle}</p>
                        <p className="text-muted-foreground">
                          {t.withFees}: {item.onlineFeeDetail!.withFees.toLocaleString()} TND
                        </p>
                        <p className="text-muted-foreground">
                          {t.withoutFees}: {item.onlineFeeDetail!.subtotal.toLocaleString()} TND
                        </p>
                        {item.onlineFeeDetail!.withFees - item.onlineFeeDetail!.subtotal > 0.005 && (
                          <p className="text-muted-foreground">
                            {t.fees}:{' '}
                            {(item.onlineFeeDetail!.withFees - item.onlineFeeDetail!.subtotal).toFixed(2)} TND
                          </p>
                        )}
                      </TooltipContent>
                    </UiTooltip>
                  );
                }

                return <div key={index}>{row}</div>;
              })}
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
