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
          .maybeSingle();
        
        // If no data or error, use default content (already set in state)
        if (error) {
          // Only log non-404/406 errors (missing content is expected)
          if (error.code !== 'PGRST116' && error.message?.includes('406') === false) {
            console.error('Error fetching terms content:', error);
          }
          return;
        }
        
        if (data?.content) {
          setTermsContent(data.content as TermsContent);
        }
      } catch (error) {
        // Silently use default content if fetch fails
      }
    };
    fetchContent();
  }, []);

  const defaultContent = {
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated: January 2025",
      sections: [
        {
          title: "Acceptance of Terms",
          content: "By accessing or using Andiamo Events platform, you agree to be bound by these Terms of Service, our Privacy Policy, and our Refund & Cancellation Policy. If you do not agree to these terms, please do not use our services."
        },
        {
          title: "Platform Description",
          content: "Andiamo Events operates as a ticketing and promotion platform connecting event organizers with attendees. We facilitate ticket sales, payment processing, and event management services. We are not the organizer of events listed on our platform unless explicitly stated."
        },
        {
          title: "User Information",
          content: "You agree to provide accurate, current, and complete information when placing orders. You are responsible for ensuring that the information you provide (name, phone number, email, address) is correct and up-to-date. Providing false or misleading information may result in order cancellation or denial of service."
        },
        {
          title: "Ticket Purchase & Usage",
          content: "Tickets are available in Standard and VIP categories. Each ticket grants entry for one person to the specified event. Upon purchase, you will receive a unique QR code that must be presented at the event venue. QR codes are non-transferable and can only be scanned once. Attempting to use duplicate or fraudulent tickets will result in denied entry and potential legal action."
        },
        {
          title: "Event Entry Rules",
          content: "Entry to events is subject to age restrictions as specified for each event. Late entry may be refused at the organizer's discretion. Event organizers and venue staff have the final authority to deny entry for any reason, including but not limited to: violation of dress code, disruptive behavior, intoxication, or failure to meet age requirements. Andiamo Events is not responsible for entry decisions made by organizers or venue staff."
        },
        {
          title: "Ambassador System",
          content: "Ambassadors act as independent partners facilitating Cash on Delivery (COD) orders. When you place a COD order, it will be assigned to an available ambassador using our automated assignment system. Ambassadors are responsible for confirming and delivering your order. If an ambassador cancels your order, it will be automatically reassigned to another available ambassador. Abuse, fraud, or violation of our policies by ambassadors will result in immediate suspension from our platform."
        },
        {
          title: "Event Changes",
          content: "Event organizers may change event dates, times, locations, or cancel events. Andiamo Events is not responsible for such changes. In the event of cancellation or significant changes, the organizer is responsible for communicating with ticket holders and determining refund or replacement options. We will facilitate communication but are not liable for organizer decisions."
        },
        {
          title: "Prohibited Activities",
          content: "You agree not to: resell tickets at prices above face value, create fake reservations or orders, manipulate QR code scanning systems, harass or threaten other users, ambassadors, or staff, use automated systems to purchase tickets, or engage in any fraudulent activity. Violation of these prohibitions will result in immediate account suspension and potential legal action."
        },
        {
          title: "Limitation of Liability",
          content: "Andiamo Events is not responsible for: incidents, injuries, or damages occurring at event venues, the quality, safety, or conduct of events organized by third parties, decisions made by event organizers or venue staff, technical issues with QR code scanning equipment at venues, or any losses resulting from event cancellations or changes. You attend events at your own risk."
        },
        {
          title: "Termination",
          content: "We reserve the right to refuse service, cancel orders, or block access to our platform at any time for violation of these Terms, fraudulent activity, or any behavior we deem harmful to our platform or other users. Any pending orders may be canceled if service is terminated."
        },
        {
          title: "Governing Law",
          content: "These Terms of Service are governed by and construed in accordance with the laws of Tunisia. Any disputes arising from these terms or your use of our platform will be subject to the exclusive jurisdiction of Tunisian courts."
        },
        {
          title: "Contact Us",
          content: "If you have any questions about these Terms of Service, please contact us at contact@andiamoevents.com"
        }
      ]
    },
    fr: {
      title: "Conditions d'Utilisation",
      lastUpdated: "Dernière mise à jour : janvier 2025",
      sections: [
        {
          title: "Acceptation des Conditions",
          content: "En accédant ou en utilisant la plateforme Andiamo Events, vous acceptez d'être lié par ces Conditions d'Utilisation, notre Politique de Confidentialité et notre Politique de Remboursement et d'Annulation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services."
        },
        {
          title: "Description de la Plateforme",
          content: "Andiamo Events fonctionne comme une plateforme de billetterie et de promotion connectant les organisateurs d'événements aux participants. Nous facilitons les ventes de billets, le traitement des paiements et les services de gestion d'événements. Nous ne sommes pas les organisateurs des événements listés sur notre plateforme sauf indication explicite."
        },
        {
          title: "Informations Utilisateur",
          content: "Vous acceptez de fournir des informations exactes, actuelles et complètes lors de la passation de commandes. Vous êtes responsable de vous assurer que les informations que vous fournissez (nom, numéro de téléphone, email, adresse) sont correctes et à jour. Fournir de fausses informations ou trompeuses peut entraîner l'annulation de la commande ou le refus du service."
        },
        {
          title: "Achat et Utilisation des Billets",
          content: "Les billets sont disponibles en catégories Standard et VIP. Chaque billet accorde l'entrée pour une personne à l'événement spécifié. Lors de l'achat, vous recevrez un code QR unique qui doit être présenté au lieu de l'événement. Les codes QR ne sont pas transférables et ne peuvent être scannés qu'une seule fois. Tenter d'utiliser des billets en double ou frauduleux entraînera un refus d'entrée et des poursuites judiciaires potentielles."
        },
        {
          title: "Règles d'Entrée aux Événements",
          content: "L'entrée aux événements est soumise aux restrictions d'âge spécifiées pour chaque événement. L'entrée tardive peut être refusée à la discrétion de l'organisateur. Les organisateurs d'événements et le personnel du lieu ont l'autorité finale pour refuser l'entrée pour quelque raison que ce soit, y compris mais sans s'y limiter : violation du code vestimentaire, comportement perturbateur, ivresse ou non-respect des exigences d'âge. Andiamo Events n'est pas responsable des décisions d'entrée prises par les organisateurs ou le personnel du lieu."
        },
        {
          title: "Système d'Ambassadeurs",
          content: "Les ambassadeurs agissent comme des partenaires indépendants facilitant les commandes en paiement à la livraison (COD). Lorsque vous passez une commande COD, elle sera assignée à un ambassadeur disponible en utilisant notre système d'assignation automatisé. Les ambassadeurs sont responsables de confirmer et de livrer votre commande. Si un ambassadeur annule votre commande, elle sera automatiquement réassignée à un autre ambassadeur disponible. L'abus, la fraude ou la violation de nos politiques par les ambassadeurs entraînera une suspension immédiate de notre plateforme."
        },
        {
          title: "Modifications d'Événements",
          content: "Les organisateurs d'événements peuvent modifier les dates, heures, lieux des événements ou annuler des événements. Andiamo Events n'est pas responsable de ces modifications. En cas d'annulation ou de modifications importantes, l'organisateur est responsable de communiquer avec les détenteurs de billets et de déterminer les options de remboursement ou de remplacement. Nous faciliterons la communication mais ne sommes pas responsables des décisions des organisateurs."
        },
        {
          title: "Activités Interdites",
          content: "Vous acceptez de ne pas : revendre des billets à des prix supérieurs au prix facial, créer de fausses réservations ou commandes, manipuler les systèmes de scan de codes QR, harceler ou menacer d'autres utilisateurs, ambassadeurs ou personnel, utiliser des systèmes automatisés pour acheter des billets, ou vous engager dans toute activité frauduleuse. La violation de ces interdictions entraînera une suspension immédiate du compte et des poursuites judiciaires potentielles."
        },
        {
          title: "Limitation de Responsabilité",
          content: "Andiamo Events n'est pas responsable de : incidents, blessures ou dommages survenant dans les lieux d'événements, la qualité, la sécurité ou la conduite des événements organisés par des tiers, les décisions prises par les organisateurs d'événements ou le personnel du lieu, les problèmes techniques avec les équipements de scan de codes QR dans les lieux, ou toute perte résultant d'annulations ou de modifications d'événements. Vous assistez aux événements à vos propres risques."
        },
        {
          title: "Résiliation",
          content: "Nous nous réservons le droit de refuser le service, d'annuler les commandes ou de bloquer l'accès à notre plateforme à tout moment pour violation de ces Conditions, activité frauduleuse ou tout comportement que nous jugeons nuisible à notre plateforme ou à d'autres utilisateurs. Toute commande en attente peut être annulée si le service est résilié."
        },
        {
          title: "Loi Applicable",
          content: "Ces Conditions d'Utilisation sont régies par et interprétées conformément aux lois de la Tunisie. Tout litige découlant de ces conditions ou de votre utilisation de notre plateforme sera soumis à la juridiction exclusive des tribunaux tunisiens."
        },
        {
          title: "Nous contacter",
          content: "Si vous avez des questions concernant ces Conditions d'Utilisation, veuillez nous contacter à contact@andiamoevents.com"
        }
      ]
    }
  };

  const content = termsContent.title ? termsContent : defaultContent[language];

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

export default Terms; 