import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logFormSubmission, logger } from "@/lib/logger";
import { Mail, Phone, MapPin } from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { PAGE_DESCRIPTIONS } from "@/lib/seo";
import { JsonLdBreadcrumb } from "@/components/JsonLd";
import { mapPublicError } from "@/lib/userErrors";
import { cn } from "@/lib/utils";

interface ContactProps {
  language: 'en' | 'fr';
}

interface ContactContent {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: string | undefined;
}

const PAGE_TOP = "pt-[calc(4rem+var(--site-countdown-offset,0px))]";
const FIELD_CLASS =
  "mt-2 h-11 sm:h-12 rounded-xl border-border/60 bg-background/80 focus-visible:ring-primary/30";
const TEXTAREA_CLASS =
  "mt-2 min-h-[140px] resize-y rounded-xl border-border/60 bg-background/80 focus-visible:ring-primary/30";
const CARD_SURFACE = "rounded-2xl border border-border/60 bg-card/90";

const Contact = ({ language }: ContactProps) => {
  const [contactContent, setContactContent] = useState<ContactContent>({});
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('key, content')
          .in('key', ['contact_content', 'contact_info']);

        if (error) {
          console.error('Error fetching contact content:', error);
          // Don't block page rendering on error - use defaults
          return;
        } 
        
        if (data && isMounted) {
          data.forEach(item => {
            if (item.key === 'contact_content' && item.content) {
              setContactContent(item.content as ContactContent);
            } else if (item.key === 'contact_info' && item.content) {
              setContactInfo(item.content as ContactInfo);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching contact content:', error);
        // Don't block page rendering on error - defaults will be used
      }
    };

    // Fetch content in background - don't block rendering
    fetchContent();

    return () => {
      isMounted = false;
    };
  }, []);

  const defaultContent = {
    en: {
      title: "Contact Us",
      description: "For official inquiries, please use the form below."
    },
    fr: {
      title: "Contactez-nous",
      description: "Pour les demandes officielles, veuillez utiliser le formulaire ci-dessous."
    }
  };

  // Use contact content from database if available, otherwise use default
  const content = (contactContent && typeof contactContent === 'object' && 'title' in contactContent) 
    ? contactContent 
    : defaultContent[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message
        });

      if (error) throw error;

      // Log successful form submission
      logFormSubmission('Contact Form', true, {
        name: formData.name,
        email: formData.email,
        subject: formData.subject
      }, 'guest');

      toast({
        title: language === 'en' ? "Message Sent!" : "Message Envoyé!",
        description: language === 'en' 
          ? "We'll get back to you as soon as possible."
          : "Nous vous répondrons dès que possible.",
      });

      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      // Log failed form submission
      logFormSubmission('Contact Form', false, {
        email: formData.email,
        subject: formData.subject,
        error: error instanceof Error ? error.message : String(error)
      }, 'guest');
      logger.error('Contact form submission failed', error, {
        category: 'form_submission',
        details: { formName: 'Contact Form', email: formData.email }
      });

      const mapped = mapPublicError(
        {
          error: 'submission_failed',
          message:
            language === 'en'
              ? "We couldn't send your message. Please try again or email us directly."
              : "Nous n'avons pas pu envoyer votre message. Réessayez ou écrivez-nous directement par e-mail.",
        },
        language
      );
      toast({
        title: mapped.title,
        description: mapped.description,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  // Show loading screen only for a brief moment, then show content
  // Always render the page - don't block on loading
  // Content will update when data is fetched

  return (
    <main className={cn("min-h-[100dvh] bg-background", PAGE_TOP)} id="main-content">
      <PageMeta
        title="Contact"
        description={PAGE_DESCRIPTIONS.contact[language]}
        path="/contact"
      />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "Contact", url: "/contact" }]} />

      <div className="mx-auto max-w-5xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8 sm:px-5 sm:pt-10">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="font-heading text-[1.75rem] font-bold tracking-tight text-foreground sm:text-3xl">
            {content.title}
          </h1>
          <p className="mx-auto mt-2.5 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            {content.description}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8 lg:items-start">
          <section className={cn(CARD_SURFACE, "p-5 shadow-sm sm:p-6")}>
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              {language === 'en' ? 'Contact Information' : 'Informations de Contact'}
            </h2>

            <div className="mt-5 space-y-4">
              {contactInfo?.email && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email</p>
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="mt-0.5 block break-all text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {contactInfo.email}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <a
                    href="tel:+21628070128"
                    className="mt-0.5 block text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    +216 28 070 128
                  </a>
                </div>
              </div>

              {contactInfo?.phone && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Phone className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <a
                      href={`https://wa.me/${contactInfo.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {contactInfo.phone}
                    </a>
                  </div>
                </div>
              )}

              {contactInfo?.address && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {language === 'en' ? 'Address' : 'Adresse'}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {contactInfo.address}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={cn(CARD_SURFACE, "overflow-hidden shadow-lg")}>
            <div className="border-b border-border/50 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                {language === 'en' ? 'Send us a Message' : 'Envoyez-nous un Message'}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {language === 'en' ? 'Fields marked * are required' : 'Les champs marqués * sont obligatoires'}
              </p>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-name" className="text-sm font-medium text-foreground/90">
                      {language === 'en' ? 'Name' : 'Nom'} <span className="text-muted-foreground">*</span>
                    </Label>
                    <Input
                      id="contact-name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder={language === 'en' ? 'Your name' : 'Votre nom'}
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div>
                    <Label htmlFor="contact-email" className="text-sm font-medium text-foreground/90">
                      Email <span className="text-muted-foreground">*</span>
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder={language === 'en' ? 'your@email.com' : 'votre@email.com'}
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="contact-subject" className="text-sm font-medium text-foreground/90">
                    {language === 'en' ? 'Subject' : 'Sujet'} <span className="text-muted-foreground">*</span>
                  </Label>
                  <Input
                    id="contact-subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    placeholder={language === 'en' ? 'Message subject' : 'Sujet du message'}
                    className={FIELD_CLASS}
                  />
                </div>

                <div>
                  <Label htmlFor="contact-message" className="text-sm font-medium text-foreground/90">
                    Message <span className="text-muted-foreground">*</span>
                  </Label>
                  <Textarea
                    id="contact-message"
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    placeholder={language === 'en' ? 'Your message...' : 'Votre message...'}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <Button
                  type="submit"
                  className="btn-gradient h-12 w-full rounded-xl"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? (language === 'en' ? 'Sending...' : 'Envoi...')
                    : (language === 'en' ? 'Send Message' : 'Envoyer le Message')}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default Contact;
