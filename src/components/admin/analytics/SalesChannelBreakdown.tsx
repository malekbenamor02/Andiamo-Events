/**
 * Sales Channel Breakdown Component
 * Donut chart showing revenue breakdown by payment method
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CreditCard } from 'lucide-react';
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

const COLORS = {
  online: '#10b981',
  ambassadorCash: 'hsl(var(--primary))',
  pos: '#8b5cf6',
  manual: '#f59e0b',
  other: '#6b7280',
};

type ChartRow = {
  name: string;
  value: number;
  color: string;
  /** When set, pie tooltip shows fee-inclusive vs subtotal breakdown. */
  onlineFeeDetail?: { withFees: number; subtotal: number };
};

export function SalesChannelBreakdown({ data, loading, language = 'en' }: SalesChannelBreakdownProps) {
  const t =
    language === 'fr'
      ? {
          title: 'Répartition par canal',
          empty: 'Aucune donnée de vente',
          centerTotal: 'Total TND',
          pctOfTotal: 'du total',
          withFees: 'Avec frais (encaissé)',
          withoutFees: 'Sans frais (lignes)',
          fees: 'Frais',
          hoverOnlineTitle: 'Paiement en ligne',
          hoverOnlineHint:
            'Le graphique utilise le montant avec frais. Survolez la ligne « Paiement en ligne » pour le détail.',
        }
      : {
          title: 'Sales Channel Breakdown',
          empty: 'No sales data available',
          centerTotal: 'TND Total',
          pctOfTotal: 'of total',
          withFees: 'With fees (collected)',
          withoutFees: 'Without fees (line items)',
          fees: 'Fees',
          hoverOnlineTitle: 'Online payments',
          hoverOnlineHint:
            'The chart uses fee-inclusive amounts. Hover the Online row below for subtotal vs fees.',
        };

  if (loading) {
    return (
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">{t.empty}</p>
        </CardContent>
      </Card>
    );
  }

  const posValue = data.pos ?? 0;
  const onlineSub = data.onlineSubtotal ?? 0;
  const onlineRow: ChartRow = {
    name: language === 'fr' ? 'Paiement en ligne' : 'Online Payments',
    value: data.online,
    color: COLORS.online,
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
      name: language === 'fr' ? 'Ventes Ambassadeurs' : 'Ambassador Sales',
      value: data.ambassadorCash,
      color: COLORS.ambassadorCash,
    },
    {
      name: language === 'fr' ? 'Point de Vente' : 'Point de Vente (POS)',
      value: posValue,
      color: COLORS.pos,
    },
    {
      name: language === 'fr' ? 'Manuel/Admin' : 'Manual/Admin',
      value: data.manual,
      color: COLORS.manual,
    },
    ...(data.other > 0
      ? [{ name: language === 'fr' ? 'Autre' : 'Other', value: data.other, color: COLORS.other }]
      : []),
  ].filter((item) => item.value > 0);

  const totalForTooltip = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as ChartRow;
    const value = row.value as number;
    const pct = totalForTooltip > 0 ? ((value / totalForTooltip) * 100).toFixed(1) : '0';
    const detail = row.onlineFeeDetail;
    const feePart =
      detail && detail.withFees > detail.subtotal
        ? detail.withFees - detail.subtotal
        : detail && detail.withFees === detail.subtotal
          ? 0
          : null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl min-w-[180px] z-50">
        <p className="text-sm font-semibold text-foreground mb-1.5">{row.name}</p>
        {detail && row.name === onlineRow.name ? (
          <>
            <p className="text-xs text-muted-foreground">{t.withFees}</p>
            <p className="text-sm font-medium text-foreground">{detail.withFees.toLocaleString()} TND</p>
            <p className="text-xs text-muted-foreground mt-2">{t.withoutFees}</p>
            <p className="text-sm font-medium text-foreground">{detail.subtotal.toLocaleString()} TND</p>
            {feePart != null && feePart > 0.005 && (
              <>
                <p className="text-xs text-muted-foreground mt-2">{t.fees}</p>
                <p className="text-sm font-medium text-foreground">{feePart.toFixed(2)} TND</p>
              </>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-foreground">{value.toLocaleString()} TND</p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          {pct}% {t.pctOfTotal}
        </p>
      </div>
    );
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-sm font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in">
        <CardHeader>
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {t.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-heading">{t.hoverOnlineHint}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="relative w-64 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomLabel}
                    outerRadius={100}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    offset={50}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 50, outline: 'none' }}
                    contentStyle={{ outline: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-heading font-bold text-primary">{data.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground font-heading">{t.centerTotal}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {chartData.map((item, index) => {
                const percentage = ((item.value / data.total) * 100).toFixed(1);
                const isOnline = item.name === onlineRow.name && item.onlineFeeDetail;
                const inner = (
                  <div
                    className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors animate-in slide-in-from-right-4 fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-heading font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-heading font-semibold">{item.value.toLocaleString()} TND</p>
                      <p className="text-xs text-muted-foreground">{percentage}%</p>
                    </div>
                  </div>
                );

                return (
                  <div key={index}>
                    {isOnline ? (
                      <UiTooltip>
                        <TooltipTrigger asChild>{inner}</TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="font-semibold text-sm mb-1">{t.hoverOnlineTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.withFees}:{' '}
                            <span className="text-foreground font-medium">
                              {item.onlineFeeDetail!.withFees.toLocaleString()} TND
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t.withoutFees}:{' '}
                            <span className="text-foreground font-medium">
                              {item.onlineFeeDetail!.subtotal.toLocaleString()} TND
                            </span>
                          </p>
                          {item.onlineFeeDetail!.withFees - item.onlineFeeDetail!.subtotal > 0.005 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.fees}:{' '}
                              <span className="text-foreground font-medium">
                                {(item.onlineFeeDetail!.withFees - item.onlineFeeDetail!.subtotal).toFixed(2)} TND
                              </span>
                            </p>
                          )}
                        </TooltipContent>
                      </UiTooltip>
                    ) : (
                      inner
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
