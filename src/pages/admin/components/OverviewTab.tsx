/**
 * Admin Dashboard — Overview tab.
 */

import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Pause,
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
import { formatDateDMY } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export interface ApplicationStats {
  pending: number;
  approved: number;
  suspended: number;
  rejected: number;
  removed: number;
  total: number;
}

function resolveApplicationStats(
  applications: AmbassadorApplication[],
  applicationStats: ApplicationStats | null | undefined,
): ApplicationStats {
  if (applicationStats) return applicationStats;
  const pending = applications.filter((a) => a.status === "pending").length;
  const approved = applications.filter((a) => a.status === "approved").length;
  const suspended = applications.filter((a) => a.status === "suspended").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;
  const removed = applications.filter((a) => a.status === "removed").length;
  return {
    pending,
    approved,
    suspended,
    rejected,
    removed,
    total: pending + approved + suspended + rejected + removed,
  };
}

export interface OverviewTabProps {
  language: "en" | "fr";
  t: Record<string, string>;
  applications: AmbassadorApplication[];
  pendingApplications: AmbassadorApplication[];
  approvedCount: number;
  applicationStats?: ApplicationStats | null;
  events: Event[];
  displayStats: {
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    soldTickets: number;
  };
  showFinancialKpis: boolean;
  adminName: string | null;
  pendingAmbassadorOrdersCount: number;
  previousPendingAmbassadorOrdersCount: number | null;
  activityChartData: {
    name: string;
    applications: number;
    approved: number;
    orders: number;
    revenue: number;
    eventsCreated: number;
  }[];
  setActiveTab: (tab: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function MetricTile({
  label,
  value,
  hint,
  accent = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "amber" | "green" | "primary" | "neutral";
}) {
  const accentStyles = {
    amber: {
      border: "border-l-amber-500",
      value: "text-amber-500",
    },
    green: {
      border: "border-l-emerald-500",
      value: "text-emerald-500",
    },
    primary: {
      border: "border-l-primary",
      value: "text-primary",
    },
    neutral: {
      border: "border-l-border",
      value: "text-foreground",
    },
  }[accent];

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 border-l-[3px] bg-card px-4 py-3.5",
        accentStyles.border,
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", accentStyles.value)}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card", className)}>{children}</div>
  );
}

function copy(language: "en" | "fr") {
  if (language === "fr") {
    return {
      welcome: "Bon retour",
      signedIn: "Connecté en tant que",
      subtitle: "Aperçu de vos événements",
      overview: "Vue d'ensemble",
      activity: "Activité",
      last7: "7 derniers jours",
      applications: "Candidatures",
      pending: "En attente",
      approved: "Approuvées",
      paused: "En pause",
      rejected: "Rejetées",
      removed: "Retirées",
      totalApplications: "Total",
      upcomingEvents: "Événements à venir",
      viewAll: "Tout voir",
      noUpcoming: "Aucun événement à venir",
      recentActivity: "Activité récente",
      awaitingReview: "En attente de révision",
      activeAmbassadors: "Ambassadeurs actifs",
      allTimeEvents: "Tous les événements",
      totalRevenue: "Revenus totaux",
      paidRevenue: "Revenus payés",
      pendingRevenue: "Revenus en attente",
      soldTickets: "Billets vendus",
      chartApplications: "Candidatures",
      chartOrders: "Commandes",
      chartRevenue: "Revenus (TND)",
    };
  }
  return {
    welcome: "Welcome back",
    signedIn: "Signed in as",
    subtitle: "Overview of your events",
    overview: "Overview",
    activity: "Activity",
    last7: "Last 7 days",
    applications: "Applications",
    pending: "Pending",
    approved: "Approved",
    paused: "Paused",
    rejected: "Rejected",
    removed: "Removed",
    totalApplications: "Total",
    upcomingEvents: "Upcoming events",
    viewAll: "View all",
    noUpcoming: "No upcoming events",
    recentActivity: "Recent activity",
    awaitingReview: "Awaiting review",
    activeAmbassadors: "Active ambassadors",
    allTimeEvents: "All events",
    totalRevenue: "Total revenue",
    paidRevenue: "Paid revenue",
    pendingRevenue: "Pending revenue",
    soldTickets: "Sold tickets",
    chartApplications: "Applications",
    chartOrders: "Orders",
    chartRevenue: "Revenue (TND)",
  };
}

