import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PrivacyPolicyProps {
  language: 'en' | 'fr';
}

interface Section {
  title: string;
  content: string;
}

interface PrivacyPolicyContent {
  title?: string;
  lastUpdated?: string;
  sections?: Section[];
  [key: string]: string | Section[] | undefined;
}

const PrivacyPolicy = ({ language }: PrivacyPolicyProps) => {
  const [privacyContent, setPrivacyContent] = useState<PrivacyPolicyContent>({});

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'privacy_policy')
          .single();
        if (error) throw error;
        if (data) setPrivacyContent(data.content as PrivacyPolicyContent);
      } catch (error) {
        console.error('Error fetching privacy policy content:', error);
      }
    };
    fetchContent();
  }, []);

  const defaultContent = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: July 17, 2024",
      sections: [
        {
          title: "Information We Collect",
          content: "We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, or contact us. This may include your name, email address, phone number, and any other information you choose to provide."
        },
        {
          title: "How We Use Your Information",
          content: "We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to develop new features and services."
        },
        {
          title: "Information Sharing",
          content: "We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy."
        },
        {
          title: "Data Security",
          content: "We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction."
        },
        {
          title: "Your Rights",
          content: "You have the right to access, update, or delete your personal information. You can also opt out of marketing communications at any time."
        },
        {
          title: "Contact Us",
          content: "If you have any questions about this Privacy Policy, please contact us at privacy@andiamo-events.tn"
        }
      ]
    },
    fr: {
      title: "Politique de Confidentialité",
      lastUpdated: "Dernière mise à jour : 17 juillet 2024",
      sections: [
        {
          title: "Informations que nous collectons",
          content: "Nous collectons les informations que vous nous fournissez directement, comme lorsque vous créez un compte, vous abonnez à notre newsletter ou nous contactez. Cela peut inclure votre nom, adresse e-mail, numéro de téléphone et toute autre information que vous choisissez de fournir."
        },
        {
          title: "Comment nous utilisons vos informations",
          content: "Nous utilisons les informations que nous collectons pour fournir, maintenir et améliorer nos services, pour communiquer avec vous et pour développer de nouvelles fonctionnalités et services."
        },
        {
          title: "Partage d'informations",
          content: "Nous ne vendons, n'échangeons ni ne transférons vos informations personnelles à des tiers sans votre consentement, sauf comme décrit dans cette politique."
        },
        {
          title: "Sécurité des données",
          content: "Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations personnelles contre l'accès non autorisé, l'altération, la divulgation ou la destruction."
        },
        {
          title: "Vos droits",
          content: "Vous avez le droit d'accéder, de mettre à jour ou de supprimer vos informations personnelles. Vous pouvez également vous désabonner des communications marketing à tout moment."
        },
        {
          title: "Nous contacter",
          content: "Si vous avez des questions sur cette Politique de Confidentialité, veuillez nous contacter à privacy@andiamo-events.tn"
        }
      ]
    }
  };

  const content = privacyContent.title ? privacyContent : defaultContent[language];

  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-4">
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

export default PrivacyPolicy; 