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

const TITLE_MAX = 200;
const DETAILS_MAX = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);

  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const heroRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute("data-section");
            if (sectionId) {
              setAnimatedSections((prev) => new Set([...prev, sectionId]));
            }
          }
        });
      },
      { threshold: 0.3, rootMargin: "0px 0px -50px 0px" }
    );
    const sections = [
      { ref: heroRef, id: "hero" },
      { ref: formRef, id: "form" },
    ];
    sections.forEach(({ ref, id }) => {
      if (ref.current) {
        ref.current.setAttribute("data-section", id);
        observer.observe(ref.current);
      }
    });
    return () => observer.disconnect();
  }, []);

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
    if (email && !EMAIL_REGEX.test(email)) {
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
          email: formData.email.trim() || undefined,
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
    } catch (err: any) {
      logFormSubmission("Suggestions Form", false, { error: err?.message }, "guest");
      logger.error("Suggestions form submission failed", err, { category: "form_submission", details: { formName: "Suggestions" } });
      const message = err?.data?.details || err?.message || (language === "en" ? "Something went wrong. Please try again." : "Une erreur s'est produite. Veuillez réessayer.");
      const isRateLimit = err?.status === 429;
      toast({
        title: language === "en" ? "Error" : "Erreur",
        description: isRateLimit
          ? (language === "en" ? "Too many submissions. Please try again later." : "Trop de soumissions. Veuillez réessayer plus tard.")
          : message,
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
      emailLabel: "Email (optional)",
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
      emailLabel: "Email (optionnel)",
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
    <main className="pt-16 min-h-screen bg-background relative overflow-hidden" id="main-content">
      <PageMeta title="Suggestions" description={PAGE_DESCRIPTIONS.suggestions[language]} path="/suggestions" />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "Suggestions", url: "/suggestions" }]} />
      <div ref={topRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {submitted ? (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="bg-green-950/30 rounded-sm p-8 border border-green-500/50">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-green-400 mb-4">{t.thankYouTitle}</h2>
              <p className="text-lg text-green-300/90">
                {t.thankYouMessage}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="btn-gradient"
              onClick={() => {
                setSubmitted(false);
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
            >
              {t.submitAnother}
            </Button>
          </div>
        ) : (
          <>
            <div
              ref={heroRef}
              className={`text-center mb-12 transform transition-all duration-1000 ease-out ${
                animatedSections.has("hero") ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
              }`}
            >
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-4 uppercase">{t.title}</h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t.description}</p>
            </div>

            <div
              ref={formRef}
              className={`bg-card rounded-sm p-8 max-w-2xl mx-auto transform transition-all duration-1000 ease-out ${
                animatedSections.has("form") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="text-sm font-medium">{t.typeLabel} *</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {[
                  { value: "event" as const, icon: Calendar, label: t.event },
                  { value: "artist" as const, icon: Music, label: t.artist },
                  { value: "venue" as const, icon: MapPin, label: t.venue },
                ].map(({ value, icon: Icon, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="suggestion_type"
                      value={value}
                      checked={formData.suggestion_type === value}
                      onChange={() => setFormData((d) => ({ ...d, suggestion_type: value }))}
                      className="sr-only peer"
                    />
                    <span className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background peer-checked:border-primary peer-checked:bg-primary/10 transition-colors">
                      <Icon className="w-4 h-4" />
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              {errors.suggestion_type && <p className="text-sm text-destructive mt-1">{errors.suggestion_type}</p>}
            </div>

            <div>
              <Label htmlFor="title" className="text-sm font-medium">
                {t.titleLabel} *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
                placeholder={t.titlePlaceholder}
                maxLength={TITLE_MAX + 1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">{formData.title.length}/{TITLE_MAX}</p>
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
            </div>

            <div>
              <Label htmlFor="details" className="text-sm font-medium">
                {t.detailsLabel}
              </Label>
              <Textarea
                id="details"
                value={formData.details}
                onChange={(e) => setFormData((d) => ({ ...d, details: e.target.value }))}
                placeholder={t.detailsPlaceholder}
                rows={4}
                maxLength={DETAILS_MAX + 1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">{formData.details.length}/{DETAILS_MAX}</p>
              {errors.details && <p className="text-sm text-destructive mt-1">{errors.details}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                {t.emailLabel}
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                placeholder={t.emailPlaceholder}
                className="mt-2"
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>

            <Button type="submit" className="btn-gradient w-full" disabled={isSubmitting}>
              {isSubmitting ? t.submitting : t.submit}
            </Button>
          </form>
            </div>
            <p className="text-center text-muted-foreground text-sm mt-8">
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
