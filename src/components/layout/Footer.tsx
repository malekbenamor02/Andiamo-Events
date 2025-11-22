import { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Instagram, MessageCircle, Mail, MapPin, Music } from "lucide-react";
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
      privacy: "Privacy Policy",
      terms: "Terms of Service"
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
      privacy: "Politique de Confidentialité",
      terms: "Conditions d'Utilisation"
    }
  };

  const quickLinks = {
    en: [
      { name: "Events", href: "/events" },
      
      { name: "About", href: "/about" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
    ],
    fr: [
      { name: "Événements", href: "/events" },
      
      { name: "À Propos", href: "/about" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="text-3xl font-orbitron font-bold text-gradient-neon mb-4">
              ANDIAMO EVENTS
            </div>
            <p className="text-muted-foreground mb-6 max-w-md">
              {language === 'en' 
                ? "Creating unforgettable nightlife experiences across Tunisia. Join the movement and live the night with us."
                : "Créer des expériences nocturnes inoubliables à travers la Tunisie. Rejoignez le mouvement et vivez la nuit avec nous."
              }
            </p>
            
            {/* Newsletter */}
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">
                {newsletterContent?.title || content[language].newsletter}
              </h4>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1"
                  required
                />
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn-gradient"
                >
                  {isLoading ? content[language].subscribing : content[language].subscribe}
                </Button>
              </form>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-primary mb-4">{content[language].links}</h4>
            <ul className="space-y-2">
              {quickLinks[language].map((link) => (
                <li key={link.href}>
                  <RouterLink 
                    to={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.name}
                  </RouterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="font-semibold text-primary mb-4">{content[language].contact}</h4>
            <div className="space-y-3">
              {contactInfo?.phone && (
                <a 
                  href={`https://wa.me/${contactInfo.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </a>
              )}
              {contactInfo?.email && (
                <a 
                  href={`mailto:${contactInfo.email}`}
                  className="flex items-center text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {contactInfo.email}
                </a>
              )}
              {contactInfo?.address && (
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="w-4 h-4 mr-2" />
                  {contactInfo.address}
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="mt-6">
              <h5 className="font-medium mb-3">{content[language].follow}</h5>
              <div className="flex space-x-3">
                  <a 
                  href={socialLinks?.instagram || "https://www.instagram.com/andiamo.events/"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a 
                  href={socialLinks?.tiktok || "https://www.tiktok.com/@andiamo_events"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                  </a>
                {socialLinks?.whatsapp && (
                  <a 
                    href={socialLinks.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                )}
                {socialLinks?.facebook && (
                  <a 
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/20">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-muted-foreground text-sm">
              © 2025 Andiamo Events. {content[language].rights} <span className="mx-2">|</span> Developed by
              <a
                href="https://www.instagram.com/malek.bamor/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 ml-1"
              >
                Malek Ben Amo
                <Instagram className="w-4 h-4 ml-1" />
              </a>
            </p>
            <div className="flex space-x-6 text-sm">
              <RouterLink to="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">
                {content[language].privacy}
              </RouterLink>
              <RouterLink to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                {content[language].terms}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
