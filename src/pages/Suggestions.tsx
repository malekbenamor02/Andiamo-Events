import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logFormSubmission, logger } from "@/lib/logger";
import { API_ROUTES } from "@/lib/api-routes";
import { safeApiCall } from "@/lib/api-client";
import { Music, MapPin, Calendar } from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { PAGE_DESCRIPTIONS } from "@/lib/seo";
import { JsonLdBreadcrumb } from "@/components/JsonLd";
import { mapPublicError } from "@/lib/userErrors";
import { cn } from "@/lib/utils";

const TITLE_MAX = 200;
const DETAILS_MAX = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_TOP = "pt-[calc(4rem+var(--site-countdown-offset,0px))]";
const FIELD_CLASS =
  "mt-2 h-11 sm:h-12 rounded-xl border-border/60 bg-background/80 focus-visible:ring-primary/30";
const TEXTAREA_CLASS =
  "mt-2 min-h-[120px] resize-y rounded-xl border-border/60 bg-background/80 focus-visible:ring-primary/30";
const CARD_SURFACE = "rounded-2xl border border-border/60 bg-card/90";

interface SuggestionsProps {
  language: "en" | "fr";
}

type SuggestionType = "event" | "artist" | "venue";

const Suggestions = ({ language }: SuggestionsProps) => {
  const [formData, setFormData] = useState({
    suggestion_type: "" as SuggestionType | "",
    title: "",
    details: "",
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0" ||
        window.location.hostname.includes("localhost"));
    if (isLocalhost || !RECAPTCHA_SITE_KEY) return;
    if ((window as any).grecaptcha) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      const badge = document.querySelector(".grecaptcha-badge") as HTMLElement | null;
      if (badge?.parentNode) badge.parentNode.removeChild(badge);
      delete (window as any).grecaptcha;
    };
  }, [RECAPTCHA_SITE_KEY]);

  const executeRecaptcha = async (): Promise<string | null> => {
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "0.0.0.0" ||
        window.location.hostname.includes("localhost"));
    if (isLocalhost) return "localhost-bypass-token";
    if (!RECAPTCHA_SITE_KEY || !(window as any).grecaptcha) return null;
    try {
      if ((window as any).grecaptcha.ready) {
        await new Promise<void>((resolve) => {
          (window as any).grecaptcha.ready(() => resolve());
        });
      }
      const token = await Promise.race([
        (window as any).grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "suggestions_submit" }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RECAPTCHA_TIMEOUT")), 15000)),
      ]);
      return token;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "RECAPTCHA_TIMEOUT" || (typeof msg === "string" && msg.includes("reCAPTCHA Timeout")))
        throw new Error("RECAPTCHA_TIMEOUT");
      console.error("reCAPTCHA error", e);
      return null;
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.suggestion_type || !["event", "artist", "venue"].includes(formData.suggestion_type)) {
      next.suggestion_type = language === "en" ? "Please select a type." : "Veuillez choisir un type.";
    }
    const title = formData.title.trim();
    if (!title) {
      next.title = language === "en" ? "Title is required." : "Le titre est requis.";
    } else if (title.length > TITLE_MAX) {
      next.title = language === "en" ? `Title must be at most ${TITLE_MAX} characters.` : `Le titre doit faire au plus ${TITLE_MAX} caractères.`;
    }
    if (formData.details.trim().length > DETAILS_MAX) {
      next.details = language === "en" ? `Details must be at most ${DETAILS_MAX} characters.` : `Les détails doivent faire au plus ${DETAILS_MAX} caractères.`;
    }
    const email = formData.email.trim();
    if (!email) {
      next.email = language === "en" ? "Email is required." : "L'email est requis.";
    } else if (!EMAIL_REGEX.test(email)) {
      next.email = language === "en" ? "Invalid email format." : "Format d'email invalide.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptcha();
      } catch (err) {
        if (err instanceof Error && err.message === "RECAPTCHA_TIMEOUT") {
          toast({
            title: language === "en" ? "Verification timed out" : "Vérification expirée",
            description: language === "en"
              ? "Please try again or open this page in your browser (e.g. Chrome or Safari)."
              : "Veuillez réessayer ou ouvrir cette page dans votre navigateur (ex. Chrome ou Safari).",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        throw err;
      }
      if (!recaptchaToken) {
        toast({
          title: language === "en" ? "Verification failed" : "Échec de la vérification",
          description: language === "en" ? "reCAPTCHA verification failed. Please try again." : "La vérification reCAPTCHA a échoué. Veuillez réessayer.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      await safeApiCall<{ success: boolean; suggestion?: { id: string } }>(API_ROUTES.AUDIENCE_SUGGESTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion_type: formData.suggestion_type,
          title: formData.title.trim(),
          details: formData.details.trim() || undefined,
          email: formData.email.trim(),
          recaptchaToken,
        }),
      });

      logFormSubmission("Suggestions Form", true, { type: formData.suggestion_type, title: formData.title }, "guest");
      setFormData({ suggestion_type: "", title: "", details: "", email: "" });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({
        title: language === "en" ? "Thank you!" : "Merci !",
        description: language === "en"
          ? "Your suggestion has been received. We read every one and use them to plan future events."
          : "Votre suggestion a bien été reçue. Nous lisons chacune et les utilisons pour nos prochains événements.",
      });
    } catch (err: unknown) {
      logFormSubmission("Suggestions Form", false, { error: err instanceof Error ? err.message : String(err) }, "guest");
      logger.error("Suggestions form submission failed", err, { category: "form_submission", details: { formName: "Suggestions" } });
      const errObj = err as { status?: number; data?: { error?: string; message?: string; details?: string }; message?: string };
      const mapped = mapPublicError(
        {
          error: errObj.status === 429 ? 'rate_limited' : errObj.data?.error,
          message: errObj.data?.message || errObj.message,
          status: errObj.status,
        },
        language
      );
      toast({
        title: mapped.title,
        description: mapped.description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copy = {
    en: {
      title: "Suggest to Us",
      description: "Share your ideas for events, artists, or venues you'd love to see. We read every suggestion.",
      typeLabel: "What are you suggesting?",
      event: "Event idea",
      artist: "Artist / Rapper",
      venue: "Venue / Place",
      titleLabel: "Name or title",
      titlePlaceholder: "e.g. concert name, artist name, or venue",
      detailsLabel: "Details (optional)",
      detailsPlaceholder: "Any extra context...",
      emailLabel: "Email",
      emailPlaceholder: "your@email.com",
      submit: "Submit suggestion",
      submitting: "Sending...",
      thankYouTitle: "Thank you!",
      thankYouMessage: "Your suggestion has been received. We read every one and use them to plan future events.",
      submitAnother: "Submit another suggestion",
    },
    fr: {
      title: "Proposez-nous",
      description: "Partagez vos idées d'événements, d'artistes ou de lieux que vous aimeriez voir. Nous lisons chaque suggestion.",
      typeLabel: "Que proposez-vous ?",
      event: "Idée d'événement",
      artist: "Artiste / Rappeur",
      venue: "Lieu / Salle",
      titleLabel: "Nom ou titre",
      titlePlaceholder: "ex. nom du concert, artiste ou lieu",
      detailsLabel: "Détails (optionnel)",
      detailsPlaceholder: "Contexte supplémentaire...",
      emailLabel: "Email",
      emailPlaceholder: "votre@email.com",
      submit: "Envoyer la suggestion",
      submitting: "Envoi...",
      thankYouTitle: "Merci !",
      thankYouMessage: "Votre suggestion a bien été reçue. Nous lisons chacune et les utilisons pour nos prochains événements.",
      submitAnother: "Proposer une autre suggestion",
    },
  };

  const t = copy[language];

  return (
    <main className={cn("min-h-[100dvh] bg-background", PAGE_TOP)} id="main-content">
      <PageMeta title="Suggestions" description={PAGE_DESCRIPTIONS.suggestions[language]} path="/suggestions" />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "Suggestions", url: "/suggestions" }]} />

      <div className="mx-auto max-w-xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-5 sm:pt-10">
        {submitted ? (
          <div className="mx-auto max-w-md text-center">
            <div className={cn(CARD_SURFACE, "px-6 py-8 shadow-lg")}>
              <h2 className="text-lg font-semibold tracking-tight text-primary">{t.thankYouTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.thankYouMessage}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full rounded-xl border-border/60"
                onClick={() => {
                  setSubmitted(false);
                  setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }}
              >
                {t.submitAnother}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-6 text-center sm:mb-8">
              <h1 className="font-heading text-[1.75rem] font-bold tracking-tight text-foreground sm:text-3xl">
                {t.title}
              </h1>
              <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.description}
              </p>
            </header>

            <div className={cn(CARD_SURFACE, "overflow-hidden shadow-lg")}>
              <div className="border-b border-border/50 px-5 py-4 sm:px-6">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {language === "en"
                    ? "Fields marked * are required"
                    : "Les champs marqués * sont obligatoires"}
                </p>
              </div>

              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label className="text-sm font-medium text-foreground/90">{t.typeLabel} *</Label>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        { value: "event" as const, icon: Calendar, label: t.event },
                        { value: "artist" as const, icon: Music, label: t.artist },
                        { value: "venue" as const, icon: MapPin, label: t.venue },
                      ].map(({ value, icon: Icon, label }) => (
                        <label key={value} className="cursor-pointer">
                          <input
                            type="radio"
                            name="suggestion_type"
                            value={value}
                            checked={formData.suggestion_type === value}
                            onChange={() => setFormData((d) => ({ ...d, suggestion_type: value }))}
                            className="sr-only peer"
                          />
                          <span
                            className={cn(
                              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                              "border-border/60 bg-background/80 text-foreground/90",
                              "peer-checked:border-primary/50 peer-checked:bg-primary/10 peer-checked:text-primary"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-center leading-tight">{label}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {errors.suggestion_type && (
                      <p className="mt-1.5 text-sm text-destructive">{errors.suggestion_type}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="title" className="text-sm font-medium text-foreground/90">
                      {t.titleLabel} *
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
                      placeholder={t.titlePlaceholder}
                      maxLength={TITLE_MAX + 1}
                      className={FIELD_CLASS}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formData.title.length}/{TITLE_MAX}
                    </p>
                    {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title}</p>}
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium text-foreground/90">
                      {t.emailLabel} *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={formData.email}
                      onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                      placeholder={t.emailPlaceholder}
                      className={FIELD_CLASS}
                    />
                    {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="details" className="text-sm font-medium text-foreground/90">
                      {t.detailsLabel}
                    </Label>
                    <Textarea
                      id="details"
                      value={formData.details}
                      onChange={(e) => setFormData((d) => ({ ...d, details: e.target.value }))}
                      placeholder={t.detailsPlaceholder}
                      rows={4}
                      maxLength={DETAILS_MAX + 1}
                      className={TEXTAREA_CLASS}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formData.details.length}/{DETAILS_MAX}
                    </p>
                    {errors.details && <p className="mt-1 text-sm text-destructive">{errors.details}</p>}
                  </div>

                  <Button
                    type="submit"
                    className="btn-gradient h-12 w-full rounded-xl"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t.submitting : t.submit}
                  </Button>
                </form>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground sm:text-sm">
              {language === "en"
                ? "We read every suggestion and use them to plan future events."
                : "Nous lisons chaque suggestion et nous en servons pour nos prochains événements."}
            </p>
          </>
        )}
      </div>
    </main>
  );
};

export default Suggestions;
