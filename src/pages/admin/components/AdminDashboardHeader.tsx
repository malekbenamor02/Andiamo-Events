import { AdminSessionCountdown, type AdminSessionCountdownState } from "./AdminSessionCountdown";

interface AdminDashboardHeaderProps {
  language: "en" | "fr";
  title: string;
  subtitle: string;
  session: AdminSessionCountdownState;
  suppress401Until: number | null;
}

export function AdminDashboardHeader({
  language,
  title,
  subtitle,
  session,
  suppress401Until,
}: AdminDashboardHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <AdminSessionCountdown
        session={session}
        language={language}
        suppress401Until={suppress401Until}
        variant="desktop"
      />
    </div>
  );
}
