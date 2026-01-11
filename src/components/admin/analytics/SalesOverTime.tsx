/**
 * Sales Over Time Chart Component
 * Line/Area chart showing tickets sold and revenue over time
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';

interface SalesOverTimeProps {
  data: Array<{
    date: string;
    tickets: number;
    revenue: number;
  }> | null;
  loading: boolean;
}

export function SalesOverTime({ data, loading }: SalesOverTimeProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    if (period === 'daily') {
      return data.map(item => ({
        date: format(parseISO(item.date), 'MMM dd'),
        fullDate: item.date,
        tickets: item.tickets,
        revenue: item.revenue
      }));
    } else {
      // Group by week
      const weeklyMap = new Map<string, { tickets: number; revenue: number }>();
      
      data.forEach(item => {
        const date = parseISO(item.date);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        const existing = weeklyMap.get(weekKey) || { tickets: 0, revenue: 0 };
        weeklyMap.set(weekKey, {
          tickets: existing.tickets + item.tickets,
          revenue: existing.revenue + item.revenue
        });
      });
      
      return Array.from(weeklyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([weekKey, values]) => ({
          date: format(parseISO(weekKey), 'MMM dd'),
          fullDate: weekKey,
          tickets: values.tickets,
          revenue: values.revenue
        }));
    }
  }, [data, period]);

  if (loading) {
    return (
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Tickets Sold Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">No sales data available for this period</p>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Revenue Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">No sales data available for this period</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-2">{payload[0].payload.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'tickets' ? 'Tickets' : 'Revenue'}: {entry.name === 'tickets' 
                ? entry.value.toLocaleString() 
                : `${entry.value.toLocaleString()} TND`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tickets Sold Chart */}
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 fade-in">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Tickets Sold Over Time
          </CardTitle>
          <Select value={period} onValueChange={(v: 'daily' | 'weekly') => setPeriod(v)}>
            <SelectTrigger className="w-[120px] font-heading text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="tickets"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#ticketsGradient)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-right-4 fade-in">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Revenue Over Time
          </CardTitle>
          <Select value={period} onValueChange={(v: 'daily' | 'weekly') => setPeriod(v)}>
            <SelectTrigger className="w-[120px] font-heading text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
