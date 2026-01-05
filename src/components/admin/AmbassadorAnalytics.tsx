/**
 * AmbassadorAnalytics Component
 * Displays analytics charts and trends for ambassador sales
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AmbassadorAnalytics as AnalyticsData } from '@/types/orders';
import { BarChart3, TrendingUp, MapPin, PieChart, Clock } from 'lucide-react';

interface AmbassadorAnalyticsProps {
  data?: AnalyticsData;
  language?: 'en' | 'fr';
}

export function AmbassadorAnalytics({ data, language = 'en' }: AmbassadorAnalyticsProps) {
  const t = language === 'en' ? {
    ordersOverTime: 'Orders Over Time',
    revenueTrends: 'Revenue Trends',
    cityDistribution: 'City Distribution',
    statusBreakdown: 'Status Breakdown',
    paymentMethodBreakdown: 'Payment Method Breakdown',
    conversionRate: 'Conversion Rate',
    cancellationRate: 'Cancellation Rate',
    averageTimePayment: 'Average Time to Payment',
    noData: 'No analytics data available'
  } : {
    ordersOverTime: 'Commandes dans le Temps',
    revenueTrends: 'Tendances des Revenus',
    cityDistribution: 'Répartition par Ville',
    statusBreakdown: 'Répartition par Statut',
    paymentMethodBreakdown: 'Répartition par Mode de Paiement',
    conversionRate: 'Taux de Conversion',
    cancellationRate: 'Taux d\'Annulation',
    averageTimePayment: 'Temps Moyen jusqu\'au Paiement',
    noData: 'Aucune donnée analytique disponible'
  };

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t.noData}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversion Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.conversionRate}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.conversionRate * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.cancellationRate}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(data.cancellationRate * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.averageTimePayment}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.averageTimePayment}</div>
          </CardContent>
        </Card>
      </div>

      {/* City Distribution */}
      {data.cityDistribution && data.cityDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>{t.cityDistribution}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.cityDistribution.map((city, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{city.city}</span>
                  <span className="text-muted-foreground">{city.count} {language === 'en' ? 'orders' : 'commandes'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Breakdown */}
      {data.statusBreakdown && data.statusBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="w-5 h-5" />
              <span>{t.statusBreakdown}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.statusBreakdown.map((status, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{status.status}</span>
                  <span className="text-muted-foreground">{status.count} {language === 'en' ? 'orders' : 'commandes'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Method Breakdown */}
      {data.paymentMethodBreakdown && data.paymentMethodBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>{t.paymentMethodBreakdown}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.paymentMethodBreakdown.map((method, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{method.method}</span>
                  <span className="text-muted-foreground">{method.count} {language === 'en' ? 'orders' : 'commandes'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

