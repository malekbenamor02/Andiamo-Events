
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Star, Users, Gift } from "lucide-react";

interface AmbassadorProps {
  language: 'en' | 'fr';
}

interface AmbassadorContent {
  title?: string;
  description?: string;
  benefits?: string[];
  [key: string]: string | string[] | undefined;
}

const Ambassador = ({ language }: AmbassadorProps) => {
  const [ambassadorContent, setAmbassadorContent] = useState<AmbassadorContent>({});
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    phoneNumber: '',
    city: '',
    socialLink: '',
    motivation: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'ambassador_content')
          .single();

        if (error) throw error;
        if (data) setAmbassadorContent(data.content as AmbassadorContent);
      } catch (error) {
        console.error('Error fetching ambassador content:', error);
      }
    };

    fetchContent();
  }, []);

  const defaultContent = {
    en: {
      title: "Become an Ambassador",
      description: "Join our team and help us spread the Andiamo experience",
      benefits: [
        "Exclusive access to events",
        "Commission on ticket sales",
        "Andiamo merchandise",
        "Networking opportunities"
      ]
    },
    fr: {
      title: "Devenez Ambassadeur",
      description: "Rejoignez notre équipe et aidez-nous à répandre l'expérience Andiamo",
      benefits: [
        "Accès exclusif aux événements",
        "Commission sur les ventes de billets",
        "Marchandises Andiamo",
        "Opportunités de réseautage"
      ]
    }
  };

  const content = ambassadorContent.title ? ambassadorContent : defaultContent[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('ambassador_applications')
        .insert({
          full_name: formData.fullName,
          age: parseInt(formData.age),
          phone_number: formData.phoneNumber,
          city: formData.city,
          social_link: formData.socialLink || null,
          motivation: formData.motivation || null
        });

      if (error) throw error;

      toast({
        title: language === 'en' ? "Application Submitted!" : "Candidature Soumise!",
        description: language === 'en' 
          ? "We'll review your application and get back to you soon."
          : "Nous examinerons votre candidature et vous répondrons bientôt.",
      });

      setFormData({
        fullName: '',
        age: '',
        phoneNumber: '',
        city: '',
        socialLink: '',
        motivation: ''
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-gradient-neon mb-4">
            {content.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {content.description}
          </p>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div>
            <h2 className="text-2xl font-semibold mb-6">
              {language === 'en' ? 'Benefits' : 'Avantages'}
            </h2>
            <div className="space-y-4">
              {content.benefits?.map((benefit: string, index: number) => (
                <div key={index} className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Star className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold">
                  {language === 'en' ? 'Exclusive Access' : 'Accès Exclusif'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'en' 
                    ? 'Get VIP access to all our events'
                    : 'Obtenez un accès VIP à tous nos événements'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold">
                  {language === 'en' ? 'Growing Network' : 'Réseau Croissant'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'en' 
                    ? 'Connect with like-minded people'
                    : 'Connectez-vous avec des personnes partageant les mêmes idées'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Gift className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold">
                  {language === 'en' ? 'Rewards & Perks' : 'Récompenses et Avantages'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'en' 
                    ? 'Earn commissions and exclusive merchandise'
                    : 'Gagnez des commissions et des marchandises exclusives'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-card rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-6">
            {language === 'en' ? 'Apply Now' : 'Postuler Maintenant'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Full Name' : 'Nom Complet'} *
                </label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Age' : 'Âge'} *
                </label>
                <Input
                  type="number"
                  min="16"
                  max="99"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'Phone Number' : 'Numéro de Téléphone'} *
                </label>
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {language === 'en' ? 'City' : 'Ville'} *
                </label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {language === 'en' ? 'Social Media Link' : 'Lien Réseau Social'}
              </label>
              <Input
                type="url"
                placeholder="https://instagram.com/yourusername"
                value={formData.socialLink}
                onChange={(e) => setFormData({...formData, socialLink: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {language === 'en' ? 'Why do you want to be an ambassador?' : 'Pourquoi voulez-vous être ambassadeur?'}
              </label>
              <Textarea
                rows={4}
                value={formData.motivation}
                onChange={(e) => setFormData({...formData, motivation: e.target.value})}
                placeholder={language === 'en' 
                  ? 'Tell us about your motivation and experience...'
                  : 'Parlez-nous de votre motivation et de votre expérience...'}
              />
            </div>

            <Button 
              type="submit" 
              className="btn-gradient w-full"
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? (language === 'en' ? 'Submitting...' : 'Soumission...')
                : (language === 'en' ? 'Submit Application' : 'Soumettre la Candidature')
              }
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Ambassador;
