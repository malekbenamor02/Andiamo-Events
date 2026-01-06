interface RefundPolicyProps {
  language: 'en' | 'fr';
}

const RefundPolicy = ({ language }: RefundPolicyProps) => {
  const content = {
    fr: {
      title: "Politique de Remboursement & Annulation",
      sections: [
        {
          title: "1. Politique de remboursement",
          content: [
            "Sauf mention contraire explicite, les billets ne sont ni échangeables ni remboursables, y compris en cas :",
            "• d'empêchement personnel,",
            "• de retard,",
            "• d'absence le jour de l'événement.",
            "Toute contestation de paiement initiée auprès de la banque ou du prestataire de paiement sans contact préalable avec l'Organisateur pourra entraîner le refus de la demande."
          ]
        },
        {
          title: "2. Annulation ou report d'événement",
          content: [
            "En cas d'annulation ou de report d'un événement par l'Organisateur, les modalités applicables (remboursement, report ou avoir) seront communiquées par les canaux officiels d'Andiamo Events.",
            "Aucun frais annexe (transport, hébergement, restauration ou autres) ne pourra être réclamé à l'Organisateur."
          ]
        }
      ]
    },
    en: {
      title: "Refund & Cancellation Policy",
      sections: [
        {
          title: "1. Refund Policy",
          content: [
            "Unless explicitly stated otherwise, tickets are neither exchangeable nor refundable, including in cases of:",
            "• personal inability to attend,",
            "• lateness,",
            "• absence on the day of the event.",
            "Any payment dispute initiated with the bank or the payment service provider without prior contact with the Organizer may result in refusal of the request."
          ]
        },
        {
          title: "2. Event Cancellation or Postponement",
          content: [
            "In the event of cancellation or postponement of an event by the Organizer, the applicable terms (refund, postponement, or credit) will be communicated through Andiamo Events' official channels.",
            "No additional expenses (transportation, accommodation, catering, or others) may be claimed from the Organizer."
          ]
        }
      ]
    }
  };

  const pageContent = content[language];

  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-4 uppercase">
            {pageContent.title}
          </h1>
        </div>

        <div className="prose prose-lg max-w-none">
          <div className="space-y-8 text-foreground/80 leading-relaxed">
            {pageContent.sections.map((section, index) => (
              <div key={index} className="border-b border-border/20 pb-6 last:border-b-0">
                <h2 className="text-2xl font-bold text-primary mb-4 uppercase">{section.title}</h2>
                <div className="space-y-3">
                  {section.content.map((paragraph, pIndex) => (
                    <p key={pIndex} className={paragraph.startsWith('•') ? 'ml-4' : ''}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/20 text-center">
          <a href="/" className="text-primary hover:text-primary/80 underline transition-colors">
            {language === 'en' ? 'Return to Home' : "Retour à l'Accueil"}
          </a>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
