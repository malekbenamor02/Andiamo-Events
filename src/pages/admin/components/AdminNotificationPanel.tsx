import { Bell, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AdminFeedTabTarget } from "@/lib/admin/adminNotificationTypes";
import type { DesktopNotificationPermissionState } from "@/hooks/useAdminNotificationFeed";

export type AdminNotificationKind =
  | "ambassador_application"
  | "ambassador_order"
  | "online_order"
  | "pos_order"
  | "career_application"
  | "push";

export interface AdminNotification {
  id: string;
  /** Stable server dedupe id when sourced from notification feed */
  feedEventId?: string;
  kind: AdminNotificationKind;
  title: string;
  message: string;
  createdAt: string;
  tabTarget?: AdminFeedTabTarget;
  recordId?: string;
  eventId?: string | null;
  severity?: "info" | "success" | "warning";
}

interface AdminNotificationPanelProps {
  language: "en" | "fr";
  notifications: AdminNotification[];
  unreadCount: number;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  onMarkAllRead: () => void;
  desktopPermission: DesktopNotificationPermissionState;
  desktopAlertsEnabled: boolean;
  alertsUnlocked: boolean;
  onEnableAlerts: () => void;
  onNotificationClick?: (notification: AdminNotification) => void;
}

function copy(language: "en" | "fr") {
  if (language === "fr") {
    return {
      sound: "Son",
      notifications: "Notifications",
      markAllRead: "Tout lire",
      empty: "Aucune notification",
      ariaBell: "Notifications",
      enableAlerts: "Activer les alertes",
      alertsEnabled: "Alertes activées",
      desktopBlocked:
        "Notifications bloquées. Activez-les dans les paramètres du site du navigateur.",
      desktopUnsupported: "Notifications bureau non prises en charge",
      testSound: "Tester le son",
    };
  }
  return {
    sound: "Sound",
    notifications: "Notifications",
    markAllRead: "Mark all read",
    empty: "No notifications yet",
    ariaBell: "Notifications",
    enableAlerts: "Enable alerts",
    alertsEnabled: "Alerts enabled",
    desktopBlocked: "Desktop notifications blocked. Enable them in browser site settings.",
    desktopUnsupported: "Desktop notifications not supported",
    testSound: "Test sound",
  };
}

function formatTime(iso: string, language: "en" | "fr") {
  return new Date(iso).toLocaleTimeString(language === "en" ? "en-US" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminNotificationPanel({
  language,
  notifications,
  unreadCount,
  soundEnabled,
  onSoundChange,
  onMarkAllRead,
  desktopPermission,
  desktopAlertsEnabled,
  alertsUnlocked,
  onEnableAlerts,
  onNotificationClick,
}: AdminNotificationPanelProps) {
  const t = copy(language);

  const showEnableButton =
    !alertsUnlocked ||
    (desktopPermission === "default" && !desktopAlertsEnabled);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      {showEnableButton && desktopPermission !== "unsupported" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onEnableAlerts}
        >
          {t.enableAlerts}
        </Button>
      )}

      {alertsUnlocked && desktopPermission === "granted" && desktopAlertsEnabled && (
        <span className="hidden text-[11px] text-muted-foreground sm:inline">{t.alertsEnabled}</span>
      )}

      {desktopPermission === "denied" && (
        <span className="max-w-[10rem] text-[10px] leading-snug text-amber-600 sm:max-w-xs">
          {t.desktopBlocked}
        </span>
      )}

      {desktopPermission === "unsupported" && (
        <span className="hidden text-[10px] text-muted-foreground sm:inline">{t.desktopUnsupported}</span>
      )}

      <div className="flex items-center gap-2">
        <Label
          htmlFor="sound-toggle"
          className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
        >
          {soundEnabled ? (
            <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          ) : (
            <VolumeX className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          )}
          <span className="sr-only sm:not-sr-only">{t.sound}</span>
        </Label>
        <Switch
          id="sound-toggle"
          checked={soundEnabled}
          onCheckedChange={(checked) => onSoundChange(Boolean(checked))}
          className="scale-90"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={t.ariaBell}
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <span className="text-sm font-medium text-foreground">{t.notifications}</span>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.markAllRead}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n, index) => {
                const clickable = Boolean(n.tabTarget && onNotificationClick);
                const row = (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <time
                        dateTime={n.createdAt}
                        className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
                      >
                        {formatTime(n.createdAt, language)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {n.message}
                    </p>
                  </>
                );

                if (clickable) {
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onNotificationClick?.(n)}
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                        index > 0 && "border-t border-border/50",
                      )}
                    >
                      {row}
                    </button>
                  );
                }

                return (
                  <div
                    key={n.id}
                    className={cn(
                      "px-3 py-2.5",
                      index > 0 && "border-t border-border/50",
                    )}
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
