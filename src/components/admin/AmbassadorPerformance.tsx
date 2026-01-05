/**
 * AmbassadorPerformance Component
 * Displays key performance metrics for ambassadors
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AmbassadorPerformance as PerformanceData } from '@/types/orders';
import { DollarSign, TrendingUp, Users, Package, Award } from 'lucide-react';

interface AmbassadorPerformanceProps {
  data?: PerformanceData;
  language?: 'en' | 'fr';
}

export function AmbassadorPerformance({ data, language = 'en' }: AmbassadorPerformanceProps) {
  const t = language === 'en' ? {
    totalOrders: 'Total Orders',
    totalRevenue: 'Total Revenue',
    totalCommissions: 'Total Commissions',
    averageOrderValue: 'Average Order Value',
    ordersPerAmbassador: 'Orders per Ambassador',
    topAmbassadors: 'Top Ambassadors',
    name: 'Name',
    orders: 'Orders',
    revenue: 'Revenue'
  } : {
    totalOrders: 'Commandes Totales',
    totalRevenue: 'Revenus Totaux',
    totalCommissions: 'Commissions Totales',
    averageOrderValue: 'Valeur Moyenne des Commandes',
    ordersPerAmbassador: 'Commandes par Ambassadeur',
    topAmbassadors: 'Meilleurs Ambassadeurs',
    name: 'Nom',
    orders: 'Commandes',
    revenue: 'Revenus'
  };

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {language === 'en' ? 'No performance data available' : 'Aucune donnée de performance disponible'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalOrders}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalRevenue}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalRevenue.toFixed(2)} TND</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalCommissions}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalCommissions.toFixed(2)} TND</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.averageOrderValue}</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.averageOrderValue.toFixed(2)} TND</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.ordersPerAmbassador.toFixed(1)} {language === 'en' ? 'orders/ambassador' : 'commandes/ambassadeur'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Ambassadors */}
      {data.topAmbassadors && data.topAmbassadors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.topAmbassadors}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topAmbassadors.map((ambassador, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{ambassador.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ambassador.orders} {t.orders.toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{ambassador.revenue.toFixed(2)} TND</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

