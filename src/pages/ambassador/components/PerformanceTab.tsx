/**
 * Ambassador Dashboard — Performance tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, TrendingUp, XCircle, AlertCircle, DollarSign } from "lucide-react";
import type { AmbassadorTranslations, PerformanceData } from "../types";
import { cn } from "@/lib/utils";

export interface PerformanceTabProps {
  language: "en" | "fr";
  t: AmbassadorTranslations;
  performance: PerformanceData | null;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  barWidth: number;
  barClass: string;
}

function StatCard({ title, value, subtitle, icon, barWidth, barClass }: StatCardProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barClass)}
            style={{ width: `${Math.min(barWidth, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceTab({ language, t, performance }: PerformanceTabProps) {
  if (!performance) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="py-14">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {language === "en"
                ? "Loading performance data..."
                : "Chargement des données de performance..."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const revenue = parseFloat(String(performance.totalRevenue)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="space-y-1 border-b border-border px-4 py-4 sm:px-6">
        <CardTitle className="text-lg font-semibold tracking-tight sm:text-xl">
          {t.performance}
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {language === "en"
            ? "Your stats across all assigned orders."
            : "Vos statistiques sur toutes les commandes assignées."}
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2">
          <StatCard
            title={t.completionRate}
            value={`${performance.completionRate}%`}
            subtitle={`${performance.paid} / ${performance.total} ${
              language === "en" ? "paid" : "payées"
            }`}
            icon={<TrendingUp className="h-4 w-4 shrink-0" aria-hidden />}
            barWidth={parseFloat(performance.completionRate) || 0}
            barClass="bg-emerald-600"
          />
          <StatCard
            title={t.cancellationRate}
            value={`${performance.cancellationRate}%`}
            subtitle={`${performance.cancelled} ${
              language === "en" ? "cancelled orders" : "commandes annulées"
            }`}
            icon={<XCircle className="h-4 w-4 shrink-0" aria-hidden />}
            barWidth={parseFloat(performance.cancellationRate) || 0}
            barClass="bg-destructive"
          />
          <StatCard
            title={t.rejectionRate}
            value={`${performance.rejectionRate}%`}
            subtitle={`${performance.rejected} ${
              language === "en" ? "rejected orders" : "commandes rejetées"
            }`}
            icon={<AlertCircle className="h-4 w-4 shrink-0" aria-hidden />}
            barWidth={parseFloat(performance.rejectionRate) || 0}
            barClass="bg-orange-500"
          />
          <StatCard
            title={t.totalRevenue}
            value={revenue}
            subtitle={`TND · ${language === "en" ? "total revenue" : "revenu total"}`}
            icon={<DollarSign className="h-4 w-4 shrink-0" aria-hidden />}
            barWidth={100}
            barClass="bg-emerald-600/60"
          />
        </div>
      </CardContent>
    </Card>
  );
}
