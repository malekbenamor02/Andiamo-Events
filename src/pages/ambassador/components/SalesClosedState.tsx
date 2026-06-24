import { Clock } from "lucide-react";

interface SalesClosedStateProps {
  language: "en" | "fr";
  title: string;
  message: string;
}

export function SalesClosedState({ language, title, message }: SalesClosedStateProps) {
  const statusLabel = language === "en" ? "Not open yet" : "Pas encore ouvert";

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/60">
          <Clock className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 space-y-3">
          <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {statusLabel}
          </span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
              {title}
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
