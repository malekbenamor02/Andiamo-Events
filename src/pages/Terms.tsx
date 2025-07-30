import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TermsProps {
  language: 'en' | 'fr';
}

interface Section {
  title: string;
  content: string;
}

interface TermsContent {
  title?: string;
  lastUpdated?: string;
  sections?: Section[];
  [key: string]: string | Section[] | undefined;
}

const Terms = ({ language }: TermsProps) => {
  const [termsContent, setTermsContent] = useState<TermsContent>({});

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'terms_of_service')
          .single();
        if (error) throw error;
        if (data) setTermsContent(data.content as TermsContent);
      } catch (error) {
        console.error('Error fetching terms content:', error);
      }
    };
    fetchContent();
  }, []);

  const defaultContent = {
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated: July 17, 2024",
      sections: [
        {
          title: "Acceptance of Terms",
          content: "By accessing or using our website, you agree to be bound by these Terms of Service and our Privacy Policy."
        },
        {
          title: "Use of the Site",
          content: "You agree to use the site only for lawful purposes and in accordance with these Terms."
        },
        {
          title: "Intellectual Property",
          content: "All content on this site, including text, images, logos, and graphics, is the property of Andiamo Events or its licensors."
        },
        {
          title: "User Content",
          content: "You are responsible for any content you submit to the site. You grant us a license to use, display, and distribute your content."
        },
        {
          title: "Limitation of Liability",
          content: "We are not liable for any damages arising from your use of the site."
        },
        {
          title: "Changes to Terms",
          content: "We may update these Terms from time to time. Continued use of the site constitutes acceptance of the new Terms."
        },
        {
          title: "Contact Us",
          content: "If you have any questions about these Terms, please contact us at legal@andiamo-events.tn"
        }
      ]
    },
    fr: {
      title: "Conditions d'Utilisation",
      lastUpdated: "Dernière mise à jour : 17 juillet 2024",
      sections: [
        {
          title: "Acceptation des Conditions",
          content: "En accédant ou en utilisant notre site, vous acceptez d'être lié par ces Conditions d'Utilisation et notre Politique de Confidentialité."
        },
        {
          title: "Utilisation du Site",
          content: "Vous acceptez d'utiliser le site uniquement à des fins légales et conformément à ces Conditions."
        },
        {
          title: "Propriété Intellectuelle",
          content: "Tout le contenu de ce site, y compris les textes, images, logos et graphiques, est la propriété de Andiamo Events ou de ses concédants."
        },
        {
          title: "Contenu Utilisateur",
          content: "Vous êtes responsable de tout contenu que vous soumettez sur le site. Vous nous accordez une licence pour utiliser, afficher et distribuer votre contenu."
        },
        {
          title: "Limitation de Responsabilité",
          content: "Nous ne sommes pas responsables des dommages résultant de votre utilisation du site."
        },
        {
          title: "Modification des Conditions",
          content: "Nous pouvons mettre à jour ces Conditions de temps à autre. L'utilisation continue du site constitue une acceptation des nouvelles Conditions."
        },
        {
          title: "Nous contacter",
          content: "Si vous avez des questions concernant ces Conditions, veuillez nous contacter à legal@andiamo-events.tn"
        }
      ]
    }
  };

  const content = termsContent.title ? termsContent : defaultContent[language];

  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-gradient-neon mb-4">
            {content.title}
          </h1>
          <p className="text-muted-foreground">{content.lastUpdated}</p>
        </div>
        <div className="prose prose-lg max-w-none">
          {content.sections?.map((section, index) => (
            <div key={index} className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">{section.title}</h2>
              <p className="text-foreground/80 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-border/20 text-center">
          <a href="/" className="text-primary hover:text-primary/80 underline">
            {language === 'en' ? 'Return to Home' : "Retour à l'Accueil"}
          </a>
        </div>
      </div>
    </div>
  );
};

export default Terms; 