/**
 * Sales Over Time Chart Component
 * Line/Area chart showing tickets sold and revenue over time
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, startOfWeek } from 'date-fns';

interface SalesOverTimeProps {
  data: Array<{
    date: string;
    tickets: number;
    revenue: number;
  }> | null;
  loading: boolean;
  language?: 'en' | 'fr';
}

function copy(language: 'en' | 'fr') {
  if (language === 'fr') {
    return {
      title: 'Évolution des ventes',
      tickets: 'Billets',
      revenue: 'Revenus',
      daily: 'Quotidien',
      weekly: 'Hebdomadaire',
      empty: 'Aucune vente sur cette période',
    };
  }
  return {
    title: 'Sales over time',
    tickets: 'Tickets',
    revenue: 'Revenue',
    daily: 'Daily',
    weekly: 'Weekly',
    empty: 'No sales data for this period',
  };
}

function ChartPanel({
  title,
  dataKey,
  stroke,
  fillOpacity,
  chartData,
}: {
  title: string;
  dataKey: 'tickets' | 'revenue';
  stroke: string;
  fillOpacity: number;
  chartData: Array<{ date: string; fullDate: string; tickets: number; revenue: number }>;
}) {
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { fullDate: string }; value: number; name: string }> }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0];
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-foreground">{row.payload.fullDate}</p>
        <p className="text-muted-foreground">
          {dataKey === 'tickets'
            ? `${row.value.toLocaleString()} tickets`
            : `${row.value.toLocaleString()} TND`}
        </p>
      </div>
    );
  };

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-3 text-sm font-medium text-foreground">{title}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={1.5}
              fill={stroke}
              fillOpacity={fillOpacity}
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SalesOverTime({ data, loading, language = 'en' }: SalesOverTimeProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const t = copy(language);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    if (period === 'daily') {
      return data.map((item) => ({
        date: format(parseISO(item.date), 'MMM dd'),
        fullDate: item.date,
        tickets: item.tickets,
        revenue: item.revenue,
      }));
    }

    const weeklyMap = new Map<string, { tickets: number; revenue: number }>();
    data.forEach((item) => {
      const date = parseISO(item.date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      const existing = weeklyMap.get(weekKey) || { tickets: 0, revenue: 0 };
      weeklyMap.set(weekKey, {
        tickets: existing.tickets + item.tickets,
        revenue: existing.revenue + item.revenue,
      });
    });

    return Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekKey, values]) => ({
        date: format(parseISO(weekKey), 'MMM dd'),
        fullDate: weekKey,
        tickets: values.tickets,
        revenue: values.revenue,
      }));
  }, [data, period]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
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

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t.title}
        </h3>
        <Select value={period} onValueChange={(v: 'daily' | 'weekly') => setPeriod(v)}>
          <SelectTrigger className="h-8 w-[7.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t.daily}</SelectItem>
            <SelectItem value="weekly">{t.weekly}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-6 lg:divide-x lg:divide-border/60">
          <ChartPanel
            title={t.tickets}
            dataKey="tickets"
            stroke="hsl(var(--primary))"
            fillOpacity={0.12}
            chartData={chartData}
          />
          <div className="lg:pl-6">
            <ChartPanel
              title={t.revenue}
              dataKey="revenue"
              stroke="#f59e0b"
              fillOpacity={0.12}
              chartData={chartData}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
