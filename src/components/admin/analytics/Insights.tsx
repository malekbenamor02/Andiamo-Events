/**
 * Insights Section Component
 * Compact insight strip for key analytics highlights
 */

import { Skeleton } from '@/components/ui/skeleton';

interface InsightsProps {
  data: {
    bestSellingDay: string;
    peakSalesHour: string;
    lowestSalesPeriod: string;
    highestPerformingPass: string;
  } | null;
  loading: boolean;
  language?: 'en' | 'fr';
}

function copy(language: 'en' | 'fr') {
  if (language === 'fr') {
    return {
      title: 'Points clés',
      bestDay: 'Meilleur jour',
      peakHour: 'Heure de pointe',
      slowPeriod: 'Période la plus calme',
      topPass: 'Pass le plus vendu',
      noData: 'Pas assez de données',
      empty: 'Pas assez de données pour générer des insights.',
    };
  }
  return {
    title: 'Highlights',
    bestDay: 'Best day',
    peakHour: 'Peak hour',
    slowPeriod: 'Slowest period',
    topPass: 'Top pass',
    noData: 'Not enough data',
    empty: 'Not enough data to generate insights yet.',
  };
}

function InsightRow({ label, value }: { label: string; value: string }) {
  const hasData = value !== 'Not enough data' && value !== 'Pas assez de données';

  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-border/60 px-4 py-3 sm:border-r sm:last:border-r-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={hasData ? 'truncate text-sm font-medium text-foreground' : 'text-sm text-muted-foreground'}>
        {value}
      </p>
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
      <Skeleton className="mb-3 h-3 w-20" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Insights({ data, loading, language = 'en' }: InsightsProps) {
  const t = copy(language);

  if (loading) return <InsightSkeleton />;

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  const fmt = (raw: string, skipValues: string[]) =>
    skipValues.includes(raw) ? t.noData : raw;

  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {t.title}
      </h3>
      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-4 sm:divide-x sm:divide-border/60">
          <InsightRow
            label={t.bestDay}
            value={fmt(data.bestSellingDay, ['N/A'])}
          />
          <InsightRow
            label={t.peakHour}
            value={fmt(data.peakSalesHour, ['0:00', 'N/A'])}
          />
          <InsightRow
            label={t.slowPeriod}
            value={fmt(data.lowestSalesPeriod, ['N/A'])}
          />
          <InsightRow
            label={t.topPass}
            value={fmt(data.highestPerformingPass, ['N/A'])}
          />
        </div>
      </div>
    </section>
  );
}
