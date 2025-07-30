
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MessageCircle, MapPin } from "lucide-react";

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
  const { toast } = useToast();

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .in('key', ['contact_content', 'contact_info']);

        if (error) throw error;

        data?.forEach(item => {
          if (item.key === 'contact_content') {
            setContactContent(item.content as ContactContent);
          } else if (item.key === 'contact_info') {
            setContactInfo(item.content as ContactInfo);
          }
        });
      } catch (error) {
        console.error('Error fetching contact content:', error);
      }
    };

    fetchContent();
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

  const content = contactContent.title ? contactContent : defaultContent[language];

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-gradient-neon mb-4">
            {content.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {content.description}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-6">
                {language === 'en' ? 'Contact Information' : 'Informations de Contact'}
              </h2>
              
              <div className="space-y-4">
                {contactInfo?.email && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a href={`mailto:${contactInfo.email}`} className="text-muted-foreground hover:text-primary">
                        {contactInfo.email}
                      </a>
                    </div>
                  </div>
                )}

                {contactInfo?.phone && (
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-medium">WhatsApp</p>
                      <a 
                        href={`https://wa.me/${contactInfo.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        {contactInfo.phone}
                      </a>
                    </div>
                  </div>
                )}

                {contactInfo?.address && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-6 h-6 text-primary" />
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

            <div className="bg-card rounded-lg p-6">
              <h3 className="font-semibold mb-4">
                {language === 'en' ? 'Follow Us' : 'Suivez-nous'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'en' 
                  ? 'Stay connected with us on social media for the latest updates on our events and exclusive content.'
                  : 'Restez connecté avec nous sur les réseaux sociaux pour les dernières mises à jour sur nos événements et du contenu exclusif.'}
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-card rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">
              {language === 'en' ? 'Send us a Message' : 'Envoyez-nous un Message'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Name' : 'Nom'} *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Subject' : 'Sujet'} *
                </label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <Textarea
                  rows={6}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
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
    </div>
  );
};

export default Contact;
