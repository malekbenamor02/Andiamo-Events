/**
 * Ambassador Dashboard — Performance tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, TrendingUp, XCircle, AlertCircle, DollarSign } from "lucide-react";
import type { AmbassadorTranslations, PerformanceData } from "../types";

export interface PerformanceTabProps {
  language: "en" | "fr";
  t: AmbassadorTranslations;
  performance: PerformanceData | null;
}

export function PerformanceTab({ language, t, performance }: PerformanceTabProps) {
  if (!performance) {
    return (
      <Card className="border-border/50 shadow-lg shadow-primary/5">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <p className="text-center text-muted-foreground font-medium">
              {language === "en"
                ? "Loading performance data..."
                : "Chargement des données de performance..."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:from-emerald-500/15 hover:via-emerald-500/10 transition-all duration-300 shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
            <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            {t.completionRate}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent mb-2">
            {performance.completionRate}%
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
            {performance.paid} / {performance.total}{" "}
            {language === "en" ? "paid" : "payées"}
          </p>
          <div className="mt-3 h-1.5 bg-emerald-500/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(parseFloat(performance.completionRate) || 0, 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent hover:from-red-500/15 hover:via-red-500/10 transition-all duration-300 shadow-lg shadow-red-500/10 hover:shadow-xl hover:shadow-red-500/20 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
            <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            {t.cancellationRate}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent mb-2">
            {performance.cancellationRate}%
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
            {performance.cancelled}{" "}
            {language === "en" ? "cancelled orders" : "commandes annulées"}
          </p>
          <div className="mt-3 h-1.5 bg-red-500/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-400 to-red-300 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(parseFloat(performance.cancellationRate) || 0, 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent hover:from-orange-500/15 hover:via-orange-500/10 transition-all duration-300 shadow-lg shadow-orange-500/10 hover:shadow-xl hover:shadow-orange-500/20 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
            <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors">
              <AlertCircle className="w-4 h-4 text-orange-400" />
            </div>
            {t.rejectionRate}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 to-orange-300 bg-clip-text text-transparent mb-2">
            {performance.rejectionRate}%
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
            {performance.rejected}{" "}
            {language === "en" ? "rejected orders" : "commandes rejetées"}
          </p>
          <div className="mt-3 h-1.5 bg-orange-500/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-300 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(parseFloat(performance.rejectionRate) || 0, 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent hover:from-green-500/15 hover:via-green-500/10 transition-all duration-300 shadow-lg shadow-green-500/10 hover:shadow-xl hover:shadow-green-500/20 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
            <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            {t.totalRevenue}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent mb-2">
            {parseFloat(String(performance.totalRevenue)).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
            TND {language === "en" ? "total revenue" : "revenu total"}
          </p>
          <div className="mt-3 flex items-center gap-1 text-green-400/60">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-medium">
              {language === "en" ? "All time" : "Tout le temps"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 hover:from-primary/25 hover:via-primary/15 transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/15 transition-colors" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-sm sm:text-base font-semibold text-muted-foreground">
            <div className="p-2 rounded-lg bg-primary/30 group-hover:bg-primary/40 transition-colors">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            {t.commissionEarned}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent mb-2">
            {(performance.commission || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground/80 font-medium">
            {language === "en"
              ? `${performance.totalPassesSold || 0} ${(performance.totalPassesSold || 0) === 1 ? "pass sold" : "passes sold"}`
              : `${performance.totalPassesSold || 0} ${(performance.totalPassesSold || 0) === 1 ? "pass vendu" : "passes vendus"}`}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">
                {language === "en" ? "Base (passes 8+)" : "Base (passes 8+)"}:
              </span>
              <span className="font-semibold text-primary">
                {(performance.baseCommission || 0).toFixed(0)} DT
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">
                {language === "en" ? "Bonuses" : "Bonus"}:
              </span>
              <span className="font-semibold text-primary">
                +{(performance.totalBonuses || 0).toFixed(0)} DT
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
