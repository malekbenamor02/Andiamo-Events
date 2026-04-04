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
} from "lucide-react";

export type AdminDesktopSidebarRailProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentAdminRole: string | null;
  language: "en" | "fr";
  t: Record<string, string>;
  isAdminTabAllowedForRole: (tab: string, role: string | null) => boolean;
  onlineOrdersCount: number;
  fetchOnlineOrders: () => void | Promise<void>;
  codAmbassadorOrdersCount: number;
  fetchAmbassadorSalesData: (statusFilter?: string) => void | Promise<void>;
  phoneSubscribersCount: number;
  fetchPhoneSubscribers: () => void | Promise<void>;
  smsLogsCount: number;
  fetchSmsLogs: () => void | Promise<void>;
  aioEventsSubmissionsCount: number;
  fetchAioEventsSubmissions: (reset?: boolean) => void | Promise<void>;
  logsCount: number;
  fetchLogs: (reset?: boolean) => void | Promise<void>;
  handleLogout: () => void | Promise<void>;
};

export function AdminDesktopSidebarRail({
  activeTab,
  setActiveTab,
  currentAdminRole,
  language,
  t,
  isAdminTabAllowedForRole,
  onlineOrdersCount,
  fetchOnlineOrders,
  codAmbassadorOrdersCount,
  fetchAmbassadorSalesData,
  phoneSubscribersCount,
  fetchPhoneSubscribers,
  smsLogsCount,
  fetchSmsLogs,
  aioEventsSubmissionsCount,
  fetchAioEventsSubmissions,
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

  return (
    <div
      className="hidden lg:block shrink-0 sticky top-20 self-start h-[calc(100vh-5rem)] min-h-0 w-3 overflow-visible relative z-30"
      style={{
        /* Fixed layout width: flyout overlays main content so tabs don’t shift when opening/closing. */
        borderRight: "1px solid #2A2A2A",
      }}
      onMouseEnter={handleDesktopSidebarEnter}
      onMouseLeave={handleDesktopSidebarLeave}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center pointer-events-none z-10"
        style={{
          background: "rgba(26, 26, 26, 0.85)",
          opacity: sidebarNavVisible ? 0 : 1,
          transition: "opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        aria-hidden
      >
        <PanelLeft className="w-3.5 h-3.5 shrink-0" style={{ color: "#E21836" }} />
      </div>
      <div
        className="absolute left-0 top-0 z-20 h-full w-64 min-h-0 flex flex-col overflow-hidden motion-reduce:transition-none"
        style={{
          background: "#1A1A1A",
          borderRight: "1px solid #2A2A2A",
          transform: sidebarNavVisible ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
          transition:
            "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: sidebarNavVisible ? "8px 0 28px rgba(0,0,0,0.4)" : "none",
          pointerEvents: sidebarNavVisible ? "auto" : "none",
        }}
      >
        <div className="p-4 border-b shrink-0" style={{ borderColor: "#2A2A2A" }}>
          <h2 className="text-lg font-semibold" style={{ color: "#FFFFFF" }}>
            Navigation
          </h2>
        </div>
        <div className="admin-nav-scrollbar p-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y">
          <div className="space-y-1">
            <button
              onClick={() => {
                if (!isAdminTabAllowedForRole("overview", currentAdminRole)) return;
                setActiveTab("overview");
              }}
              type="button"
              data-active={activeTab === "overview"}
              className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                activeTab === "overview" ? "shadow-lg" : ""
              }`}
              style={{
                background: activeTab === "overview" ? "rgba(226, 24, 54, 0.15)" : "transparent",
              }}
            >
              <BarChart3 className={`w-4 h-4 shrink-0 ${activeTab === "overview" ? "animate-pulse" : ""}`} />
              <span>{t.overview}</span>
            </button>
            {isAdminTabAllowedForRole("events", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "events"}
                onClick={() => setActiveTab("events")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "events" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "events" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <CalendarIcon className={`w-4 h-4 shrink-0 ${activeTab === "events" ? "animate-pulse" : ""}`} />
                <span>{t.events}</span>
              </button>
            )}
            <button
              type="button"
              data-active={activeTab === "ambassadors"}
              onClick={() => setActiveTab("ambassadors")}
              className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                activeTab === "ambassadors" ? "shadow-lg" : ""
              }`}
              style={{
                background: activeTab === "ambassadors" ? "rgba(226, 24, 54, 0.08)" : "transparent",
              }}
            >
              <Users className={`w-4 h-4 shrink-0 ${activeTab === "ambassadors" ? "animate-pulse" : ""}`} />
              <span>{t.ambassadors}</span>
            </button>
            <button
              type="button"
              data-active={activeTab === "applications"}
              onClick={() => setActiveTab("applications")}
              className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                activeTab === "applications" ? "shadow-lg" : ""
              }`}
              style={{
                background: activeTab === "applications" ? "rgba(226, 24, 54, 0.08)" : "transparent",
              }}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeTab === "applications" ? "animate-pulse" : ""}`} />
              <span>{t.applications}</span>
            </button>
            {isAdminTabAllowedForRole("careers", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "careers"}
                onClick={() => setActiveTab("careers")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "careers" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "careers" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Briefcase className={`w-4 h-4 shrink-0 ${activeTab === "careers" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "Careers" : "Carrières"}</span>
              </button>
            )}
            <button
              type="button"
              data-active={activeTab === "online-orders"}
              onClick={() => {
                setActiveTab("online-orders");
                if (onlineOrdersCount === 0) {
                  void fetchOnlineOrders();
                }
              }}
              className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                activeTab === "online-orders" ? "shadow-lg" : ""
              }`}
              style={{
                background: activeTab === "online-orders" ? "rgba(226, 24, 54, 0.08)" : "transparent",
              }}
            >
              <CreditCard className={`w-4 h-4 shrink-0 ${activeTab === "online-orders" ? "animate-pulse" : ""}`} />
              <span>{language === "en" ? "Online Orders" : "Commandes en Ligne"}</span>
            </button>
            <button
              type="button"
              data-active={activeTab === "ambassador-sales"}
              onClick={() => {
                setActiveTab("ambassador-sales");
                if (codAmbassadorOrdersCount === 0) {
                  void fetchAmbassadorSalesData();
                }
              }}
              className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                activeTab === "ambassador-sales" ? "shadow-lg" : ""
              }`}
              style={{
                background: activeTab === "ambassador-sales" ? "rgba(226, 24, 54, 0.08)" : "transparent",
              }}
            >
              <Package className={`w-4 h-4 shrink-0 ${activeTab === "ambassador-sales" ? "animate-pulse" : ""}`} />
              <span>{language === "en" ? "Ambassador Sales" : "Ventes Ambassadeurs"}</span>
            </button>
            <button
              type="button"
              data-active={activeTab === "pos"}
              onClick={() => setActiveTab("pos")}
              className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                activeTab === "pos" ? "shadow-lg" : ""
              }`}
              style={{
                background: activeTab === "pos" ? "rgba(226, 24, 54, 0.08)" : "transparent",
              }}
            >
              <Store className={`w-4 h-4 shrink-0 ${activeTab === "pos" ? "animate-pulse" : ""}`} />
              <span>{language === "en" ? "Point de Vente" : "Point de Vente"}</span>
            </button>
            {isAdminTabAllowedForRole("official-invitations", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "official-invitations"}
                onClick={() => setActiveTab("official-invitations")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "official-invitations" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "official-invitations" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Mail className={`w-4 h-4 shrink-0 ${activeTab === "official-invitations" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "Official Invitations" : "Invitations Officielles"}</span>
              </button>
            )}
            {isAdminTabAllowedForRole("tickets", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "tickets"}
                onClick={() => setActiveTab("tickets")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "tickets" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "tickets" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <DollarSign className={`w-4 h-4 shrink-0 ${activeTab === "tickets" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "Reports" : "Rapports"}</span>
              </button>
            )}
            {isAdminTabAllowedForRole("scanners", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "scanners"}
                onClick={() => setActiveTab("scanners")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "scanners" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "scanners" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <QrCode className={`w-4 h-4 shrink-0 ${activeTab === "scanners" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "Scanners" : "Scanners"}</span>
              </button>
            )}
            {isAdminTabAllowedForRole("admins", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "admins"}
                onClick={() => setActiveTab("admins")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "admins" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "admins" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <User className={`w-4 h-4 shrink-0 ${activeTab === "admins" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "Admins" : "Administrateurs"}</span>
              </button>
            )}
            {isAdminTabAllowedForRole("sponsors", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "sponsors"}
                onClick={() => setActiveTab("sponsors")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "sponsors" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "sponsors" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Building2 className={`w-4 h-4 shrink-0 ${activeTab === "sponsors" ? "animate-pulse" : ""}`} />
                <span>Sponsors</span>
              </button>
            )}
            {isAdminTabAllowedForRole("team", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "team"}
                onClick={() => setActiveTab("team")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "team" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "team" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Users2 className={`w-4 h-4 shrink-0 ${activeTab === "team" ? "animate-pulse" : ""}`} />
                <span>Team</span>
              </button>
            )}
            {process.env.NODE_ENV === "development" && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Role: {currentAdminRole || "loading..."}
              </div>
            )}
            {isAdminTabAllowedForRole("marketing", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "marketing"}
                onClick={() => {
                  setActiveTab("marketing");
                  if (phoneSubscribersCount === 0) {
                    void fetchPhoneSubscribers();
                  }
                  if (smsLogsCount === 0) {
                    void fetchSmsLogs();
                  }
                }}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "marketing" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "marketing" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Megaphone className={`w-4 h-4 shrink-0 ${activeTab === "marketing" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "SMS - E-mail" : "SMS - E-mail"}</span>
              </button>
            )}
            {isAdminTabAllowedForRole("contact", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "contact"}
                onClick={() => setActiveTab("contact")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "contact" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "contact" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <MessageCircle className={`w-4 h-4 shrink-0 ${activeTab === "contact" ? "animate-pulse" : ""}`} />
                <span>Contact Messages</span>
              </button>
            )}
            {isAdminTabAllowedForRole("suggestions", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "suggestions"}
                onClick={() => setActiveTab("suggestions")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "suggestions" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "suggestions" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Lightbulb className={`w-4 h-4 shrink-0 ${activeTab === "suggestions" ? "animate-pulse" : ""}`} />
                <span>Suggestions</span>
              </button>
            )}
            {isAdminTabAllowedForRole("aio-events", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "aio-events"}
                onClick={() => {
                  setActiveTab("aio-events");
                  if (aioEventsSubmissionsCount === 0) {
                    void fetchAioEventsSubmissions(true);
                  }
                }}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "aio-events" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "aio-events" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Database className={`w-4 h-4 shrink-0 ${activeTab === "aio-events" ? "animate-pulse" : ""}`} />
                <span>AIO Events</span>
              </button>
            )}
            {isAdminTabAllowedForRole("logs", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "logs"}
                onClick={() => {
                  setActiveTab("logs");
                  if (logsCount === 0) {
                    void fetchLogs(true);
                  }
                }}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "logs" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "logs" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Activity className={`w-4 h-4 shrink-0 ${activeTab === "logs" ? "animate-pulse" : ""}`} />
                <span>{language === "en" ? "Logs & Analytics" : "Journaux et Analytiques"}</span>
              </button>
            )}
            {isAdminTabAllowedForRole("settings", currentAdminRole) && (
              <button
                type="button"
                data-active={activeTab === "settings"}
                onClick={() => setActiveTab("settings")}
                className={`admin-sidebar-nav-item w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 ${
                  activeTab === "settings" ? "shadow-lg" : ""
                }`}
                style={{
                  background: activeTab === "settings" ? "rgba(226, 24, 54, 0.08)" : "transparent",
                }}
              >
                <Settings className={`w-4 h-4 shrink-0 ${activeTab === "settings" ? "animate-pulse" : ""}`} />
                <span>{t.settings}</span>
              </button>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border/20 shrink-0" style={{ background: "#1A1A1A" }}>
          <Button
            variant="outline"
            onClick={() => void handleLogout()}
            className="w-full flex items-center space-x-2 transition-colors duration-100 hover:shadow-md hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="w-4 h-4 shrink-0 hover:animate-pulse" />
            <span>{t.logout}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
