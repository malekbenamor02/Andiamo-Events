import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminSidebarNavItemProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: ReactNode;
  disabled?: boolean;
}

export function AdminSidebarNavItem({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
}: AdminSidebarNavItemProps) {
  return (
    <button
      type="button"
      data-active={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "admin-sidebar-nav-item w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
        active && "font-medium",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
