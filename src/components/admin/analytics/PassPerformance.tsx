/**
 * Pass Performance Chart Component
 * Bar charts showing tickets sold and revenue per pass type
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface PassPerformanceProps {
  data: Array<{
    passName: string;
    ticketsSold: number;
    revenue: number;
  }> | null;
  loading: boolean;
  language?: 'en' | 'fr';
}

function copy(language: 'en' | 'fr') {
  if (language === 'fr') {
    return {
      title: 'Performance par pass',
      tickets: 'Billets vendus',
      revenue: 'Revenus',
      empty: 'Aucune donnée de pass',
    };
  }
  return {
    title: 'Pass performance',
    tickets: 'Tickets sold',
    revenue: 'Revenue',
    empty: 'No pass data available',
  };
}

function PassChart({
  title,
  dataKey,
  chartData,
}: {
  title: string;
  dataKey: 'tickets' | 'revenue';
  chartData: Array<{ name: string; tickets: number; revenue: number }>;
}) {
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string }; value: number }> }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0];
    return (
      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-foreground">{row.payload.name}</p>
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
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
            <Bar
              dataKey={dataKey}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              animationDuration={400}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PassPerformance({ data, loading, language = 'en' }: PassPerformanceProps) {
  const t = copy(language);

  if (loading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <Skeleton className="mb-4 h-3 w-28" />
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

  const chartData = data.map((item) => ({
    name: item.passName,
    tickets: item.ticketsSold,
    revenue: item.revenue,
  }));

  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {t.title}
      </h3>
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-6 lg:divide-x lg:divide-border/60">
          <PassChart title={t.tickets} dataKey="tickets" chartData={chartData} />
          <div className="lg:pl-6">
            <PassChart title={t.revenue} dataKey="revenue" chartData={chartData} />
          </div>
        </div>
      </div>
    </section>
  );
}