export function OverviewTab({
  language,
  t,
  applications,
  pendingApplications,
  approvedCount,
  applicationStats,
  events,
  displayStats,
  showFinancialKpis,
  adminName,
  pendingAmbassadorOrdersCount,
  activityChartData,
  setActiveTab,
  getStatusBadge,
}: OverviewTabProps) {
  const isMobile = useIsMobile();
  const c = copy(language);
  const appStats = resolveApplicationStats(applications, applicationStats);

  const upcomingEvents = events
    .filter((e) => e.event_type === "upcoming" && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome strip */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {c.welcome}
              {adminName ? (
                <span className="font-medium text-primary">
                  {language === "en" ? ", " : ", "}
                  {adminName}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>
          </div>

          {showFinancialKpis && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="text-left sm:text-right">
                <p className="text-[11px] text-muted-foreground">{c.totalRevenue}</p>
                <p className="text-sm font-semibold tabular-nums text-primary">
                  {displayStats.totalRevenue.toLocaleString()} TND
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] text-muted-foreground">{c.paidRevenue}</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-500">
                  {displayStats.paidRevenue.toLocaleString()} TND
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] text-muted-foreground">{c.pendingRevenue}</p>
                <p className="text-sm font-semibold tabular-nums text-amber-500">
                  {displayStats.pendingRevenue.toLocaleString()} TND
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] text-muted-foreground">{c.soldTickets}</p>
                <p className="text-sm font-semibold tabular-nums text-primary">
                  {displayStats.soldTickets.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Key metrics */}
      <section>
        <SectionHeading>{c.overview}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label={t.pendingApplications}
            value={pendingApplications.length}
            hint={c.awaitingReview}
            accent="amber"
          />
          <MetricTile
            label={t.approvedApplications}
            value={approvedCount}
            hint={c.activeAmbassadors}
            accent="green"
          />
          <MetricTile label={t.totalEvents} value={events.length} hint={c.allTimeEvents} accent="primary" />
          <MetricTile label={t.ambassadorOrdersPending} value={pendingAmbassadorOrdersCount} accent="neutral" />
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {c.activity}
            </span>
            <span className="text-[11px] text-muted-foreground">{c.last7}</span>
          </div>
          <Panel className="p-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        applications: c.chartApplications,
                        orders: c.chartOrders,
                        revenue: c.chartRevenue,
                      };
                      return [
                        name === "revenue" ? `${Number(value).toLocaleString()} TND` : value,
                        labels[name] || name,
                      ];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                    yAxisId="left"
                    name="applications"
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    dot={false}
                    yAxisId="left"
                    name="orders"
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dot={false}
                    yAxisId="right"
                    name="revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        <section>
          <SectionHeading>{c.applications}</SectionHeading>
          <Panel className="p-4">
            <div className="space-y-4">
              {[
                {
                  label: c.pending,
                  count: appStats.pending,
                  pct: appStats.total > 0 ? (appStats.pending / appStats.total) * 100 : 0,
                  bar: "bg-amber-500",
                },
                {
                  label: c.approved,
                  count: appStats.approved,
                  pct: appStats.total > 0 ? (appStats.approved / appStats.total) * 100 : 0,
                  bar: "bg-emerald-500",
                },
                {
                  label: c.paused,
                  count: appStats.suspended,
                  pct: appStats.total > 0 ? (appStats.suspended / appStats.total) * 100 : 0,
                  bar: "bg-zinc-500",
                },
                {
                  label: c.rejected,
                  count: appStats.rejected,
                  pct: appStats.total > 0 ? (appStats.rejected / appStats.total) * 100 : 0,
                  bar: "bg-red-500",
                },
                {
                  label: c.removed,
                  count: appStats.removed,
                  pct: appStats.total > 0 ? (appStats.removed / appStats.total) * 100 : 0,
                  bar: "bg-orange-600",
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="tabular-nums font-medium text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", row.bar)}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                <span className="text-muted-foreground">{c.totalApplications}</span>
                <span className="font-semibold tabular-nums text-primary">{appStats.total}</span>
              </div>
            </div>
          </Panel>
        </section>
      </div>

      {/* Upcoming events */}
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {c.upcomingEvents}
          </span>
          {!isMobile && (
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.viewAll}
            </button>
          )}
        </div>
        <Panel>
          {upcomingEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{c.noUpcoming}</p>
          ) : (
            <div className="divide-y divide-border/50">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3",
                    !isMobile && "cursor-pointer hover:bg-muted/30",
                  )}
                  onClick={isMobile ? undefined : () => setActiveTab("events")}
                  onKeyDown={
                    isMobile
                      ? undefined
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") setActiveTab("events");
                        }
                  }
                  role={isMobile ? undefined : "button"}
                  tabIndex={isMobile ? undefined : 0}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.name}
                      <span className="ml-2 font-normal text-primary/80">
                        {formatDateDMY(event.date, language)}
                      </span>
                    </p>
                    {event.venue && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                        {event.venue}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    {event.event_type || "upcoming"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {c.recentActivity}
          </span>
          {!isMobile && applications.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("applications")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.viewAll}
            </button>
          )}
        </div>
        <Panel>
          {applications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t.noApplications}</p>
          ) : (
            <div className="divide-y divide-border/50">
              {applications.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusDot status={app.status} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{app.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {app.city}
                        {app.phone_number ? ` · ${app.phone_number}` : ""}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const config =
    status === "approved"
      ? { Icon: CheckCircle, className: "text-emerald-500" }
      : status === "rejected" || status === "removed"
        ? { Icon: XCircle, className: "text-red-500" }
        : status === "suspended"
          ? { Icon: Pause, className: "text-muted-foreground" }
          : { Icon: Clock, className: "text-amber-500" };

  const { Icon, className } = config;

  return <Icon className={cn("h-4 w-4 shrink-0", className)} strokeWidth={1.75} aria-hidden />;
}
