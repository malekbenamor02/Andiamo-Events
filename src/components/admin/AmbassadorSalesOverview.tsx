/**
 * AmbassadorSalesOverview Component
 * Displays performance metrics and analytics for ambassador sales
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAmbassadorSalesOverview } from '@/hooks/useAmbassadorSales';
import { Loader2 } from 'lucide-react';
import { AmbassadorPerformance } from './AmbassadorPerformance';
import { AmbassadorAnalytics } from './AmbassadorAnalytics';

interface AmbassadorSalesOverviewProps {
  language?: 'en' | 'fr';
}

export function AmbassadorSalesOverview({ language = 'en' }: AmbassadorSalesOverviewProps) {
  const { data: performance, isLoading: loadingPerformance } = useAmbassadorSales('performance');
  const { data: analytics, isLoading: loadingAnalytics } = useAmbassadorSales('analytics');

  const t = language === 'en' ? {
    overview: 'Overview',
    performance: 'Performance',
    analytics: 'Analytics',
    loading: 'Loading...'
  } : {
    overview: 'Vue d\'ensemble',
    performance: 'Performance',
    analytics: 'Analyses',
    loading: 'Chargement...'
  };

  if (loadingPerformance || loadingAnalytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t.overview}</h2>
        <p className="text-muted-foreground">
          {language === 'en' 
            ? 'Performance metrics and analytics for ambassador sales'
            : 'Métriques de performance et analyses des ventes d\'ambassadeurs'}
        </p>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList>
          <TabsTrigger value="performance">{t.performance}</TabsTrigger>
          <TabsTrigger value="analytics">{t.analytics}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-4">
          <AmbassadorPerformance data={performance} language={language} />
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <AmbassadorAnalytics data={analytics} language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

