import { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Instagram, MessageCircle, Mail, MapPin, Music, Phone } from "lucide-react";
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

  const content = {
    en: {
      newsletter: "Stay updated with our latest events",
      subscribe: "Subscribe",
      subscribing: "Subscribing...",
      subscribed: "Thanks for subscribing!",
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
      { name: "About", href: "/about" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
      { name: "Suggestions", href: "/suggestions" },
      { name: "Terms", href: "/terms" },
    ],
    fr: [
      { name: "Événements", href: "/events" },
      { name: "À Propos", href: "/about" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
      { name: "Suggestions", href: "/suggestions" },
      { name: "CGV", href: "/terms" },
    ]
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
      // Log failed newsletter subscription
      logFormSubmission('Newsletter Subscription', false, {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'guest');
      logger.error('Newsletter subscription failed', error, {
        category: 'form_submission',
        details: { formName: 'Newsletter Subscription', email }
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: content[language].error,
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <footer className="bg-gradient-dark border-t border-border/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-10 lg:items-start">
          {/* Brand */}
          <div className="min-w-0">
            <RouterLink
              to="/"
              className="inline-flex mb-4 w-full max-w-md justify-center sm:justify-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-sm"
            >
              <img
                src="/logo.svg"
                alt="Andiamo Events Logo"
                className="h-auto w-full max-w-[min(100%,260px)] sm:max-w-[min(100%,280px)] max-h-28 sm:max-h-36 object-contain object-center sm:object-left"
              />
            </RouterLink>
            <p className="text-muted-foreground mb-6 max-w-md text-sm sm:text-base text-center sm:text-left">
              {language === "en"
                ? "Creating innovative and inspiring event experiences in Tunisia. We create memories."
                : "Nous créons des expériences événementielles innovantes et inspirantes en Tunisie. Nous créons des souvenirs."}
            </p>

            {/* Newsletter */}
            <div className="space-y-4 max-w-lg rounded-xl border border-border/20 bg-background/20 p-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
              <h4 className="font-semibold text-primary text-center sm:text-left">
                {newsletterContent?.title || content[language].newsletter}
              </h4>
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex flex-col sm:flex-row gap-2 sm:gap-3"
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={language === "en" ? "your@email.com" : "vous@email.com"}
                  className="flex-1 min-h-11 sm:min-h-10 text-sm"
                  required
                />
                <Button type="submit" disabled={isLoading} className="btn-gradient shrink-0 min-h-11 sm:min-h-10">
                  {isLoading ? content[language].subscribing : content[language].subscribe}
                </Button>
              </form>
            </div>
          </div>

          {/* Quick Links and Contact side by side (moderate gap); social under Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 lg:gap-8 xl:gap-10 items-start w-full sm:w-max min-w-0 shrink-0">
            <div className="min-w-0">
              <h4 className="font-semibold text-primary mb-3">{content[language].links}</h4>
              <ul className="grid grid-cols-2 gap-2 sm:block sm:space-y-2">
                {quickLinks[language].map((link) => (
                  <li key={link.href}>
                    <RouterLink
                      to={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors block rounded-lg border border-border/20 bg-background/20 px-3 py-2 text-sm sm:text-base sm:bg-transparent sm:border-0 sm:p-0"
                    >
                      {link.name}
                    </RouterLink>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 pt-6 border-t border-border/20 rounded-xl sm:rounded-none sm:pt-0 sm:border-t-0 sm:border-0 bg-background/20 sm:bg-transparent p-4 sm:p-0">
              <h4 className="font-semibold text-primary mb-3">{content[language].contact}</h4>
              <div className="space-y-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0 text-primary/90" aria-hidden />
                  <span className="font-medium">+216 28 070 128</span>
                </span>
                {contactInfo?.email && (
                  <a
                    href={`mailto:${contactInfo.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Mail className="w-4 h-4 shrink-0 text-primary/90" aria-hidden />
                    <span className="font-medium break-all">{contactInfo.email}</span>
                  </a>
                )}
                {contactInfo?.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0 text-primary/90" aria-hidden />
                    <span className="font-medium">{contactInfo.address}</span>
                  </div>
                )}
                {contactInfo?.phone && (
                  <a
                    href={`https://wa.me/${contactInfo.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0 text-primary/90" aria-hidden />
                    <span className="font-medium">WhatsApp</span>
                  </a>
                )}
              </div>

              <div className="mt-5 pt-5 border-t border-border/30">
                <h4 className="font-semibold text-primary mb-3">{content[language].follow}</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={socialLinks?.instagram || "https://www.instagram.com/andiamo.events/"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-md border border-border/20 bg-background/20 sm:bg-transparent sm:border-0 sm:p-1 sm:-m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a
                    href={socialLinks?.tiktok || "https://www.tiktok.com/@andiamo_events"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-md border border-border/20 bg-background/20 sm:bg-transparent sm:border-0 sm:p-1 sm:-m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label="TikTok"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                  </a>
                  {socialLinks?.whatsapp && (
                    <a
                      href={socialLinks.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-md border border-border/20 bg-background/20 sm:bg-transparent sm:border-0 sm:p-1 sm:-m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      aria-label="WhatsApp"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks?.facebook && (
                    <a
                      href={socialLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-md border border-border/20 bg-background/20 sm:bg-transparent sm:border-0 sm:p-1 sm:-m-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      aria-label="Facebook"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/20">
          {/* Mobile: Original stacked layout */}
          <div className="flex flex-col md:hidden justify-between items-center gap-4">
            {/* Copyright & Developer Credit */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-sm">
              <span className="text-muted-foreground">
                © 2025 Andiamo Events. {content[language].rights}
              </span>
              <span className="hidden sm:inline text-border/50">|</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Developed by</span>
                <a
                  href="https://malekbenamor.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:text-secondary transition-all duration-300 hover:underline"
                >
                  Malek Ben Amor
                </a>
              </div>
            </div>
            
            {/* Legal Links & Payment Methods */}
            <div className="flex flex-col items-center gap-4 text-sm">
              <RouterLink 
                to="/terms" 
                className="text-muted-foreground hover:text-primary transition-all duration-300 hover:underline underline-offset-4"
              >
                {content[language].terms}
              </RouterLink>
              <div className="flex items-center gap-4">
                <img src="/assets/Visa.svg" alt="Visa" className="h-8 w-14 object-contain opacity-90" />
                <img src="/assets/mastercard.svg" alt="Mastercard" className="h-8 w-14 object-contain opacity-90" />
                <img src="/assets/edinar.svg" alt="eDinar" className="h-6 w-10 object-contain opacity-90" />
              </div>
            </div>
          </div>

          {/* Desktop: Single line layout */}
          <div className="hidden md:flex flex-row justify-between items-center gap-3 text-xs whitespace-nowrap">
            {/* Copyright & Developer Credit */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground">
                © 2025 Andiamo Events. {content[language].rights}
              </span>
              <span className="text-border/50">|</span>
              <span className="text-muted-foreground">Developed by</span>
              <a
                href="https://malekbenamor.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:text-secondary transition-all duration-300 hover:underline shrink-0"
              >
                Malek Ben Amor
              </a>
            </div>
            
            {/* Legal Links & Payment Methods */}
            <div className="flex items-center gap-4 shrink-0">
              <RouterLink 
                to="/terms" 
                className="text-muted-foreground hover:text-primary transition-all duration-300 hover:underline underline-offset-2 whitespace-nowrap"
              >
                {content[language].terms}
              </RouterLink>
              <div className="flex items-center gap-3">
                <img src="/assets/Visa.svg" alt="Visa" className="h-8 w-14 object-contain opacity-90" />
                <img src="/assets/mastercard.svg" alt="Mastercard" className="h-8 w-14 object-contain opacity-90" />
                <img src="/assets/edinar.svg" alt="eDinar" className="h-6 w-10 object-contain opacity-90" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
