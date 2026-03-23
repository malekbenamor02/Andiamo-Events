/** Best-effort message string from React Query / Supabase / Error values. */
export function errorToUserMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err != null && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    return typeof m === "string" ? m : String(m);
  }
  return String(err ?? "");
}

/**
 * Map low-level fetch / chunk / XHR messages to user-facing copy (EN/FR).
 */
export function humanizeAppError(
  message: string | undefined,
  language: "en" | "fr"
): { title: string; detail: string } {
  const m = (message || "").toLowerCase();

  const isNetwork =
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
    /chunkloaderror|mime type|text\/html.*javascript/i.test(m);

  if (isNetwork) {
    return language === "en"
      ? {
          title: "Connection problem",
          detail:
            "We could not reach the server or finish loading this page. Check your internet connection, confirm the site is still running (if you are developing locally), then try again.",
        }
      : {
          title: "Problème de connexion",
          detail:
            "Nous ne pouvons pas joindre le serveur ou terminer le chargement de cette page. Vérifiez votre connexion Internet, assurez-vous que le site est toujours actif (en développement local), puis réessayez.",
        };
  }

  return language === "en"
    ? {
        title: "Something went wrong",
        detail: message?.trim() || "An unexpected error occurred.",
      }
    : {
        title: "Une erreur est survenue",
        detail: message?.trim() || "Une erreur inattendue s'est produite.",
      };
}
