import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logFormSubmission, logger } from "@/lib/logger";
import { Mail, MessageCircle, MapPin, Star, Sparkles, Heart, Zap, Send, User, MessageSquare, Phone, Globe, Users, Award, FileText } from "lucide-react";

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
      title: "Get in Touch",
      description: "Have questions about our events? Want to collaborate? We'd love to hear from you!"
    },
    fr: {
      title: "Contactez-nous",
      description: "Vous avez des questions sur nos événements ? Vous voulez collaborer ? Nous aimerions avoir de vos nouvelles !"
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
    <div className="pt-16 min-h-screen bg-background relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Stars */}
        <div className="absolute top-20 left-10 animate-pulse">
          <Star className="w-5 h-5 text-yellow-300/40" />
        </div>
        <div className="absolute top-40 right-20 animate-pulse delay-1000">
          <Star className="w-4 h-4 text-blue-300/30" />
        </div>
        <div className="absolute top-60 left-1/4 animate-pulse delay-2000">
          <Star className="w-3 h-3 text-purple-300/40" />
        </div>
        <div className="absolute top-80 right-1/3 animate-pulse delay-1500">
          <Star className="w-4 h-4 text-pink-300/30" />
        </div>
        
        {/* Sparkles */}
        <div className="absolute top-32 left-1/3 animate-bounce delay-500">
          <Sparkles className="w-4 h-4 text-primary/50" />
        </div>
        <div className="absolute top-48 right-1/4 animate-bounce delay-1000">
          <Sparkles className="w-3 h-3 text-primary/40" />
        </div>
        <div className="absolute top-72 left-1/2 animate-bounce delay-1500">
          <Sparkles className="w-5 h-5 text-primary/30" />
        </div>
        
        {/* Hearts */}
        <div className="absolute top-56 left-1/5 animate-pulse delay-300">
          <Heart className="w-4 h-4 text-red-400/30" />
        </div>
        <div className="absolute top-88 right-1/5 animate-pulse delay-700">
          <Heart className="w-3 h-3 text-red-400/40" />
        </div>
        
        {/* Zaps */}
        <div className="absolute top-64 left-1/6 animate-pulse delay-1200">
          <Zap className="w-4 h-4 text-yellow-400/40" />
        </div>
        <div className="absolute top-96 right-1/6 animate-pulse delay-800">
          <Zap className="w-3 h-3 text-yellow-400/30" />
        </div>
      </div>

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
            <div className="relative">
              <MessageSquare className="w-12 h-12 text-primary animate-pulse" />
              <div className="absolute -top-2 -right-2">
                <Star className="w-4 h-4 text-yellow-300 animate-spin" />
              </div>
              <div className="absolute -bottom-2 -left-2">
                <Heart className="w-3 h-3 text-red-400 animate-pulse" />
              </div>
            </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-4">
            {content.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {content.description}
          </p>
            
            {/* Hero Stars */}
            <div className="flex gap-2 mt-4">
              <Star className="w-5 h-5 text-yellow-300 animate-pulse" />
              <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-300" />
              <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-600" />
              <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-900" />
              <Star className="w-5 h-5 text-yellow-300 animate-pulse delay-1200" />
            </div>
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
              {/* Floating elements in info section */}
              <div className="absolute top-4 right-4">
                <Star className="w-4 h-4 text-yellow-300/60 animate-pulse" />
              </div>
              <div className="absolute bottom-4 left-4">
                <Sparkles className="w-3 h-3 text-primary/60 animate-bounce" />
              </div>
              
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                {language === 'en' ? 'Contact Information' : 'Informations de Contact'}
                <Star className="w-4 h-4 text-yellow-300 animate-spin" />
              </h2>
              
              <div className="space-y-4">
                {contactInfo?.email && (
                  <div className="flex items-center space-x-3 group hover:bg-card/50 p-3 rounded-lg transition-all duration-300">
                    <div className="relative">
                      <Mail className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute -top-1 -right-1">
                        <Sparkles className="w-3 h-3 text-primary/60 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <a href={`mailto:${contactInfo.email}`} className="text-muted-foreground hover:text-primary transition-colors duration-300">
                        {contactInfo.email}
                      </a>
                    </div>
                  </div>
                )}

                {contactInfo?.phone && (
                  <div className="flex items-center space-x-3 group hover:bg-card/50 p-3 rounded-lg transition-all duration-300">
                    <div className="relative">
                      <MessageCircle className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute -top-1 -right-1">
                        <Sparkles className="w-3 h-3 text-primary/60 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">WhatsApp</p>
                      <a 
                        href={`https://wa.me/${contactInfo.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors duration-300"
                      >
                        {contactInfo.phone}
                      </a>
                    </div>
                  </div>
                )}

                {contactInfo?.address && (
                  <div className="flex items-center space-x-3 group hover:bg-card/50 p-3 rounded-lg transition-all duration-300">
                    <div className="relative">
                      <MapPin className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute -top-1 -right-1">
                        <Sparkles className="w-3 h-3 text-primary/60 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">
                        {language === 'en' ? 'Address' : 'Adresse'}
                      </p>
                      <p className="text-muted-foreground">{contactInfo.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 relative overflow-hidden group">
              {/* Floating elements in follow us section */}
              <div className="absolute top-2 right-2">
                <Star className="w-3 h-3 text-yellow-300/60 animate-pulse" />
              </div>
              <div className="absolute bottom-2 left-2">
                <Heart className="w-3 h-3 text-red-400/60 animate-pulse delay-500" />
              </div>
              
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                {language === 'en' ? 'Follow Us' : 'Suivez-nous'}
                <Sparkles className="w-4 h-4 text-primary/60 animate-pulse" />
              </h3>
              <p className="text-muted-foreground">
                {language === 'en' 
                  ? 'Stay connected with us on social media for the latest updates on our events and exclusive content.'
                  : 'Restez connecté avec nous sur les réseaux sociaux pour les dernières mises à jour sur nos événements et du contenu exclusif.'}
              </p>
            </div>
          </div>

          {/* Contact Form with Animation */}
          <div 
            ref={formRef}
            className={`bg-card rounded-lg p-8 transform transition-all duration-1000 ease-out relative ${
              animatedSections.has('form') 
                ? 'opacity-100 translate-x-0 scale-100' 
                : 'opacity-0 translate-x-8 scale-95'
            }`}
          >
            {/* Floating elements in form section */}
            <div className="absolute top-4 right-4">
              <Star className="w-4 h-4 text-yellow-300/60 animate-pulse" />
            </div>
            <div className="absolute bottom-4 left-4">
              <Sparkles className="w-3 h-3 text-primary/60 animate-bounce" />
            </div>
            <div className="absolute top-1/2 left-2">
              <Heart className="w-3 h-3 text-red-400/60 animate-pulse delay-500" />
            </div>
            
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <Send className="w-6 h-6 text-primary" />
              {language === 'en' ? 'Send us a Message' : 'Envoyez-nous un Message'}
              <Star className="w-4 h-4 text-yellow-300 animate-spin" />
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    {language === 'en' ? 'Name' : 'Nom'} *
                  </label>
                  <div className="relative">
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                      className="pl-10"
                      placeholder="Your name"
                  />
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="relative">
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Email *
                  </label>
                  <div className="relative">
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                      className="pl-10"
                      placeholder="your.email@example.com"
                  />
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  {language === 'en' ? 'Subject' : 'Sujet'} *
                </label>
                <div className="relative">
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  required
                    className="pl-10"
                    placeholder="Message subject"
                />
                  <MessageSquare className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Message *
                </label>
                <div className="relative">
                <Textarea
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
                    className="pl-10"
                    placeholder="Your message..."
                />
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <Button 
                type="submit" 
                className="btn-gradient w-full relative overflow-hidden group"
                disabled={isSubmitting}
              >
                <span className="relative z-10">
                {isSubmitting 
                  ? (language === 'en' ? 'Sending...' : 'Envoi...')
                  : (language === 'en' ? 'Send Message' : 'Envoyer le Message')
                }
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-2 right-2">
                  <Send className="w-4 h-4 text-white/60 animate-pulse" />
                </div>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
