/** Best-effort message string from React Query / Supabase / Error values. */
export function errorToUserMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err != null && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    return typeof m === "string" ? m : String(m);
  }
  return String(err ?? "");
}

/** True when a low-level fetch / chunk / XHR message indicates connectivity or asset load failure. */
export function isNetworkErrorMessage(message: string | undefined): boolean {
  const m = (message || "").toLowerCase();

  return (
    m.includes("network error") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("err_network") ||
    m.includes("err_internet_disconnected") ||
    m.includes("internet connection appears to be offline") ||
    (m.includes("connection") && m.includes("refused")) ||
    m.includes("loading chunk") ||
    m.includes("dynamically imported module") ||
    m.includes("importing a module script failed") ||
    /chunkloaderror|mime type|text\/html.*javascript/i.test(m)
  );
}

/**
 * Map low-level fetch / chunk / XHR messages to user-facing copy (EN/FR).
 */
export function humanizeAppError(
  message: string | undefined,
  language: "en" | "fr"
): { title: string; detail: string } {
  if (isNetworkErrorMessage(message)) {
    return language === "en"
      ? {
          title: "Unable to load this page",
          detail:
            import.meta.env.PROD
              ? "We're having trouble reaching our servers. Please check your internet connection and reload the page. If the issue continues, try again in a few minutes."
              : "We're having trouble reaching our servers. Please check your internet connection and reload the page. If you're developing locally, make sure the dev server is running.",
        }
      : {
          title: "Impossible de charger cette page",
          detail:
            import.meta.env.PROD
              ? "Nous n'arrivons pas à joindre nos serveurs. Vérifiez votre connexion Internet et rechargez la page. Si le problème persiste, réessayez dans quelques minutes."
              : "Nous n'arrivons pas à joindre nos serveurs. Vérifiez votre connexion Internet et rechargez la page. En développement local, assurez-vous que le serveur de développement est actif.",
        };
  }

  const isProd = import.meta.env.PROD;
  const safeDetail =
    isProd && message?.trim()
      ? undefined
      : message?.trim();

  return language === "en"
    ? {
        title: "Something went wrong",
        detail:
          safeDetail ||
          (isProd
            ? "An unexpected error occurred. Please try again. If the problem continues, contact us."
            : "An unexpected error occurred."),
      }
    : {
        title: "Une erreur est survenue",
        detail:
          safeDetail ||
          (isProd
            ? "Une erreur inattendue s'est produite. Veuillez réessayer. Si le problème persiste, contactez-nous."
            : "Une erreur inattendue s'est produite."),
      };
}
