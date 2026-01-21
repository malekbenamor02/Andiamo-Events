/**
 * Pass Performance Chart Component
 * Bar charts showing tickets sold and revenue per pass type
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PassPerformanceProps {
  data: Array<{
    passName: string;
    ticketsSold: number;
    revenue: number;
  }> | null;
  loading: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316'
];

export function PassPerformance({ data, loading }: PassPerformanceProps) {
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
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Pass Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No pass data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item, index) => ({
    name: item.passName,
    tickets: item.ticketsSold,
    revenue: item.revenue,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg p-3 shadow-lg text-white">
          <p className="text-sm font-semibold mb-2 text-white">{payload[0].payload.name}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'tickets' ? 'Tickets Sold' : 'Revenue'}: {entry.name === 'tickets'
                ? entry.value.toLocaleString()
                : `${entry.value.toLocaleString()} TND`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const tooltipStyle = { background: '#1F1F1F', border: '1px solid #2A2A2A', borderRadius: 8 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Tickets Sold Chart */}
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-left-4 fade-in">
        <CardHeader>
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Tickets Sold per Pass
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip content={<CustomTooltip />} contentStyle={tooltipStyle} wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }} cursor={false} />
                <Bar 
                  dataKey="tickets" 
                  fill="hsl(var(--primary))"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-right-4 fade-in">
        <CardHeader>
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            Revenue per Pass
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip content={<CustomTooltip />} contentStyle={tooltipStyle} wrapperStyle={{ outline: 'none', backgroundColor: 'transparent' }} cursor={false} />
                <Bar 
                  dataKey="revenue" 
                  fill="#f97316"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
