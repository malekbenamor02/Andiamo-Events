/**
 * Sales Channel Breakdown Component
 * Donut chart showing revenue breakdown by payment method
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SalesChannelBreakdownProps {
  data: {
    online: number;
    ambassadorCash: number;
    manual: number;
    other: number;
    total: number;
  } | null;
  loading: boolean;
}

const COLORS = {
  online: '#10b981',
  ambassadorCash: 'hsl(var(--primary))',
  manual: '#f59e0b'
};

export function SalesChannelBreakdown({ data, loading }: SalesChannelBreakdownProps) {
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
            Sales Channel Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No sales data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: 'Online Payments', value: data.online, color: COLORS.online },
    { name: 'Ambassador Sales', value: data.ambassadorCash, color: COLORS.ambassadorCash },
    { name: 'Manual/Admin', value: data.manual, color: COLORS.manual },
    ...(data.other > 0 ? [{ name: 'Other', value: data.other, color: '#6b7280' }] : [])
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / chartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-1">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value.toLocaleString()} TND ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
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
    <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in">
      <CardHeader>
        <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Sales Channel Breakdown
        </CardTitle>
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
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-heading font-bold text-primary">
                  {data.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground font-heading">TND Total</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            {chartData.map((item, index) => {
              const percentage = ((item.value / data.total) * 100).toFixed(1);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors animate-in slide-in-from-right-4 fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-heading font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-heading font-semibold">
                      {item.value.toLocaleString()} TND
                    </p>
                    <p className="text-xs text-muted-foreground">{percentage}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
