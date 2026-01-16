/**
 * KPI Cards Component
 * Displays animated KPI metrics with count-up animations
 */

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Ticket, DollarSign, ShoppingCart, Target, Calendar, Users, Info, Clock, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KPICardsProps {
  data: {
    pendingCashAndApprovalOrders: number;
    pendingCashAndApprovalPasses: number;
    pendingCashAndApprovalRevenue: number;
    totalTicketsSold: number;
    totalRevenue: number;
    totalOrders: number;
    orderCompletionRate: number;
    averageTicketsPerDay: number;
    ambassadorsInvolved: number;
    trends: {
      tickets: number | null;
      revenue: number | null;
      orders: number | null;
      completionRate: number | null;
      avgTickets: number | null;
      ambassadors: number | null;
    };
  } | null;
  loading: boolean;
  error?: boolean;
}

interface KPICardProps {
  title: string | React.ReactNode;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  trend?: number | null;
  color: string;
  delay: number;
}

function KPICard({ title, value, suffix = '', icon, trend, color, delay }: KPICardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        step++;
        current = Math.min(value, increment * step);
        setDisplayValue(Math.floor(current));

        if (step >= steps) {
          clearInterval(interval);
          setDisplayValue(value);
          setIsAnimating(false);
        }
      }, duration / steps);
    }, delay);

    return () => {
      clearInterval(timer as any);
    };
  }, [value, delay]);

  const formatValue = (val: number) => {
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + 'M';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1) + 'K';
    }
    // For currency values, show up to 2 decimal places
    if (suffix.includes('TND')) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return val.toLocaleString();
  };

  // Map color string to proper background color classes
  const getBgColor = (color: string) => {
    if (color.includes('green')) return 'bg-green-500/10 group-hover:bg-green-500/20';
    if (color.includes('orange')) return 'bg-orange-500/10 group-hover:bg-orange-500/20';
    if (color.includes('blue')) return 'bg-blue-500/10 group-hover:bg-blue-500/20';
    if (color.includes('purple')) return 'bg-purple-500/10 group-hover:bg-purple-500/20';
    if (color.includes('cyan')) return 'bg-cyan-500/10 group-hover:bg-cyan-500/20';
    if (color.includes('pink')) return 'bg-pink-500/10 group-hover:bg-pink-500/20';
    if (color.includes('yellow')) return 'bg-yellow-500/10 group-hover:bg-yellow-500/20';
    if (color.includes('amber')) return 'bg-amber-500/10 group-hover:bg-amber-500/20';
    return 'bg-primary/10 group-hover:bg-primary/20';
  };

  return (
    <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group animate-in slide-in-from-bottom-4 fade-in">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 ${getBgColor(color)} rounded-xl flex items-center justify-center transition-colors`}>
            {icon}
          </div>
          {trend !== undefined && trend !== null && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
          {trend === null && (
            <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <span>N/A</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground font-heading">
            {typeof title === 'string' ? title : title}
          </div>
          <p className={`text-3xl font-heading font-bold ${color}`}>
            {formatValue(displayValue)}{suffix}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function KPICardSkeleton() {
  return (
    <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <Skeleton className="w-16 h-4" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

export function KPICards({ data, loading, error }: KPICardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
        <p className="text-sm font-heading text-destructive">
          Unable to load analytics data. Please refresh the page.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-muted/20 border border-border rounded-lg p-6 text-center">
        <p className="text-sm font-heading text-muted-foreground">
          No data available yet. Sales will appear here once orders are placed.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <KPICard
        title="Pending Cash & Approval Orders"
        value={data.pendingCashAndApprovalOrders}
        icon={<Clock className="w-6 h-6 text-yellow-500" />}
        trend={null}
        color="text-yellow-500"
        delay={100}
      />
      <KPICard
        title="Pending Cash & Approval Passes"
        value={data.pendingCashAndApprovalPasses}
        icon={<Package className="w-6 h-6 text-amber-500" />}
        trend={null}
        color="text-amber-500"
        delay={150}
      />
      <KPICard
        title="Pending Cash & Approval Revenue"
        value={data.pendingCashAndApprovalRevenue}
        suffix=" TND"
        icon={<DollarSign className="w-6 h-6 text-orange-600" />}
        trend={null}
        color="text-orange-600"
        delay={200}
      />
      <KPICard
        title="Total Tickets Sold"
        value={data.totalTicketsSold}
        icon={<Ticket className="w-6 h-6 text-green-500" />}
        trend={data.trends.tickets}
        color="text-green-500"
        delay={250}
      />
      <KPICard
        title="Total Revenue"
        value={data.totalRevenue}
        suffix=" TND"
        icon={<DollarSign className="w-6 h-6 text-orange-500" />}
        trend={data.trends.revenue}
        color="text-orange-500"
        delay={300}
      />
      <KPICard
        title="Total Orders"
        value={data.totalOrders}
        icon={<ShoppingCart className="w-6 h-6 text-blue-500" />}
        trend={data.trends.orders}
        color="text-blue-500"
        delay={350}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              <KPICard
                title={
                  <span className="flex items-center gap-1">
                    Order Completion Rate
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </span>
                }
                value={data.orderCompletionRate}
                suffix="%"
                icon={<Target className="w-6 h-6 text-purple-500" />}
                trend={data.trends.completionRate}
                color="text-purple-500"
                delay={400}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              Percentage of orders that were completed (paid) out of all orders created.
              <br />
              <span className="text-muted-foreground">Formula: (Paid Orders / Total Orders Created) × 100</span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <KPICard
        title="Avg Tickets Per Day"
        value={Math.round(data.averageTicketsPerDay)}
        icon={<Calendar className="w-6 h-6 text-cyan-500" />}
        trend={data.trends.avgTickets}
        color="text-cyan-500"
        delay={450}
      />
      <KPICard
        title="Ambassadors Involved"
        value={data.ambassadorsInvolved}
        icon={<Users className="w-6 h-6 text-pink-500" />}
        trend={data.trends.ambassadors}
        color="text-pink-500"
        delay={500}
      />
    </div>
  );
}
