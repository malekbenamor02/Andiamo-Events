/**
 * Desktop hover sidebar: visibility state is local so opening/closing does not re-render the main dashboard.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Calendar as CalendarIcon,
  Users,
  FileText,
  Briefcase,
  CreditCard,
  Package,
  Store,
  Mail,
  DollarSign,
  QrCode,
  User,
  Building2,
  Users2,
  Megaphone,
  MessageCircle,
  Lightbulb,
  Database,
  Activity,
  Settings,
  LogOut,
  PanelLeft,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { AdminSidebarNavItem } from "./AdminSidebarNavItem";

export type AdminDesktopSidebarRailProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentAdminRole: string | null;
  language: "en" | "fr";
  t: Record<string, string>;
  canAccessTab: (tab: string) => boolean;
  onlineOrdersCount: number;
  fetchOnlineOrders: () => void | Promise<void>;
  codAmbassadorOrdersCount: number;
  fetchAmbassadorSalesData: (statusFilter?: string) => void | Promise<void>;
  phoneSubscribersCount: number;
  fetchPhoneSubscribers: () => void | Promise<void>;
  smsLogsCount: number;
  fetchSmsLogs: () => void | Promise<void>;
  consultationInquiriesCount: number;
  fetchConsultationInquiries: () => void | Promise<void>;
  logsCount: number;
  fetchLogs: (reset?: boolean) => void | Promise<void>;
  handleLogout: () => void | Promise<void>;
};

type NavEntry = {
  key: string;
  icon: LucideIcon;
  label: React.ReactNode;
  visible: boolean;
  onClick: () => void;
};

export function AdminDesktopSidebarRail({
  activeTab,
  setActiveTab,
  currentAdminRole,
  language,
  t,
  canAccessTab,
  onlineOrdersCount,
  fetchOnlineOrders,
  codAmbassadorOrdersCount,
  fetchAmbassadorSalesData,
  phoneSubscribersCount,
  fetchPhoneSubscribers,
  smsLogsCount,
  fetchSmsLogs,
  consultationInquiriesCount,
  fetchConsultationInquiries,
  logsCount,
  fetchLogs,
  handleLogout,
}: AdminDesktopSidebarRailProps) {
  const [sidebarNavVisible, setSidebarNavVisible] = useState(false);
  const sidebarHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sidebarHideTimeoutRef.current) {
        clearTimeout(sidebarHideTimeoutRef.current);
      }
    };
  }, []);

  const handleDesktopSidebarEnter = () => {
    if (sidebarHideTimeoutRef.current) {
      clearTimeout(sidebarHideTimeoutRef.current);
      sidebarHideTimeoutRef.current = null;
    }
    setSidebarNavVisible(true);
  };

  const handleDesktopSidebarLeave = () => {
    if (sidebarHideTimeoutRef.current) {
      clearTimeout(sidebarHideTimeoutRef.current);
    }
    sidebarHideTimeoutRef.current = setTimeout(() => {
      setSidebarNavVisible(false);
      sidebarHideTimeoutRef.current = null;
    }, 50);
  };

  useEffect(() => {
    if (sidebarHideTimeoutRef.current) {
      clearTimeout(sidebarHideTimeoutRef.current);
      sidebarHideTimeoutRef.current = null;
    }
    setSidebarNavVisible(false);
  }, [activeTab]);

  const navItems: NavEntry[] = [
    {
      key: "overview",
      icon: BarChart3,
      label: t.overview,
      visible: canAccessTab("overview"),
      onClick: () => {
        if (!canAccessTab("overview")) return;
        setActiveTab("overview");
      },
    },
    {
      key: "events",
      icon: CalendarIcon,
      label: t.events,
      visible: canAccessTab("events"),
      onClick: () => setActiveTab("events"),
    },
    {
      key: "ambassadors",
      icon: Users,
      label: t.ambassadors,
      visible: canAccessTab("ambassadors"),
      onClick: () => setActiveTab("ambassadors"),
    },
    {
      key: "applications",
      icon: FileText,
      label: t.applications,
      visible: canAccessTab("applications"),
      onClick: () => setActiveTab("applications"),
    },
    {
      key: "careers",
      icon: Briefcase,
      label: language === "en" ? "Careers" : "Carrières",
      visible: canAccessTab("careers"),
      onClick: () => setActiveTab("careers"),
    },
    {
      key: "academy",
      icon: GraduationCap,
      label: "Academy",
      visible: canAccessTab("academy"),
      onClick: () => setActiveTab("academy"),
    },
    {
      key: "online-orders",
      icon: CreditCard,
      label: language === "en" ? "Online Orders" : "Commandes en Ligne",
      visible: canAccessTab("online-orders"),
      onClick: () => {
        setActiveTab("online-orders");
        if (onlineOrdersCount === 0) void fetchOnlineOrders();
      },
    },
    {
      key: "ambassador-sales",
      icon: Package,
      label: language === "en" ? "Ambassador Sales" : "Ventes Ambassadeurs",
      visible: canAccessTab("ambassador-sales"),
      onClick: () => {
        setActiveTab("ambassador-sales");
        if (codAmbassadorOrdersCount === 0) void fetchAmbassadorSalesData();
      },
    },
    {
      key: "pos",
      icon: Store,
      label: language === "en" ? "Point de Vente" : "Point de Vente",
      visible: canAccessTab("pos"),
      onClick: () => setActiveTab("pos"),
    },
    {
      key: "official-invitations",
      icon: Mail,
      label: language === "en" ? "Official Invitations" : "Invitations Officielles",
      visible: canAccessTab("official-invitations"),
      onClick: () => setActiveTab("official-invitations"),
    },
    {
      key: "tickets",
      icon: DollarSign,
      label: language === "en" ? "Reports" : "Rapports",
      visible: canAccessTab("tickets"),
      onClick: () => setActiveTab("tickets"),
    },
    {
      key: "scanners",
      icon: QrCode,
      label: language === "en" ? "Scanners" : "Scanners",
      visible: canAccessTab("scanners"),
      onClick: () => setActiveTab("scanners"),
    },
    {
      key: "admins",
      icon: User,
      label: language === "en" ? "Admins" : "Administrateurs",
      visible: canAccessTab("admins"),
      onClick: () => setActiveTab("admins"),
    },
    {
      key: "sponsors",
      icon: Building2,
      label: "Sponsors",
      visible: canAccessTab("sponsors"),
      onClick: () => setActiveTab("sponsors"),
    },
    {
      key: "team",
      icon: Users2,
      label: "Team",
      visible: canAccessTab("team"),
      onClick: () => setActiveTab("team"),
    },
    {
      key: "marketing",
      icon: Megaphone,
      label: "SMS - E-mail",
      visible: canAccessTab("marketing"),
      onClick: () => {
        setActiveTab("marketing");
        if (phoneSubscribersCount === 0) void fetchPhoneSubscribers();
        if (smsLogsCount === 0) void fetchSmsLogs();
      },
    },
    {
      key: "contact",
      icon: MessageCircle,
      label: "Contact Messages",
      visible: canAccessTab("contact"),
      onClick: () => setActiveTab("contact"),
    },
    {
      key: "consultation-inquiries",
      icon: Database,
      label: "B2B Leads",
      visible: canAccessTab("consultation-inquiries"),
      onClick: () => {
        setActiveTab("consultation-inquiries");
        if (consultationInquiriesCount === 0) void fetchConsultationInquiries();
      },
    },
    {
      key: "suggestions",
      icon: Lightbulb,
      label: "Suggestions",
      visible: canAccessTab("suggestions"),
      onClick: () => setActiveTab("suggestions"),
    },
    {
      key: "logs",
      icon: Activity,
      label: language === "en" ? "Logs & Analytics" : "Journaux et Analytiques",
      visible: canAccessTab("logs"),
      onClick: () => {
        setActiveTab("logs");
        if (logsCount === 0) void fetchLogs(true);
      },
    },
    {
      key: "settings",
      icon: Settings,
      label: t.settings,
      visible: canAccessTab("settings"),
      onClick: () => setActiveTab("settings"),
    },
  ];

  return (
    <div
      className="hidden lg:block shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] min-h-0 w-3 overflow-visible relative z-30 border-r border-border"
      onMouseEnter={handleDesktopSidebarEnter}
      onMouseLeave={handleDesktopSidebarLeave}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center pointer-events-none z-10 bg-background/85 motion-reduce:transition-none"
        style={{
          opacity: sidebarNavVisible ? 0 : 1,
          transition: "opacity 0.18s ease",
        }}
        aria-hidden
      >
        <PanelLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </div>
      <div
        className="absolute left-0 top-0 z-20 h-full w-60 min-h-0 flex flex-col overflow-hidden bg-background border-r border-border motion-reduce:transition-none"
        style={{
          transform: sidebarNavVisible ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
          transition: "transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: sidebarNavVisible ? "4px 0 16px rgba(0,0,0,0.12)" : "none",
          pointerEvents: sidebarNavVisible ? "auto" : "none",
        }}
      >
        <div className="admin-nav-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3 touch-pan-y">
          <div className="space-y-0.5">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <AdminSidebarNavItem
                  key={item.key}
                  active={activeTab === item.key}
                  onClick={item.onClick}
                  icon={item.icon}
                  label={item.label}
                />
              ))}
            {process.env.NODE_ENV === "development" && (
              <p className="px-2.5 py-2 text-[11px] text-muted-foreground/70">
                Role: {currentAdminRole || "loading..."}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-border/60 px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{t.logout}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
