import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarIcon,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  GraduationCap,
  Lightbulb,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  QrCode,
  Settings,
  Shield,
  Store,
  UserCheck,
  Users,
} from 'lucide-react';
import { ADMIN_TAB_DEFINITIONS } from '@shared/admin/tabDefinitions.cjs';
import { getDefaultTabKey } from '@shared/admin/permissions.cjs';

export type AdminTabKey =
  | 'overview'
  | 'events'
  | 'ambassadors'
  | 'applications'
  | 'careers'
  | 'academy'
  | 'online-orders'
  | 'ambassador-sales'
  | 'pos'
  | 'official-invitations'
  | 'tickets'
  | 'scanners'
  | 'admins'
  | 'sponsors'
  | 'team'
  | 'marketing'
  | 'contact'
  | 'consultation-inquiries'
  | 'suggestions'
  | 'aio-events'
  | 'logs'
  | 'settings';

type TabLabels = Record<string, string>;

const TAB_ICONS: Record<AdminTabKey, LucideIcon> = {
  overview: BarChart3,
  events: CalendarIcon,
  ambassadors: Users,
  applications: UserCheck,
  careers: FileText,
  academy: GraduationCap,
  'online-orders': CreditCard,
  'ambassador-sales': Package,
  pos: Store,
  'official-invitations': Mail,
  tickets: DollarSign,
  scanners: QrCode,
  admins: Shield,
  sponsors: Users,
  team: Users,
  marketing: Megaphone,
  contact: MessageSquare,
  'consultation-inquiries': MessageSquare,
  suggestions: Lightbulb,
  'aio-events': Database,
  logs: FileText,
  settings: Settings,
};

export interface AdminTabRegistryItem {
  key: AdminTabKey;
  labelKey: string;
  icon: LucideIcon;
  requiredPermission: string;
  order: number;
  showInMobileBottomNav?: boolean;
  mobileOrder?: number;
}

export const ADMIN_TAB_REGISTRY: AdminTabRegistryItem[] = ADMIN_TAB_DEFINITIONS.map((def) => ({
  key: def.key as AdminTabKey,
  labelKey: def.key,
  icon: TAB_ICONS[def.key as AdminTabKey] ?? BarChart3,
  requiredPermission: def.requiredPermission,
  order: def.order,
  showInMobileBottomNav: def.showInMobileBottomNav,
  mobileOrder: def.mobileOrder,
}));

export function getTabsForAllowed(allowedTabs: string[]): AdminTabRegistryItem[] {
  const set = new Set(allowedTabs);
  return ADMIN_TAB_REGISTRY.filter((tab) => set.has(tab.key)).sort((a, b) => a.order - b.order);
}

export function getMobileBottomTabItems(
  allowedTabs: string[],
  labels: TabLabels,
  language: 'en' | 'fr'
) {
  const set = new Set(allowedTabs);
  const items = ADMIN_TAB_REGISTRY.filter(
    (tab) => tab.showInMobileBottomNav && set.has(tab.key)
  ).sort((a, b) => (a.mobileOrder ?? 99) - (b.mobileOrder ?? 99));

  return items.map((tab) => ({
    key: tab.key,
    label: labelForTab(tab, labels, language),
    icon: tab.icon,
  }));
}

export function resolveDefaultTab(allowedTabs: string[]): AdminTabKey {
  return getDefaultTabKey(allowedTabs) as AdminTabKey;
}

export function canAccessTabKey(allowedTabs: string[], tab: string): boolean {
  return allowedTabs.includes(tab);
}

export function labelForTab(tab: AdminTabRegistryItem, t: TabLabels, language: 'en' | 'fr'): string {
  if (tab.key === 'ambassador-sales') {
    return language === 'en' ? 'Ambassador Sales' : 'Ventes Ambassadeurs';
  }
  if (tab.key === 'online-orders') {
    return language === 'en' ? 'Online Orders' : 'Commandes en Ligne';
  }
  if (tab.key === 'pos') {
    return 'Point de Vente';
  }
  if (tab.key === 'scanners') {
    return language === 'en' ? 'Scanners' : 'Scanners';
  }
  if (tab.key === 'marketing') {
    return 'SMS - E-mail';
  }
  if (tab.key === 'tickets') {
    return language === 'en' ? 'Reports' : 'Rapports';
  }
  return t[tab.labelKey] ?? tab.key;
}

export { LogOut };
