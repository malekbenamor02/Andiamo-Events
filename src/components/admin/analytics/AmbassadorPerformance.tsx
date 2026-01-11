/**
 * Ambassador Performance Table Component
 * Table showing ambassador sales metrics with sorting and filtering
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AmbassadorPerformanceProps {
  data: Array<{
    ambassadorId: string;
    ambassadorName: string;
    ordersCount: number;
    ticketsSold: number;
    revenue: number;
    conversionRate: number;
  }> | null;
  loading: boolean;
}

type SortField = 'name' | 'orders' | 'tickets' | 'revenue' | 'conversion';
type SortDirection = 'asc' | 'desc';

export function AmbassadorPerformance({ data, loading }: AmbassadorPerformanceProps) {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    if (!data) return [];
    
    return [...data].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;
      
      switch (sortField) {
        case 'name':
          aValue = a.ambassadorName.toLowerCase();
          bValue = b.ambassadorName.toLowerCase();
          break;
        case 'orders':
          aValue = a.ordersCount;
          bValue = b.ordersCount;
          break;
        case 'tickets':
          aValue = a.ticketsSold;
          bValue = b.ticketsSold;
          break;
        case 'revenue':
          aValue = a.revenue;
          bValue = b.revenue;
          break;
        case 'conversion':
          aValue = a.conversionRate;
          bValue = b.conversionRate;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortField === field;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 -ml-3"
        onClick={() => handleSort(field)}
      >
        {children}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="ml-2 h-3 w-3" />
          ) : (
            <ArrowDown className="ml-2 h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
        )}
      </Button>
    );
  };

  if (loading) {
    return (
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card rounded-2xl border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Ambassador Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No ambassador data available</p>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...data.map(a => a.revenue));

  return (
    <Card className="bg-card rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in">
      <CardHeader>
        <CardTitle className="text-xl font-heading font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Ambassador Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton field="name">Ambassador Name</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="orders">Orders</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="tickets">Tickets Sold</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="revenue">Revenue</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="conversion">Conversion Rate</SortButton>
                </TableHead>
                <TableHead className="w-[200px]">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((ambassador, index) => {
                const revenuePercentage = maxRevenue > 0 ? (ambassador.revenue / maxRevenue) * 100 : 0;
                return (
                  <TableRow
                    key={ambassador.ambassadorId}
                    className="animate-in slide-in-from-left-4 fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell className="font-medium">{ambassador.ambassadorName}</TableCell>
                    <TableCell className="text-right">{ambassador.ordersCount}</TableCell>
                    <TableCell className="text-right">{ambassador.ticketsSold.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {ambassador.revenue.toLocaleString()} TND
                    </TableCell>
                    <TableCell className="text-right">
                      {ambassador.conversionRate > 0 ? (
                        <span className="font-semibold">{ambassador.conversionRate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Progress value={revenuePercentage} className="h-2" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
