/**
 * Admin Dashboard — Overview tab.
 * Extracted from Dashboard.tsx for maintainability.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  Calendar as CalendarIcon,
  MapPin,
  Plus,
  FileText,
  Ticket,
  Target,
  Activity,
  PieChart,
  Eye,
  Pause,
  TrendingDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AmbassadorApplication, Event } from "../types";

export interface OverviewTabProps {
  language: "en" | "fr";
  t: Record<string, string>;
  applications: AmbassadorApplication[];
  pendingApplications: AmbassadorApplication[];
  approvedCount: number;
  events: Event[];
  displayStats: {
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    soldTickets: number;
  };
  pendingAmbassadorOrdersCount: number;
  previousPendingAmbassadorOrdersCount: number | null;
  activityChartData: { name: string; applications: number; orders: number; revenue: number }[];
  animatedCards: Set<number>;
  setActiveTab: (tab: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function OverviewTab({
  language,
  t,
  applications,
  pendingApplications,
  approvedCount,
  events,
  displayStats,
  pendingAmbassadorOrdersCount,
  previousPendingAmbassadorOrdersCount,
  activityChartData,
  animatedCards,
  setActiveTab,
  getStatusBadge,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="animate-in slide-in-from-top-4 fade-in duration-700">
        <Card
          className="shadow-xl"
          style={{
            backgroundColor: "#1F1F1F",
            borderColor: "#2A2A2A",
          }}
        >
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-heading font-bold" style={{ color: "#E21836" }}>
                  {language === "en" ? "Welcome Back!" : "Bon Retour !"}
                </h2>
                <p className="text-lg font-heading" style={{ color: "#B0B0B0" }}>
                  {language === "en"
                    ? "Here's what's happening with your events today"
                    : "Voici ce qui se passe avec vos événements aujourd'hui"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-heading" style={{ color: "#B0B0B0" }}>
                    {language === "en" ? "Total Revenue" : "Revenus Totaux"}
                  </p>
                  <p className="text-lg font-bold font-heading" style={{ color: "#E21836" }}>
                    {displayStats.totalRevenue.toLocaleString()} TND
                  </p>
                </div>
                <div className="h-12 w-px" style={{ backgroundColor: "#2A2A2A" }} />
                <div className="text-right">
                  <p className="text-sm font-heading" style={{ color: "#B0B0B0" }}>
                    {language === "en" ? "Paid Revenue" : "Revenus Payés"}
                  </p>
                  <p className="text-lg font-bold font-heading" style={{ color: "#10B981" }}>
                    {displayStats.paidRevenue.toLocaleString()} TND
                  </p>
                </div>
                <div className="h-12 w-px" style={{ backgroundColor: "#2A2A2A" }} />
                <div className="text-right">
                  <p className="text-sm font-heading" style={{ color: "#B0B0B0" }}>
                    {language === "en" ? "Pending Revenue" : "Revenus en Attente"}
                  </p>
                  <p className="text-lg font-bold font-heading" style={{ color: "#F59E0B" }}>
                    {displayStats.pendingRevenue.toLocaleString()} TND
                  </p>
                </div>
                <div className="h-12 w-px" style={{ backgroundColor: "#2A2A2A" }} />
                <div className="text-right">
                  <p className="text-sm font-heading" style={{ color: "#B0B0B0" }}>
                    {language === "en" ? "Sold Tickets" : "Billets Vendus"}
                  </p>
                  <p className="text-lg font-bold font-heading" style={{ color: "#E21836" }}>
                    {displayStats.soldTickets.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full px-2">
        {/* Pending Applications Card */}
        <Card
          className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
            animatedCards.has(0) ? "animate-in slide-in-from-bottom-4 fade-in duration-700" : "opacity-0 translate-y-8"
          }`}
          style={{ backgroundColor: "#1F1F1F", borderColor: "#2A2A2A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A3A3A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A2A2A";
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(107, 107, 107, 0.2)" }}>
                <Clock className="w-6 h-6" style={{ color: "#6B6B6B" }} />
              </div>
              <div className="flex items-center gap-1 text-xs font-heading">
                <TrendingUp className="w-3 h-3" style={{ color: "#E21836" }} />
                <span style={{ color: "#E21836" }}>+12%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-heading" style={{ color: "#B0B0B0" }}>
                {t.pendingApplications}
              </p>
              <p className="text-3xl font-bold font-heading" style={{ color: "#FFFFFF" }}>
                {pendingApplications.length}
              </p>
              <p className="text-xs font-heading" style={{ color: "#B0B0B0" }}>
                {language === "en" ? "Awaiting review" : "En attente de révision"}
              </p>
            </div>
            <div className="mt-4 h-8 flex items-end gap-1">
              {(() => {
                const barValues = [3, 5, 4, 7, 6, 8, pendingApplications.length];
                const maxValue = Math.max(...barValues, 1);
                return barValues.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-yellow-500/30 rounded-t transition-all duration-300 hover:bg-yellow-500/50"
                    style={{ height: `${(h / maxValue) * 100}%` }}
                  />
                ));
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Approved Applications Card */}
        <Card
          className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
            animatedCards.has(1) ? "animate-in slide-in-from-bottom-4 fade-in duration-700 delay-200" : "opacity-0 translate-y-8"
          }`}
          style={{ backgroundColor: "#1F1F1F", borderColor: "#2A2A2A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A3A3A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A2A2A";
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: "rgba(226, 24, 54, 0.05)" }} />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(226, 24, 54, 0.2)" }}>
                <CheckCircle className="w-6 h-6" style={{ color: "#E21836" }} />
              </div>
              <div className="flex items-center gap-1 text-xs font-heading">
                <TrendingUp className="w-3 h-3" style={{ color: "#E21836" }} />
                <span style={{ color: "#E21836" }}>+8%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-heading">{t.approvedApplications}</p>
              <p className="text-3xl font-bold font-heading text-foreground">{approvedCount}</p>
              <p className="text-xs text-muted-foreground font-heading">
                {language === "en" ? "Active ambassadors" : "Ambassadeurs actifs"}
              </p>
            </div>
            <div className="mt-4 h-8 flex items-end gap-1">
              {[5, 7, 6, 8, 9, 10, approvedCount].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all duration-300"
                  style={{ backgroundColor: "rgba(226, 24, 54, 0.3)", height: `${(h / 15) * 100}%` }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(226, 24, 54, 0.5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(226, 24, 54, 0.3)")}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Events Card */}
        <Card
          className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
            animatedCards.has(2) ? "animate-in slide-in-from-bottom-4 fade-in duration-700 delay-400" : "opacity-0 translate-y-8"
          }`}
          style={{ backgroundColor: "#1F1F1F", borderColor: "#2A2A2A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A3A3A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A2A2A";
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: "rgba(0, 207, 255, 0.05)" }} />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(107, 107, 107, 0.2)" }}>
                <CalendarIcon className="w-6 h-6" style={{ color: "#6B6B6B" }} />
              </div>
              <div className="flex items-center gap-1 text-xs font-heading">
                <TrendingUp className="w-3 h-3" style={{ color: "#E21836" }} />
                <span style={{ color: "#E21836" }}>+15%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-heading">{t.totalEvents}</p>
              <p className="text-3xl font-bold font-heading text-foreground">{events.length}</p>
              <p className="text-xs text-muted-foreground font-heading">
                {language === "en" ? "All time events" : "Événements de tous les temps"}
              </p>
            </div>
            <div className="mt-4 h-8 flex items-end gap-1">
              {[2, 3, 4, 5, 6, 7, events.length].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all duration-300"
                  style={{ backgroundColor: "rgba(0, 207, 255, 0.3)", height: `${(h / 10) * 100}%` }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0, 207, 255, 0.5)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(0, 207, 255, 0.3)")}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ambassador Orders Pending Card */}
        <Card
          className={`group relative overflow-hidden transform transition-all duration-700 ease-out hover:scale-105 hover:shadow-xl ${
            animatedCards.has(3) ? "animate-in slide-in-from-bottom-4 fade-in duration-700 delay-600" : "opacity-0 translate-y-8"
          }`}
          style={{ backgroundColor: "#1F1F1F", borderColor: "#2A2A2A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A3A3A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A2A2A";
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(107, 107, 107, 0.2)" }}>
                <Users className="w-6 h-6" style={{ color: "#6B6B6B" }} />
              </div>
              {previousPendingAmbassadorOrdersCount !== null && previousPendingAmbassadorOrdersCount > 0 ? (
                <div className="flex items-center gap-1 text-xs font-heading">
                  {(() => {
                    const trend =
                      ((pendingAmbassadorOrdersCount - previousPendingAmbassadorOrdersCount) /
                        previousPendingAmbassadorOrdersCount) *
                      100;
                    const isPositive = trend >= 0;
                    return (
                      <>
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" style={{ color: "#E21836" }} />
                        ) : (
                          <TrendingDown className="w-3 h-3" style={{ color: "#E21836" }} />
                        )}
                        <span style={{ color: "#E21836" }}>{isPositive ? "+" : ""}{trend.toFixed(1)}%</span>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs font-heading" style={{ color: "#6B6B6B" }}>
                  <span>—</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-heading">{t.ambassadorOrdersPending}</p>
              <p className="text-3xl font-bold font-heading text-foreground">{pendingAmbassadorOrdersCount}</p>
            </div>
            <div className="mt-4 h-8 flex items-end gap-1">
              {(() => {
                const barValues = [
                  Math.max(0, pendingAmbassadorOrdersCount - 6),
                  Math.max(0, pendingAmbassadorOrdersCount - 5),
                  Math.max(0, pendingAmbassadorOrdersCount - 4),
                  Math.max(0, pendingAmbassadorOrdersCount - 3),
                  Math.max(0, pendingAmbassadorOrdersCount - 2),
                  Math.max(0, pendingAmbassadorOrdersCount - 1),
                  pendingAmbassadorOrdersCount,
                ];
                const maxValue = Math.max(...barValues, 1);
                return barValues.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/30 rounded-t transition-all duration-300 hover:bg-primary/50"
                    style={{ height: `${(h / maxValue) * 100}%` }}
                  />
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-800 hover:shadow-lg transition-all duration-300"
          style={{ backgroundColor: "#1F1F1F", borderColor: "#2A2A2A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A3A3A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A2A2A";
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <span className="font-heading">
                  {language === "en" ? "Activity Overview" : "Aperçu de l'Activité"}
                </span>
              </div>
              <Badge variant="outline" className="font-heading">
                {language === "en" ? "Last 7 days" : "7 derniers jours"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityChartData} margin={{ top: 8, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" stroke="#B0B0B0" tick={{ fill: "#B0B0B0", fontSize: 12 }} />
                  <YAxis yAxisId="left" stroke="#B0B0B0" tick={{ fill: "#B0B0B0", fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#B0B0B0" tick={{ fill: "#B0B0B0", fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{ background: "#1F1F1F", border: "1px solid #2A2A2A", borderRadius: 8 }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        applications: language === "en" ? "Applications" : "Candidatures",
                        orders: language === "en" ? "Orders" : "Commandes",
                        revenue: language === "en" ? "Revenue (TND)" : "Chiffre (TND)",
                      };
                      return [name === "revenue" ? `${Number(value).toLocaleString()} TND` : value, labels[name] || name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) =>
                      value === "revenue"
                        ? language === "en"
                          ? "Revenue (TND)"
                          : "Chiffre (TND)"
                        : value === "applications"
                          ? language === "en"
                            ? "Applications"
                            : "Candidatures"
                          : language === "en"
                            ? "Orders"
                            : "Commandes"
                    }
                  />
                  <Line type="monotone" dataKey="applications" stroke="#E21836" strokeWidth={2} dot={{ fill: "#E21836", r: 4 }} yAxisId="left" name="applications" />
                  <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", r: 4 }} yAxisId="left" name="orders" />
                  <Line type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 4 }} yAxisId="right" name="revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-900 hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                <span className="font-heading">
                  {language === "en" ? "Applications Status" : "Statut des Candidatures"}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-heading text-muted-foreground">
                    {language === "en" ? "Pending" : "En Attente"}
                  </span>
                  <span className="text-sm font-bold font-heading">{pendingApplications.length}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${applications.length > 0 ? (pendingApplications.length / applications.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-heading text-muted-foreground">
                    {language === "en" ? "Approved" : "Approuvé"}
                  </span>
                  <span className="text-sm font-bold font-heading">{approvedCount}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${applications.length > 0 ? (approvedCount / applications.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-heading text-muted-foreground">
                    {language === "en" ? "Rejected" : "Rejeté"}
                  </span>
                  <span className="text-sm font-bold font-heading">
                    {applications.filter((a) => a.status === "rejected").length}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        applications.length > 0
                          ? (applications.filter((a) => a.status === "rejected").length / applications.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-heading font-semibold">
                    {language === "en" ? "Total Applications" : "Total des Candidatures"}
                  </span>
                  <span className="text-lg font-bold font-heading text-primary">{applications.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          className="animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1000 hover:shadow-lg transition-all duration-300"
          style={{ backgroundColor: "#1F1F1F", borderColor: "#2A2A2A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#3A3A3A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2A2A2A";
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading" style={{ color: "#FFFFFF" }}>
              <Target className="w-5 h-5" style={{ color: "#E21836" }} />
              {language === "en" ? "Quick Actions" : "Actions Rapides"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setActiveTab("events")}
              className="w-full justify-start font-heading"
              style={{ backgroundColor: "#E21836", color: "#FFFFFF", border: "none" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#C4162F";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#E21836";
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              {language === "en" ? "Create New Event" : "Créer un Nouvel Événement"}
            </Button>
            <Button
              onClick={() => setActiveTab("applications")}
              className="w-full justify-start font-heading"
              style={{ backgroundColor: "#1F1F1F", color: "#FFFFFF", borderColor: "#2A2A2A" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#252525";
                e.currentTarget.style.borderColor = "#3A3A3A";
                e.currentTarget.style.color = "#E21836";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#1F1F1F";
                e.currentTarget.style.borderColor = "#2A2A2A";
                e.currentTarget.style.color = "#FFFFFF";
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              {language === "en" ? "Review Applications" : "Examiner les Candidatures"}
            </Button>
            <Button
              onClick={() => setActiveTab("ambassadors")}
              className="w-full justify-start font-heading"
              style={{ backgroundColor: "#1F1F1F", color: "#FFFFFF", borderColor: "#2A2A2A" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#252525";
                e.currentTarget.style.borderColor = "#3A3A3A";
                e.currentTarget.style.color = "#E21836";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#1F1F1F";
                e.currentTarget.style.borderColor = "#2A2A2A";
                e.currentTarget.style.color = "#FFFFFF";
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              {language === "en" ? "Manage Ambassadors" : "Gérer les Ambassadeurs"}
            </Button>
            <Button
              onClick={() => setActiveTab("tickets")}
              className="w-full justify-start font-heading"
              style={{ backgroundColor: "#1F1F1F", color: "#FFFFFF", borderColor: "#2A2A2A" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#252525";
                e.currentTarget.style.borderColor = "#3A3A3A";
                e.currentTarget.style.color = "#E21836";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#1F1F1F";
                e.currentTarget.style.borderColor = "#2A2A2A";
                e.currentTarget.style.color = "#FFFFFF";
              }}
            >
              <Ticket className="w-4 h-4 mr-2" />
              {language === "en" ? "View Ticket Sales" : "Voir les Ventes de Billets"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-1100 hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                <span className="font-heading">
                  {language === "en" ? "Upcoming Events" : "Événements à Venir"}
                </span>
              </div>
              <Button onClick={() => setActiveTab("events")} variant="ghost" size="sm" className="font-heading">
                {language === "en" ? "View All" : "Voir Tout"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events
                .filter((e) => e.event_type === "upcoming" && new Date(e.date) >= new Date())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 3)
                .map((event, index) => (
                  <div
                    key={event.id}
                    className={`p-4 bg-muted/50 rounded-lg border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer group animate-in slide-in-from-left-4 fade-in duration-500 ${
                      index === 0 ? "delay-1200" : index === 1 ? "delay-1300" : "delay-1400"
                    }`}
                    onClick={() => setActiveTab("events")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold font-heading group-hover:text-primary transition-colors">
                          {event.name}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground font-heading">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.venue}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-heading">
                        {event.featured ? (language === "en" ? "Featured" : "En Vedette") : event.event_type}
                      </Badge>
                    </div>
                  </div>
                ))}
              {events.filter((e) => e.event_type === "upcoming" && new Date(e.date) >= new Date()).length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-heading">
                  {language === "en" ? "No upcoming events" : "Aucun événement à venir"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-1500 hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary animate-pulse" />
              <span className="font-heading">
                {language === "en" ? "Recent Activity" : "Activité Récente"}
              </span>
            </div>
            <Button onClick={() => setActiveTab("applications")} variant="ghost" size="sm" className="font-heading">
              {language === "en" ? "View All" : "Voir Tout"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {applications.slice(0, 5).map((app, index) => (
              <div
                key={app.id}
                className={`flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border/50 hover:border-primary/50 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-md group animate-in slide-in-from-left-4 fade-in duration-500 ${
                  index === 0 ? "delay-1600" : index === 1 ? "delay-1700" : index === 2 ? "delay-1800" : index === 3 ? "delay-1900" : "delay-2000"
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor:
                        app.status === "approved"
                          ? "rgba(34, 197, 94, 0.2)"
                          : app.status === "rejected" || app.status === "removed"
                            ? "rgba(239, 68, 68, 0.2)"
                            : app.status === "suspended"
                              ? "rgba(107, 114, 128, 0.2)"
                              : "rgba(249, 115, 22, 0.2)",
                    }}
                  >
                    {app.status === "approved" ? (
                      <CheckCircle className="w-5 h-5" style={{ color: "#22C55E" }} />
                    ) : app.status === "rejected" || app.status === "removed" ? (
                      <XCircle className="w-5 h-5" style={{ color: "#EF4444" }} />
                    ) : app.status === "suspended" ? (
                      <Pause className="w-5 h-5" style={{ color: "#6B7280" }} />
                    ) : (
                      <Clock className="w-5 h-5" style={{ color: "#F97316" }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold font-heading group-hover:text-primary transition-colors">
                      {app.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground font-heading">
                      {app.city} • {app.phone_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(app.status)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("applications")}
                    className="opacity-0 group-hover:opacity-100 transition-opacity font-heading"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {applications.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-heading">{t.noApplications}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
