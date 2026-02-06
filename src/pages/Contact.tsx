import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logFormSubmission, logger } from "@/lib/logger";
import { Mail, Phone, MapPin } from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdBreadcrumb } from "@/components/JsonLd";

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
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Refs for animation sections
  const heroRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setAnimatedSections(prev => new Set([...prev, sectionId]));
            }
          }
        });
      },
      { 
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    // Observe all sections
    const sections = [
      { ref: heroRef, id: 'hero' },
      { ref: infoRef, id: 'info' },
      { ref: formRef, id: 'form' }
    ];

    sections.forEach(({ ref, id }) => {
      if (ref.current) {
        ref.current.setAttribute('data-section', id);
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

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

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }

    setIsSubmitting(false);
  };

  // Show loading screen only for a brief moment, then show content
  // Always render the page - don't block on loading
  // Content will update when data is fetched

  return (
    <main className="pt-16 min-h-screen bg-background relative overflow-hidden" id="main-content">
      <PageMeta
        title="Contact"
        description="Get in touch with Andiamo Events – customer service, inquiries and support. Tunisia events and ticketing."
        path="/contact"
      />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "Contact", url: "/contact" }]} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Hero Section with Animation */}
        <div 
          ref={heroRef}
          className={`text-center mb-12 transform transition-all duration-1000 ease-out ${
            animatedSections.has('hero') 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-8 scale-95'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-4 uppercase">
            {content.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {content.description}
          </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Information with Animation */}
          <div 
            ref={infoRef}
            className={`space-y-8 transform transition-all duration-1000 ease-out ${
              animatedSections.has('info') 
                ? 'opacity-100 translate-x-0 scale-100' 
                : 'opacity-0 translate-x-8 scale-95'
            }`}
          >
            <div className="relative">
              <h2 className="text-2xl font-semibold mb-6">
                {language === 'en' ? 'Contact Information' : 'Informations de Contact'}
              </h2>
              
              <div className="space-y-4">
                {contactInfo?.email && (
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">Email</p>
                        <a href={`mailto:${contactInfo.email}`} className="text-muted-foreground hover:text-primary transition-colors">
                          {contactInfo.email}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">Phone</p>
                      <a 
                        href={`tel:+21628070128`}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        +216 28 070 128
                      </a>
                    </div>
                  </div>
                </div>

                {contactInfo?.phone && (
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">WhatsApp</p>
                        <a 
                          href={`https://wa.me/${contactInfo.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {contactInfo.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {contactInfo?.address && (
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">
                          {language === 'en' ? 'Address' : 'Adresse'}
                        </p>
                        <p className="text-muted-foreground">{contactInfo.address}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Form with Animation */}
          <div 
            ref={formRef}
            className={`bg-card rounded-sm p-8 transform transition-all duration-1000 ease-out ${
              animatedSections.has('form') 
                ? 'opacity-100 translate-x-0 scale-100' 
                : 'opacity-0 translate-x-8 scale-95'
            }`}
          >
            <h2 className="text-2xl font-semibold mb-6">
              {language === 'en' ? 'Send us a Message' : 'Envoyez-nous un Message'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Name' : 'Nom'} <span className="text-muted-foreground opacity-60">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="Your name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email <span className="text-muted-foreground opacity-60">*</span>
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Subject' : 'Sujet'} <span className="text-muted-foreground opacity-60">*</span>
                </label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  required
                  placeholder="Message subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Message <span className="text-muted-foreground opacity-60">*</span>
                </label>
                <Textarea
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
                  placeholder="Your message..."
                />
              </div>

              <Button 
                type="submit" 
                className="btn-gradient w-full"
                disabled={isSubmitting}
              >
                {isSubmitting 
                  ? (language === 'en' ? 'Sending...' : 'Envoi...')
                  : (language === 'en' ? 'Send Message' : 'Envoyer le Message')
                }
              </Button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Contact;
