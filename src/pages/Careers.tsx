/**
 * Public Career / recruitment page.
 * "Why join us" benefits, animated design, dynamic form with file drag-drop, age min/max, link types.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/PageMeta";
import LoadingScreen from "@/components/ui/LoadingScreen";
import {
  fetchCareerDomains,
  fetchCareerDomainBySlug,
  fetchCareerPageContent,
  checkCareerApplicationDuplicate,
  submitCareerApplication,
} from "@/lib/career/api";
import type { CareerDomain, CareerApplicationField } from "@/lib/career/types";
import { uploadCareerDocument } from "@/lib/upload";
import { Briefcase, ArrowLeft, ArrowRight, CheckCircle, Sparkles, Upload, X, Search, Loader2 } from "lucide-react";

interface CareersProps {
  language: "en" | "fr";
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

function isLocalOrDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.startsWith("192.168.") ||
    h.startsWith("10.") ||
    h.endsWith(".local")
  );
}

function getRecaptchaToken(): Promise<string | null> {
  if (isLocalOrDevHost()) return Promise.resolve("localhost-bypass-token");
  if (!RECAPTCHA_SITE_KEY || typeof window === "undefined" || !(window as any).grecaptcha) return Promise.resolve(null);
  return new Promise((resolve) => {
    (window as any).grecaptcha.ready(() => {
      (window as any).grecaptcha
        .execute(RECAPTCHA_SITE_KEY, { action: "career_application" })
        .then(resolve)
        .catch(() => resolve(null));
    });
  });
}

const LINK_PLACEHOLDERS: Record<string, { en: string; fr: string }> = {
  website: { en: "https://yoursite.com", fr: "https://votresite.com" },
  linkedin: { en: "https://linkedin.com/in/yourprofile", fr: "https://linkedin.com/in/votreprofil" },
  instagram: { en: "https://instagram.com/yourhandle", fr: "https://instagram.com/votrecompte" },
  facebook: { en: "https://facebook.com/yourpage", fr: "https://facebook.com/votrepage" },
  github: { en: "https://github.com/yourusername", fr: "https://github.com/votrenom" },
  twitter: { en: "https://x.com/yourhandle", fr: "https://x.com/votrecompte" },
  portfolio: { en: "https://yourportfolio.com", fr: "https://votreportfolio.com" },
  other: { en: "https://...", fr: "https://..." },
};

// Allow optional query (?...) and fragment (#...) so shared/tracking links are accepted
const LINK_VALIDATORS: Record<string, (value: string) => boolean> = {
  website: (value) => isValidUrl(value),
  portfolio: (value) => isValidUrl(value),
  other: (value) => isValidUrl(value),
  linkedin: (value) => /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[^/]+(\/?(\?[^#]*)?(#.*)?)?$/i.test(value.trim()),
  instagram: (value) => /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+(\/?(\?[^#]*)?(#.*)?)?$/i.test(value.trim()),
  facebook: (value) => /^https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9_.-]+(\/?(\?[^#]*)?(#.*)?)?$/i.test(value.trim()),
  github: (value) => /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+(\/?(\?[^#]*)?(#.*)?)?$/i.test(value.trim()),
  twitter: (value) => /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[A-Za-z0-9_]+(\/?(\?[^#]*)?(#.*)?)?$/i.test(value.trim()),
};

// Phone: 8 digits, first digit 2, 5, 4, or 9 (Tunisian mobile)
const PHONE_REGEX = /^[2549]\d{7}$/;
function isValidPhone(value: string): boolean {
  const digits = (value || "").trim().replace(/\D/g, "");
  return PHONE_REGEX.test(digits);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test((value || "").trim());
}

function isValidUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  try {
    // Ensure protocol so URL() parsing is strict
    // If user omitted protocol, assume https for validation only
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return !!url.hostname && !!url.protocol.startsWith("http");
  } catch {
    return false;
  }
}

export default function Careers({ language }: CareersProps) {
  const { slug } = useParams<{ slug?: string }>();
  const { toast } = useToast();
  const [domains, setDomains] = useState<CareerDomain[]>([]);
  const [whyJoinUs, setWhyJoinUs] = useState<{ en?: { title: string; items: string[] }; fr?: { title: string; items: string[] } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<CareerDomain | null>(null);
  const [fields, setFields] = useState<CareerApplicationField[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fileFiles, setFileFiles] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainResolved, setDomainResolved] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const location = useLocation();
  const isApplyPage = Boolean(slug && location.pathname.endsWith("/apply"));

  const t = language === "fr"
    ? {
        title: "Carrières",
        subtitle: "Rejoignez notre équipe",
        whyJoinUs: "Pourquoi nous rejoindre",
        closed: "Les candidatures sont actuellement fermées.",
        apply: "Postuler",
        submit: "Soumettre",
        submitting: "Envoi...",
        success: "Candidature envoyée. Nous vous recontacterons bientôt.",
        back: "Retour aux offres",
        backToJob: "Retour au poste",
        required: "Requis",
        dropFile: "Déposez votre fichier ici ou cliquez pour parcourir",
        uploadSuccess: "Fichier sélectionné",
        removeFile: "Retirer",
        searchJobs: "Rechercher un poste…",
        noJobsMatch: "Aucune offre ne correspond à votre recherche.",
      }
    : {
        title: "Careers",
        subtitle: "Join our team",
        whyJoinUs: "Why join us",
        closed: "Applications are currently closed.",
        searchJobs: "Search jobs…",
        noJobsMatch: "No jobs match your search.",
        apply: "Apply",
        submit: "Submit",
        submitting: "Submitting...",
        success: "Application submitted. We will get back to you soon.",
        back: "Back to openings",
        backToJob: "Back to job",
        required: "Required",
        dropFile: "Drop your file here or click to browse",
        uploadSuccess: "File selected",
        removeFile: "Remove",
      };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, content] = await Promise.all([fetchCareerDomains(), fetchCareerPageContent()]);
        if (!cancelled) {
          setDomains(list);
          setWhyJoinUs(content.whyJoinUs);
        }
      } catch {
        if (!cancelled) setDomains([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!slug) {
      setDomain(null);
      setFields([]);
      setFormData({});
      setFileFiles({});
      setDomainLoading(false);
      setDomainResolved(false);
      return;
    }
    let cancelled = false;
    setDomainResolved(false);
    setDomainLoading(true);
    (async () => {
      try {
        const result = await fetchCareerDomainBySlug(slug);
        if (cancelled) return;
        if (!result) {
          setDomain(null);
          setFields([]);
          return;
        }
        setDomain(result.domain);
        setFields(result.fields);
        const initial: Record<string, string> = {};
        result.fields.forEach((f) => { initial[f.field_key] = ""; });
        setFormData(initial);
        setFileFiles({});
      } catch {
        if (!cancelled) setDomain(null);
        setFields([]);
      } finally {
        if (!cancelled) {
          setDomainLoading(false);
          setDomainResolved(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (domain) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [domain]);

  useEffect(() => {
    if (submitted) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [submitted]);

  // Load reCAPTCHA v3 when on a job/apply page so submit verification can run (skip in local/dev)
  useEffect(() => {
    if (!slug || !RECAPTCHA_SITE_KEY || typeof window === "undefined" || isLocalOrDevHost()) return;
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
  }, [slug]);

  const handleChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFileDrop = useCallback((key: string, file: File | null) => {
    if (!file) {
      setFileFiles((p) => { const next = { ...p }; delete next[key]; return next; });
      setFormData((p) => { const next = { ...p }; delete next[key]; return next; });
      return;
    }
    setFileFiles((p) => ({ ...p, [key]: file }));
    setFormData((p) => ({ ...p, [key]: file.name }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!domain || submitting || submitted) return;

      // Validate email fields (format)
      const invalidEmailField = fields.find((f) => {
        if (f.field_type !== "email") return false;
        const rawValue = String(formData[f.field_key] ?? "").trim();
        if (!rawValue) return false;
        return !isValidEmail(rawValue);
      });
      if (invalidEmailField) {
        toast({
          title: language === "fr" ? "Email invalide" : "Invalid email",
          description:
            language === "fr"
              ? `« ${invalidEmailField.label} » doit être une adresse email valide.`
              : `"${invalidEmailField.label}" must be a valid email address.`,
          variant: "destructive",
        });
        return;
      }

      // Validate phone fields: 8 digits starting with 2, 5, 4, or 9
      const invalidPhoneField = fields.find((f) => {
        if (f.field_type !== "phone") return false;
        const rawValue = String(formData[f.field_key] ?? "").trim();
        if (!rawValue) return false; // required is already enforced by "required" attribute
        return !isValidPhone(rawValue);
      });
      if (invalidPhoneField) {
        toast({
          title: language === "fr" ? "Numéro invalide" : "Invalid phone number",
          description:
            language === "fr"
              ? `« ${invalidPhoneField.label} » doit être 8 chiffres commençant par 2, 5, 4 ou 9.`
              : `"${invalidPhoneField.label}" must be 8 digits starting with 2, 5, 4, or 9.`,
          variant: "destructive",
        });
        return;
      }

      // Validate link fields (LinkedIn, Instagram, Facebook, etc.) before recaptcha / upload
      const invalidLinkField = fields.find((f) => {
        if (f.field_type !== "link") return false;
        const rawValue = String(formData[f.field_key] ?? "").trim();
        if (!rawValue) return false; // required is already enforced by "required" attribute
        const linkType = (f.validation as { linkType?: string })?.linkType ?? "website";
        const validator = LINK_VALIDATORS[linkType] ?? LINK_VALIDATORS.website;
        return !validator(rawValue);
      });

      if (invalidLinkField) {
        const linkType = (invalidLinkField.validation as { linkType?: string })?.linkType ?? "website";
        const examples = LINK_PLACEHOLDERS[linkType];
        const exampleText = examples ? examples[language === "fr" ? "fr" : "en"] : "https://...";
        toast({
          title: language === "fr" ? "Lien invalide" : "Invalid link",
          description:
            language === "fr"
              ? `Merci de saisir un lien valide pour « ${invalidLinkField.label} » (exemple: ${exampleText}).`
              : `Please enter a valid link for “${invalidLinkField.label}” (e.g. ${exampleText}).`,
          variant: "destructive",
        });
        return;
      }

      // Duplicate check: one email and one phone per job (frontend verification)
      const emailField = fields.find((f) => f.field_type === "email");
      const phoneField = fields.find((f) => f.field_type === "phone");
      const emailVal = (emailField && formData[emailField.field_key]) || formData.email || formData.email_address || "";
      const phoneValRaw = (phoneField && formData[phoneField.field_key]) || formData.phone || formData.phone_number || "";
      const phoneVal = phoneValRaw.trim().replace(/\D/g, "");
      if (emailVal || phoneVal) {
        try {
          const { emailTaken, phoneTaken } = await checkCareerApplicationDuplicate({
            domainSlug: domain.slug,
            email: emailVal || undefined,
            phone: phoneVal || undefined,
          });
          if (emailTaken) {
            toast({
              title: language === "fr" ? "Erreur" : "Error",
              description:
                language === "fr"
                  ? "Une candidature avec cette adresse email existe déjà pour ce poste."
                  : "An application with this email already exists for this position.",
              variant: "destructive",
            });
            return;
          }
          if (phoneTaken) {
            toast({
              title: language === "fr" ? "Erreur" : "Error",
              description:
                language === "fr"
                  ? "Une candidature avec ce numéro de téléphone existe déjà pour ce poste."
                  : "An application with this phone number already exists for this position.",
              variant: "destructive",
            });
            return;
          }
        } catch {
          // If check fails (e.g. network), continue to submit; backend will enforce duplicate rule
        }
      }

      // reCAPTCHA v3 (invisible): required on submit to prove the user is not a bot. Runs after link/phone validation.
      setSubmitting(true);
      try {
        const token = await getRecaptchaToken();
        if (!token) {
          toast({
            title: language === "fr" ? "Erreur" : "Error",
            description:
              language === "fr"
                ? "La vérification de sécurité (anti-robot) n’a pas abouti. Rechargez la page et réessayez, ou vérifiez que JavaScript est activé."
                : "The security check (anti-bot) could not be completed. Please refresh the page and try again, or ensure JavaScript is enabled.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        const payload: Record<string, string> = { ...formData };
        for (const [key, file] of Object.entries(fileFiles)) {
          if (file) {
            const result = await uploadCareerDocument(file);
            if (result.error) {
              toast({ title: "Error", description: result.error, variant: "destructive" });
              setSubmitting(false);
              return;
            }
            payload[key] = result.url;
          }
        }
        const res = await submitCareerApplication({
          domainSlug: domain.slug,
          recaptchaToken: token,
          ...payload,
        });
        setSubmitted(true);
        toast({
          title: t.success,
          description: res?.reference ? `Reference: ${res.reference}` : undefined,
          variant: "default",
        });
      } catch (err: any) {
        const details = err?.data?.details;
        let description = err?.message || "Submission failed.";
        if (Array.isArray(details) && details.length > 0) {
          const parts = details.map((d: { field?: string; message?: string }) =>
            d.field && d.message ? `${d.field}: ${d.message}` : d.message || ""
          ).filter(Boolean);
          if (parts.length) description = parts.join(". ");
        }
        toast({
          title: language === "fr" ? "Erreur" : "Error",
          description,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [domain, fields, formData, fileFiles, submitting, submitted, toast, t.success, language]
  );

  if (loading && !slug) {
    return <LoadingScreen />;
  }

  if (!slug) {
    const langKey = language === "fr" ? "fr" : "en";
    const benefits = whyJoinUs?.[langKey];
    return (
      <>
        <PageMeta title={t.title} description={t.subtitle} />
        <div className="min-h-screen bg-background">
          {/* Hero */}
          <section className="container py-20 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700">
                {t.title}
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                {t.subtitle}
              </p>
            </div>
          </section>

          {/* Why join us */}
          {benefits && Array.isArray(benefits.items) && benefits.items.length > 0 && (
            <section className="container py-12 px-4">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <Sparkles className="h-8 w-8 text-primary" />
                  {benefits.title || t.whyJoinUs}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {benefits.items.map((item, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-primary/20 bg-card/50 p-5 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)] animate-in fade-in slide-in-from-bottom-4 duration-500"
                      style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                    >
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-medium">
                          {i + 1}
                        </span>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Openings - square cards */}
          <section className="container py-16 px-4">
            <div className="max-w-4xl mx-auto">
              {domains.length === 0 ? (
                <p className="text-center text-muted-foreground text-lg animate-in fade-in duration-500">{t.closed}</p>
              ) : (
                <>
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                    <Input
                      type="search"
                      placeholder={t.searchJobs}
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      className="pl-11 pr-4 py-6 rounded-xl border-primary/20 bg-card/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 focus-visible:border-primary/40 transition-colors"
                      aria-label={language === "fr" ? "Rechercher dans les offres" : "Search jobs"}
                    />
                  </div>
                  {(() => {
                    const q = jobSearch.trim().toLowerCase();
                    const filtered = q
                      ? domains.filter(
                          (d) =>
                            d.name.toLowerCase().includes(q) ||
                            (d.description ?? "").toLowerCase().includes(q)
                        )
                      : domains;
                    if (filtered.length === 0) {
                      return (
                        <p className="text-center text-muted-foreground text-lg py-8 animate-in fade-in duration-300">
                          {t.noJobsMatch}
                        </p>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((d, i) => (
                    <Card
                      key={d.id}
                      className="border border-primary/10 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_hsl(var(--primary)/0.12)] animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-0"
                      style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
                    >
                      <CardHeader className="flex flex-col items-start gap-3 p-5 pb-2 shrink-0">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                          <Briefcase className="h-5 w-5 text-primary" />
                        </span>
                        <CardTitle className="text-lg font-semibold leading-tight line-clamp-2">
                          {d.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between gap-4 p-5 pt-0 pb-5 min-h-0">
                        {(d.job_type || d.salary) && (
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {d.job_type && <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">{d.job_type}</span>}
                            {d.salary && <span>{d.salary}</span>}
                          </div>
                        )}
                        {d.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-4 flex-1 min-h-0">{d.description}</p>
                        ) : (
                          <div className="flex-1 min-h-0" />
                        )}
                        <Button asChild className="btn-neon btn-apply-smooth rounded-lg w-full sm:w-auto shrink-0 inline-flex items-center mt-2" size="sm">
                          <Link to={`/careers/${d.slug}`} className="inline-flex items-center">
                            {t.apply} <ArrowRight className="ml-2 h-4 w-4 btn-apply-arrow" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  if (slug && !domain && !domainResolved) {
    return <LoadingScreen />;
  }

  if (slug && !domain && domainResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{language === "fr" ? "Offre introuvable." : "Opening not found."}</p>
        <Button asChild className="ml-4" variant="outline">
          <Link to="/careers">{t.back}</Link>
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full text-center border-primary/20 shadow-[0_0_40px_hsl(var(--primary)/0.1)] animate-in zoom-in-95 fade-in duration-500">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4 animate-in zoom-in duration-500" />
            <h2 className="text-xl font-semibold mb-2">{t.success}</h2>
            <Button asChild className="mt-4 btn-gradient rounded-lg">
              <Link to="/careers">{t.back}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  // Apply page: dedicated form view at /careers/:slug/apply
  if (isApplyPage) {
    return (
      <>
        <PageMeta title={language === "fr" ? `Postuler – ${domain?.name}` : `Apply – ${domain?.name}`} description={domain?.description || t.subtitle} />
        <div className="min-h-screen bg-background">
          <div className="max-w-2xl mx-auto px-4 py-24">
            <div className="mb-6">
              <Link
                to={`/careers/${slug}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                {t.backToJob}
              </Link>
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {language === "fr" ? "Postuler" : "Apply"} – {domain?.name}
            </h1>
            {domain?.description && (
              <p className="text-muted-foreground mb-8">{domain.description}</p>
            )}
            <section className="scroll-mt-24">
              <form ref={formRef} id="career-apply-form" onSubmit={handleSubmit} className="space-y-6">
                {sortedFields.map((f, idx) => (
                  <div key={f.id} className="career-form-field" style={{ animationDelay: `${idx * 80}ms` }}>
                    <Label htmlFor={f.id} className="text-foreground">
                      {f.label} {f.required && <span className="text-primary">*</span>}
                    </Label>
                    {f.field_type === "textarea" ? (
                      <Textarea
                        id={f.id}
                        value={formData[f.field_key] ?? ""}
                        onChange={(e) => handleChange(f.field_key, e.target.value)}
                        required={f.required}
                        className="mt-2 rounded-lg border-primary/20 bg-card/30 focus:border-primary/50 focus:ring-primary/20"
                        rows={4}
                      />
                    ) : f.field_type === "select" ? (
                      <Select value={formData[f.field_key] ?? ""} onValueChange={(v) => handleChange(f.field_key, v)} required={f.required}>
                        <SelectTrigger id={f.id} className="mt-2 rounded-lg border-primary/20 bg-card/30">
                          <SelectValue placeholder={t.required} />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options || []).filter((opt) => {
                            const disabledOptions = Array.isArray((f.validation as any)?.disabledOptions) ? ((f.validation as any).disabledOptions as string[]) : [];
                            return !disabledOptions.includes(opt);
                          }).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : f.field_type === "file" ? (
                      <div className="mt-2">
                        <input
                          ref={(el) => { fileInputRefs.current[f.field_key] = el; }}
                          type="file"
                          accept=".pdf,.doc,.docx,image/*"
                          className="hidden"
                          onChange={(e) => handleFileDrop(f.field_key, e.target.files?.[0] ?? null)}
                        />
                        {!fileFiles[f.field_key] ? (
                          <div
                            onClick={() => fileInputRefs.current[f.field_key]?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                            onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                              const file = e.dataTransfer.files?.[0];
                              if (file) handleFileDrop(f.field_key, file);
                            }}
                            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-card/30 py-8 px-4 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5"
                          >
                            <Upload className="h-10 w-10 text-primary/70 mb-2" />
                            <p className="text-sm text-muted-foreground text-center">{t.dropFile}</p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-card/30 px-4 py-3">
                            <span className="text-sm truncate">{fileFiles[f.field_key].name}</span>
                            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => handleFileDrop(f.field_key, null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        id={f.id}
                        type={f.field_type === "email" ? "email" : f.field_type === "phone" ? "tel" : f.field_type === "number" || f.field_type === "age" ? "number" : "text"}
                        inputMode={f.field_type === "phone" ? "numeric" : undefined}
                        min={f.field_type === "age" && (f.validation as { min?: number })?.min != null ? (f.validation as { min: number }).min : undefined}
                        max={f.field_type === "age" && (f.validation as { max?: number })?.max != null ? (f.validation as { max: number }).max : undefined}
                        value={formData[f.field_key] ?? ""}
                        onChange={(e) => handleChange(f.field_key, e.target.value)}
                        required={f.required}
                        placeholder={
                          f.field_type === "phone"
                            ? (language === "fr" ? "2X XXX XXX" : "2X XXX XXX")
                            : f.field_type === "link" && (f.validation as { linkType?: string })?.linkType
                              ? (LINK_PLACEHOLDERS[(f.validation as { linkType: string }).linkType]?.[language === "fr" ? "fr" : "en"] ?? "https://...")
                              : undefined
                        }
                        title={f.field_type === "phone" ? (language === "fr" ? "8 chiffres commençant par 2, 5, 4 ou 9" : "8 digits starting with 2, 5, 4, or 9") : undefined}
                        className="mt-2 rounded-lg border-primary/20 bg-card/30 focus:border-primary/50 focus:ring-primary/20"
                      />
                    )}
                  </div>
                ))}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="btn-neon btn-apply-smooth rounded-lg inline-flex items-center"
                  aria-busy={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      {t.submit} <ArrowRight className="ml-2 h-4 w-4 btn-apply-arrow" />
                    </>
                  )}
                </Button>
              </form>
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title={`${domain?.name} – ${t.title}`} description={domain?.description || t.subtitle} />
      <div className="min-h-screen bg-background">
        {/* Mobile: stacked. Desktop (md+): fixed left column + scrollable right column */}
        <div className="md:grid md:grid-cols-[minmax(0,360px)_1fr] lg:grid-cols-[minmax(0,400px)_1fr] md:gap-10 md:min-h-screen">
          {/* Left (mobile: sticky top bar, desktop: sticky left column) */}
          <header className="sticky top-0 z-10 border-b md:border-b-0 md:border-r border-border/50 bg-background/95 backdrop-blur-sm career-form-view shrink-0">
            <div className="pt-24 pb-6 px-4 mx-auto max-w-xl md:max-w-none md:mx-0 md:px-6 md:pb-8">
              <div className="mb-4 career-form-item" style={{ animationDelay: "0ms" }}>
                <Link
                  to="/careers"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  {t.back}
                </Link>
              </div>
              <h1 className="text-3xl font-bold mb-2 career-form-item" style={{ animationDelay: "80ms" }}>
                {domain?.name}
              </h1>
              {domain?.description && (
                <p className="text-muted-foreground mb-3 career-form-item" style={{ animationDelay: "160ms" }}>
                  {domain.description}
                </p>
              )}
              {(domain?.job_type || domain?.salary) && (
                <div className="flex flex-wrap items-center gap-3 mb-4 career-form-item" style={{ animationDelay: "200ms" }}>
                  {domain.job_type && (
                    <span className="rounded-lg bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
                      {domain.job_type}
                    </span>
                  )}
                  {domain.salary && (
                    <span className="text-sm text-muted-foreground">{domain.salary}</span>
                  )}
                </div>
              )}
              <div className="career-form-item" style={{ animationDelay: "240ms" }}>
                <Button asChild className="btn-neon btn-apply-smooth rounded-lg inline-flex items-center">
                  <Link to={`/careers/${slug}/apply`} className="inline-flex items-center">
                    {t.apply} <ArrowRight className="ml-2 h-4 w-4 btn-apply-arrow" />
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {/* Right: scrollable job details + form (mobile: below header, desktop: main column) */}
          <main className="px-4 py-8 mx-auto max-w-xl md:max-w-none md:mx-0 md:px-8 md:pt-24 md:pb-12">
            {/* Job details (admin-added full details) */}
            {((domain as { benefits?: string })?.benefits || (domain as { job_details?: string })?.job_details) && (
              <div className="space-y-6 mb-10">
                <h2 className="text-xl font-semibold text-foreground">
                  {language === "fr" ? "Détails du poste" : "Job Details"}
                </h2>
                {(domain as { benefits?: string })?.benefits && (
                  <div
                    className="rounded-xl border border-primary/20 bg-card/30 p-5 prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: (domain as { benefits: string }).benefits }}
                  />
                )}
                {(domain as { job_details?: string })?.job_details && (
                  <div className="rounded-xl border border-primary/20 bg-card/30 p-5 prose prose-invert prose-sm max-w-none">
                    {(domain as { job_details: string }).job_details.trim().startsWith("<") ? (
                      <div dangerouslySetInnerHTML={{ __html: (domain as { job_details: string }).job_details }} />
                    ) : (
                      <div className="whitespace-pre-wrap text-foreground">{(domain as { job_details: string }).job_details}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Form is on the separate apply page (/careers/:slug/apply) — Apply button above links there */}
          </main>
        </div>
      </div>
    </>
  );
}
