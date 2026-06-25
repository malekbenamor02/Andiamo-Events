import { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Instagram, MessageCircle, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logFormSubmission, logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";

interface FooterProps {
  language: 'en' | 'fr';
}

interface SocialLinks {
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  [key: string]: string | undefined;
}

interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  [key: string]: string | undefined;
}

interface NewsletterContent {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

const Footer = ({ language }: FooterProps) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const [newsletterContent, setNewsletterContent] = useState<NewsletterContent>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .in('key', ['social_links', 'contact_info', 'newsletter_content']);

        if (error) throw error;

        data?.forEach(item => {
          switch (item.key) {
            case 'social_links':
              setSocialLinks(item.content as SocialLinks);
              break;
            case 'contact_info':
              setContactInfo(item.content as ContactInfo);
              break;
            case 'newsletter_content':
              setNewsletterContent(item.content as NewsletterContent);
              break;
          }
        });
      } catch (error) {
        console.error('Error fetching site content:', error);
      }
    };

    fetchSiteContent();
  }, []);

  const isDuplicateEmailError = (err: unknown): boolean => {
    if (typeof err !== "object" || err === null) return false;
    const e = err as { code?: string; message?: string };
    return e.code === "23505" || /duplicate key|unique constraint/i.test(e.message ?? "");
  };

  const content = {
    en: {
      newsletter: "Stay updated with our latest events",
      subscribe: "Subscribe",
      subscribing: "Subscribing...",
      subscribed: "Thanks for subscribing!",
      alreadyExists: "This email is already subscribed",
      error: "Something went wrong. Please try again.",
      rights: "All rights reserved.",
      follow: "Follow us",
      contact: "Contact",
      links: "Quick Links",
      terms: "Terms and General Conditions of Sale"
    },
    fr: {
      newsletter: "Restez informé de nos derniers événements",
      subscribe: "S'abonner",
      subscribing: "Abonnement...",
      subscribed: "Merci de vous être abonné!",
      alreadyExists: "Cet email est déjà abonné",
      error: "Une erreur s'est produite. Veuillez réessayer.",
      rights: "Tous droits réservés.",
      follow: "Suivez-nous",
      contact: "Contact",
      links: "Liens Rapides",
      terms: "Terms et conditions générales de vente"
    }
  };

  const quickLinks = {
    en: [
      { name: "Events", href: "/events" },
      { name: "Academy", href: "/academy" },
      { name: "About", href: "/about" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
      { name: "Suggestions", href: "/suggestions" },
      { name: "Terms", href: "/terms" },
    ],
    fr: [
      { name: "Événements", href: "/events" },
      { name: "Académie", href: "/academy" },
      { name: "À Propos", href: "/about" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
      { name: "Suggestions", href: "/suggestions" },
      { name: "CGV", href: "/terms" },
    ]
  };

  const getNewsletterErrorMessage = (err: unknown): string => {
    if (isDuplicateEmailError(err)) return content[language].alreadyExists;
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
    return content[language].error;
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({ email, language });

      if (error) throw error;

      // Log successful newsletter subscription
      logFormSubmission('Newsletter Subscription', true, {
        email,
        language
      }, 'guest');
      logger.action('Newsletter subscription', {
        category: 'form_submission',
        details: { email, language }
      });

      toast({
        title: content[language].subscribed,
        description: content[language].newsletter,
      });
      setEmail("");
    } catch (error) {
      const duplicate = isDuplicateEmailError(error);
      const errorMessage = getNewsletterErrorMessage(error);

      logFormSubmission('Newsletter Subscription', false, {
        email,
        error: errorMessage,
        duplicate,
      }, 'guest');
      logger.error('Newsletter subscription failed', error, {
        category: 'form_submission',
        details: { formName: 'Newsletter Subscription', email, duplicate }
      });

      toast({
        title: duplicate ? content[language].alreadyExists : content[language].error,
        description: duplicate ? undefined : errorMessage,
        variant: duplicate ? "default" : "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-5 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0">
            <RouterLink
              to="/"
              className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
            >
              <img
                src="/email-assets/logo-black.png"
                alt="Andiamo Events Logo"
                className="h-10 w-auto object-contain dark:hidden sm:h-11"
              />
              <img
                src="/email-assets/logo-white.png"
                alt="Andiamo Events Logo"
                className="hidden h-10 w-auto object-contain dark:block sm:h-11"
              />
            </RouterLink>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {language === "en"
                ? "Creating innovative and inspiring event experiences in Tunisia. We create memories."
                : "Nous créons des expériences événementielles innovantes et inspirantes en Tunisie. Nous créons des souvenirs."}
            </p>

            <div className="mt-6 max-w-md">
              <h4 className="text-sm font-semibold text-foreground">
                {newsletterContent?.title || content[language].newsletter}
              </h4>
              <form onSubmit={handleNewsletterSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={language === "en" ? "your@email.com" : "vous@email.com"}
                  className="h-11 flex-1 rounded-xl border-border/60 bg-background/80 text-sm"
                  required
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="btn-gradient h-11 shrink-0 rounded-xl px-5 text-sm"
                >
                  {isLoading ? content[language].subscribing : content[language].subscribe}
                </Button>
              </form>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">{content[language].links}</h4>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1">
              {quickLinks[language].map((link) => (
                <li key={link.href}>
                  <RouterLink
                    to={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.name}
                  </RouterLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">{content[language].contact}</h4>
            <div className="mt-3 space-y-3">
              <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                +216 28 070 128
              </span>
              {contactInfo?.email && (
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="break-all">{contactInfo.email}</span>
                </a>
              )}
              {contactInfo?.address && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {contactInfo.address}
                </div>
              )}
              {contactInfo?.phone && (
                <a
                  href={`https://wa.me/${contactInfo.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  WhatsApp
                </a>
              )}
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-foreground">{content[language].follow}</h4>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={socialLinks?.instagram || "https://www.instagram.com/andiamo.events/"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-border hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href={socialLinks?.tiktok || "https://www.tiktok.com/@andiamo_events"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-border hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="TikTok"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </a>
                {socialLinks?.whatsapp && (
                  <a
                    href={socialLinks.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-border hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {socialLinks?.facebook && (
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-border hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Facebook"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6">
          <div className="flex flex-col items-center gap-4 text-center text-xs text-muted-foreground sm:text-sm md:flex-row md:justify-between md:text-left">
            <div className="space-y-1">
              <p>© 2025 Andiamo Events. {content[language].rights}</p>
              <p>
                Developed by{" "}
                <a
                  href="https://malekbenamor.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Malek Ben Amor
                </a>
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 md:items-end">
              <RouterLink
                to="/terms"
                className="transition-colors hover:text-primary"
              >
                {content[language].terms}
              </RouterLink>
              <div className="flex items-center gap-3">
                <img src="/assets/Visa.svg" alt="Visa" className="h-7 w-12 object-contain opacity-80" />
                <img src="/assets/mastercard.svg" alt="Mastercard" className="h-7 w-12 object-contain opacity-80" />
                <img src="/assets/edinar.svg" alt="eDinar" className="h-5 w-9 object-contain opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
