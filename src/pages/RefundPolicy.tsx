import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RefundPolicyProps {
  language: 'en' | 'fr';
}

interface Section {
  title: string;
  content: string;
}

interface RefundPolicyContent {
  title?: string;
  lastUpdated?: string;
  sections?: Section[];
  [key: string]: string | Section[] | undefined;
}

const RefundPolicy = ({ language }: RefundPolicyProps) => {
  const [refundContent, setRefundContent] = useState<RefundPolicyContent>({});

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'refund_policy')
          .maybeSingle();
        
        // If no data or error, use default content (already set in state)
        if (error) {
          // Only log non-404/406 errors (missing content is expected)
          if (error.code !== 'PGRST116' && error.message?.includes('406') === false) {
            console.error('Error fetching refund policy content:', error);
          }
          return;
        }
        
        if (data?.content) {
          setRefundContent(data.content as RefundPolicyContent);
        }
      } catch (error) {
        // Silently use default content if fetch fails
      }
    };
    fetchContent();
  }, []);

  const defaultContent = {
    en: {
      title: "Refund & Cancellation Policy",
      lastUpdated: "Last updated: January 2025",
      sections: [
        {
          title: "General Policy",
          content: "Tickets purchased through Andiamo Events are non-refundable unless explicitly stated otherwise at the time of purchase or as required by law. By purchasing a ticket, you acknowledge and agree to this policy."
        },
        {
          title: "Event Cancellation",
          content: "If an event is canceled by the organizer, the refund or replacement policy will be determined by the event organizer. Andiamo Events will facilitate communication between the organizer and ticket holders, but the final decision regarding refunds or replacements rests with the organizer. We are not responsible for organizer decisions regarding cancellations."
        },
        {
          title: "Customer Cancellations",
          content: "No refunds will be provided for: customer no-shows, tickets that have been scanned at the event venue, entry refusal due to age restrictions or other venue policies, change of mind or personal circumstances, or tickets purchased for the wrong event. Once a ticket is scanned, it is considered used and cannot be refunded."
        },
        {
          title: "COD Orders",
          content: "Cash on Delivery (COD) orders can be canceled before an ambassador confirms the order. Once an ambassador has confirmed your COD order, cancellation is not guaranteed and may be subject to the ambassador's discretion. If you need to cancel a confirmed COD order, contact us immediately at contact@andiamoevents.com."
        },
        {
          title: "Ambassador Cancellations",
          content: "If an ambassador cancels your COD order before delivery, your order will be automatically reassigned to another available ambassador. You will be notified of the reassignment. If no ambassador is available, your order may be canceled and you will be notified accordingly."
        },
        {
          title: "Force Majeure",
          content: "In cases of force majeure including but not limited to: severe weather conditions, natural disasters, government restrictions, security threats, pandemics, or other circumstances beyond our control, refund policies will be determined on a case-by-case basis. Event organizers will make the final decision regarding refunds in such situations."
        },
        {
          title: "Contact Us",
          content: "For refund requests or questions about this policy, please contact us at contact@andiamoevents.com. Please include your order number and a detailed explanation of your request."
        }
      ]
    },
    fr: {
      title: "Politique de Remboursement et d'Annulation",
      lastUpdated: "Dernière mise à jour : janvier 2025",
      sections: [
        {
          title: "Politique Générale",
          content: "Les billets achetés via Andiamo Events ne sont pas remboursables sauf indication explicite contraire au moment de l'achat ou selon les exigences légales. En achetant un billet, vous reconnaissez et acceptez cette politique."
        },
        {
          title: "Annulation d'Événement",
          content: "Si un événement est annulé par l'organisateur, la politique de remboursement ou de remplacement sera déterminée par l'organisateur de l'événement. Andiamo Events facilitera la communication entre l'organisateur et les détenteurs de billets, mais la décision finale concernant les remboursements ou les remplacements appartient à l'organisateur. Nous ne sommes pas responsables des décisions des organisateurs concernant les annulations."
        },
        {
          title: "Annulations Client",
          content: "Aucun remboursement ne sera fourni pour : les absences de clients, les billets qui ont été scannés au lieu de l'événement, le refus d'entrée dû aux restrictions d'âge ou autres politiques du lieu, le changement d'avis ou les circonstances personnelles, ou les billets achetés pour le mauvais événement. Une fois qu'un billet est scanné, il est considéré comme utilisé et ne peut pas être remboursé."
        },
        {
          title: "Commandes COD",
          content: "Les commandes en paiement à la livraison (COD) peuvent être annulées avant qu'un ambassadeur ne confirme la commande. Une fois qu'un ambassadeur a confirmé votre commande COD, l'annulation n'est pas garantie et peut être soumise à la discrétion de l'ambassadeur. Si vous devez annuler une commande COD confirmée, contactez-nous immédiatement à contact@andiamoevents.com."
        },
        {
          title: "Annulations d'Ambassadeurs",
          content: "Si un ambassadeur annule votre commande COD avant la livraison, votre commande sera automatiquement réassignée à un autre ambassadeur disponible. Vous serez notifié de la réassignation. Si aucun ambassadeur n'est disponible, votre commande peut être annulée et vous serez notifié en conséquence."
        },
        {
          title: "Force Majeure",
          content: "En cas de force majeure incluant mais sans s'y limiter : conditions météorologiques sévères, catastrophes naturelles, restrictions gouvernementales, menaces de sécurité, pandémies ou autres circonstances indépendantes de notre volonté, les politiques de remboursement seront déterminées au cas par cas. Les organisateurs d'événements prendront la décision finale concernant les remboursements dans de telles situations."
        },
        {
          title: "Nous contacter",
          content: "Pour les demandes de remboursement ou les questions concernant cette politique, veuillez nous contacter à contact@andiamoevents.com. Veuillez inclure votre numéro de commande et une explication détaillée de votre demande."
        }
      ]
    }
  };

  const content = refundContent.title ? refundContent : defaultContent[language];

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

export default RefundPolicy;

