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
          .maybeSingle();
        
        // If no data or error, use default content (already set in state)
        if (error) {
          // Only log non-404/406 errors (missing content is expected)
          if (error.code !== 'PGRST116' && error.message?.includes('406') === false) {
            console.error('Error fetching privacy policy content:', error);
          }
          return;
        }
        
        if (data?.content) {
          setPrivacyContent(data.content as PrivacyPolicyContent);
        }
      } catch (error) {
        // Silently use default content if fetch fails
      }
    };
    fetchContent();
  }, []);

  const defaultContent = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: January 2025",
      sections: [
        {
          title: "Information We Collect",
          content: "We collect information you provide directly to us when you purchase tickets, create an account, subscribe to our newsletter, or contact us. This includes: your name, phone number, email address, order history, and any other information you choose to provide."
        },
        {
          title: "How We Use Your Information",
          content: "We use the information we collect to: process your ticket orders and generate QR codes, send you event notifications and updates, communicate with you about your orders, and improve our services."
        },
        {
          title: "Information Sharing",
          content: "We share your information with: event organizers for ticket validation and event management, ambassadors assigned to your COD orders for delivery purposes, and service providers who assist us in operating our platform. We do not sell your personal information to third parties."
        },
        {
          title: "Data Security",
          content: "We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security assessments."
        },
        {
          title: "Your Rights",
          content: "You have the right to: access your personal information, update or correct inaccurate information, delete your account and associated data, opt out of marketing communications, and request a copy of your data. To exercise these rights, contact us at support@andiamoevents.com"
        },
        {
          title: "Cookies",
          content: "We use cookies and similar technologies to enhance your experience, analyze site usage, and assist with marketing efforts. You can control cookies through your browser settings, though this may affect site functionality."
        },
        {
          title: "Contact Us",
          content: "If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at support@andiamoevents.com"
        }
      ]
    },
    fr: {
      title: "Politique de Confidentialité",
      lastUpdated: "Dernière mise à jour : janvier 2025",
      sections: [
        {
          title: "Informations que nous collectons",
          content: "Nous collectons les informations que vous nous fournissez directement lorsque vous achetez des billets, créez un compte, vous abonnez à notre newsletter ou nous contactez. Cela inclut : votre nom, numéro de téléphone, adresse e-mail, historique des commandes et toute autre information que vous choisissez de fournir."
        },
        {
          title: "Comment nous utilisons vos informations",
          content: "Nous utilisons les informations que nous collectons pour : traiter vos commandes de billets et générer des codes QR, assigner des ambassadeurs pour les commandes en paiement à la livraison, vous envoyer des notifications et mises à jour d'événements, communiquer avec vous concernant vos commandes, et améliorer nos services."
        },
        {
          title: "Partage d'informations",
          content: "Nous partageons vos informations avec : les organisateurs d'événements pour la validation des billets et la gestion des événements, les ambassadeurs assignés à vos commandes COD à des fins de livraison, et les prestataires de services qui nous aident à exploiter notre plateforme. Nous ne vendons pas vos informations personnelles à des tiers."
        },
        {
          title: "Sécurité des données",
          content: "Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations personnelles contre l'accès non autorisé, l'altération, la divulgation ou la destruction. Cela inclut le chiffrement, des serveurs sécurisés et des évaluations de sécurité régulières."
        },
        {
          title: "Vos droits",
          content: "Vous avez le droit de : accéder à vos informations personnelles, mettre à jour ou corriger les informations inexactes, supprimer votre compte et les données associées, vous désabonner des communications marketing, et demander une copie de vos données. Pour exercer ces droits, contactez-nous à support@andiamoevents.com"
        },
        {
          title: "Cookies",
          content: "Nous utilisons des cookies et des technologies similaires pour améliorer votre expérience, analyser l'utilisation du site et aider aux efforts de marketing. Vous pouvez contrôler les cookies via les paramètres de votre navigateur, bien que cela puisse affecter la fonctionnalité du site."
        },
        {
          title: "Nous contacter",
          content: "Si vous avez des questions sur cette Politique de Confidentialité ou souhaitez exercer vos droits, veuillez nous contacter à support@andiamoevents.com"
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