import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanizeAppError, errorToUserMessage } from "@/lib/network-error-message";
import { cn } from "@/lib/utils";

export interface PageFetchErrorProps {
  language: "en" | "fr";
  error: unknown;
  /** When set, "Try again" invalidates this query; otherwise full reload. */
  queryKey?: readonly unknown[];
  className?: string;
}

/**
 * Styled in-page error (nav/footer stay visible). Use when React Query fails
 * (errors do not bubble to React error boundaries).
 */
export function PageFetchError({ language, error, queryKey, className }: PageFetchErrorProps) {
  const queryClient = useQueryClient();
  const { title, detail } = humanizeAppError(errorToUserMessage(error), language);
  const retryLabel = language === "en" ? "Try again" : "Réessayer";
  const homeLabel = language === "en" ? "Back to home" : "Retour à l'accueil";

  const handleRetry = () => {
    if (queryKey && queryKey.length > 0) {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
    } else {
      window.location.reload();
    }
  };

  return (
    <main
      className={cn(
        "pt-16 min-h-[60vh] bg-background flex flex-col items-center justify-center px-4 py-16",
        className
      )}
      id="main-content"
    >
      <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-lg text-center space-y-5">
        <div className="flex justify-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <WifiOff className="h-7 w-7" aria-hidden />
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground font-heading tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button type="button" onClick={handleRetry} className="w-full sm:w-auto">
            {retryLabel}
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to="/">{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
