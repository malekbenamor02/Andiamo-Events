/**
 * Insights Section Component
 * Small insight cards showing key metrics
 */

import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, TrendingDown, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface InsightsProps {
  data: {
    bestSellingDay: string;
    peakSalesHour: string;
    lowestSalesPeriod: string;
    highestPerformingPass: string;
  } | null;
  loading: boolean;
}

interface InsightCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  delay: number;
}

function InsightCard({ title, value, icon, color, delay }: InsightCardProps) {
  return (
    <Card
      className={`bg-card rounded-xl border-border/50 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 animate-in slide-in-from-bottom-4 fade-in`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${color}/10 rounded-lg flex items-center justify-center`}>
            {icon}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-heading mb-1">{title}</p>
            <p className={`text-lg font-heading font-bold ${color}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCardSkeleton() {
  return (
    <Card className="bg-card rounded-xl border-border/50 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Insights({ data, loading }: InsightsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <InsightCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-muted/20 border border-border rounded-lg p-6 text-center">
        <p className="text-sm font-heading text-muted-foreground">
          Not enough data to generate insights yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <InsightCard
        title="Best Selling Day"
        value={data.bestSellingDay !== 'N/A' ? data.bestSellingDay : 'Not enough data'}
        icon={<Calendar className="w-5 h-5 text-green-500" />}
        color={data.bestSellingDay !== 'N/A' ? 'text-green-500' : 'text-muted-foreground'}
        delay={100}
      />
      <InsightCard
        title="Peak Sales Hour"
        value={data.peakSalesHour !== '0:00' && data.peakSalesHour !== 'N/A' ? data.peakSalesHour : 'Not enough data'}
        icon={<Clock className="w-5 h-5 text-blue-500" />}
        color={data.peakSalesHour !== '0:00' && data.peakSalesHour !== 'N/A' ? 'text-blue-500' : 'text-muted-foreground'}
        delay={200}
      />
      <InsightCard
        title="Lowest Sales Period"
        value={data.lowestSalesPeriod !== 'N/A' ? data.lowestSalesPeriod : 'Not enough data'}
        icon={<TrendingDown className="w-5 h-5 text-orange-500" />}
        color={data.lowestSalesPeriod !== 'N/A' ? 'text-orange-500' : 'text-muted-foreground'}
        delay={300}
      />
      <InsightCard
        title="Top Performing Pass"
        value={data.highestPerformingPass !== 'N/A' ? data.highestPerformingPass : 'Not enough data'}
        icon={<Award className="w-5 h-5 text-purple-500" />}
        color={data.highestPerformingPass !== 'N/A' ? 'text-purple-500' : 'text-muted-foreground'}
        delay={400}
      />
    </div>
  );
}
