interface TermsProps {
  language: 'en' | 'fr';
}

const Terms = ({ language }: TermsProps) => {
  const content = {
    fr: {
      title: "Conditions Générales de Vente (CGV)",
      organization: "Andiamo Events",
      sections: [
        {
          title: "1. Organisation",
          content: [
            "Les événements proposés sur le site Andiamo Events sont organisés par Born To Lead (BTL), ci-après dénommé « l'Organisateur ».",
            "Contact : contact@andiamoevents.com"
          ]
        },
        {
          title: "2. Objet",
          content: [
            "Les présentes Conditions Générales de Vente (CGV) ont pour objet de définir les conditions de vente, de paiement et d'utilisation des billets et services proposés par Andiamo Events via son site web et ses canaux officiels.",
            "Toute commande implique l'acceptation pleine, entière et sans réserve des présentes CGV."
          ]
        },
        {
          title: "3. Produits et services",
          content: [
            "Andiamo Events propose principalement :",
            "• des billets d'accès à des événements culturels, artistiques ou festifs,",
            "• des pass ou accès spécifiques selon les événements,",
            "• des services liés à l'organisation des événements.",
            "Les informations essentielles (date, lieu, horaires, conditions d'accès) sont précisées pour chaque événement."
          ]
        },
        {
          title: "4. Prix",
          content: [
            "Les prix sont indiqués en dinar tunisien (TND), toutes taxes comprises, sauf indication contraire.",
            "L'Organisateur se réserve le droit de modifier les prix à tout moment. Le prix facturé est celui en vigueur au moment de la validation de la commande."
          ]
        },
        {
          title: "5. Commande",
          content: [
            "La commande est considérée comme définitive dès validation du paiement.",
            "Le client est responsable de l'exactitude des informations fournies, notamment de l'adresse email utilisée pour la réception du billet électronique."
          ]
        },
        {
          title: "6. Paiement",
          content: [
            "Le paiement s'effectue en ligne via les moyens de paiement proposés sur le site, notamment par l'intermédiaire d'un prestataire de services de paiement agréé.",
            "Toute commande non réglée intégralement ne sera ni confirmée ni traitée."
          ]
        },
        {
          title: "7. Rôle du prestataire de paiement",
          content: [
            "Les paiements sont traités par un prestataire de services de paiement tiers, notamment Flouci, agissant exclusivement en qualité d'intermédiaire technique.",
            "Le prestataire de paiement n'intervient en aucun cas dans l'organisation, la gestion, la livraison ou le déroulement des événements.",
            "Toute réclamation, contestation ou demande de remboursement liée à un événement ou à un billet doit être adressée directement à l'Organisateur.",
            "La responsabilité du prestataire de paiement ne saurait être engagée en cas d'annulation, de report, de modification ou de litige lié à l'événement."
          ]
        },
        {
          title: "8. Billets électroniques et QR Code (accès obligatoire)",
          content: [
            "L'accès aux événements Andiamo Events est strictement conditionné à la présentation d'un QR code valide.",
            "Après confirmation du paiement, un billet électronique contenant un QR code unique est envoyé par email à l'adresse communiquée lors de la commande.",
            "Même en cas de remise d'un billet physique, un QR code est systématiquement envoyé par email et constitue la référence principale et obligatoire pour le contrôle d'accès.",
            "Le QR code peut être présenté :",
            "• sur un support numérique (téléphone, tablette),",
            "• ou sous forme imprimée.",
            "L'absence de QR code valide, même en possession d'un billet physique, peut entraîner un refus d'accès sans remboursement.",
            "Chaque QR code est personnel, unique et valable pour une seule entrée.",
            "Toute tentative de duplication, de fraude ou de revente entraînera l'invalidation immédiate du billet."
          ]
        },
        {
          title: "11. Accès et comportement",
          content: [
            "L'Organisateur se réserve le droit de refuser l'accès ou d'exclure toute personne dont le comportement est jugé :",
            "• dangereux,",
            "• inapproprié,",
            "• contraire aux règles de sécurité ou au bon déroulement de l'événement.",
            "Toute exclusion se fait sans remboursement."
          ]
        },
        {
          title: "12. Responsabilité",
          content: [
            "L'Organisateur décline toute responsabilité en cas :",
            "• de perte, vol ou détérioration d'effets personnels,",
            "• d'incident causé par le participant,",
            "• de force majeure ou de décisions administratives indépendantes de sa volonté."
          ]
        },
        {
          title: "14. Propriété intellectuelle",
          content: [
            "L'ensemble des contenus présents sur le site Andiamo Events (textes, visuels, logos, vidéos, concepts) est la propriété exclusive de l'Organisateur.",
            "Toute reproduction ou utilisation sans autorisation préalable est strictement interdite."
          ]
        },
        {
          title: "15. Droit applicable",
          content: [
            "Les présentes Conditions Générales de Vente sont soumises au droit tunisien.",
            "À défaut de résolution amiable, tout litige sera soumis aux juridictions compétentes en Tunisie."
          ]
        },
        {
          title: "16. Acceptation des CGV",
          content: [
            "La validation de la commande vaut acceptation pleine et entière des présentes Conditions Générales de Vente."
          ]
        }
      ]
    },
    en: {
      title: "Terms of Service",
      organization: "Andiamo Events",
      sections: [
        {
          title: "1. Organization",
          content: [
            "The events offered on the Andiamo Events website are organized by Born To Lead (BTL), hereinafter referred to as \"the Organizer\".",
            "Contact: contact@andiamoevents.com"
          ]
        },
        {
          title: "2. Purpose",
          content: [
            "These General Terms and Conditions of Sale (GTCS) are intended to define the conditions of sale, payment and use of tickets and services offered by Andiamo Events via its website and official channels.",
            "Any order implies full, complete and unreserved acceptance of these GTCS."
          ]
        },
        {
          title: "3. Products and services",
          content: [
            "Andiamo Events mainly offers:",
            "• tickets for access to cultural, artistic or festive events,",
            "• passes or specific access according to events,",
            "• services related to event organization.",
            "Essential information (date, location, times, access conditions) is specified for each event."
          ]
        },
        {
          title: "4. Price",
          content: [
            "Prices are indicated in Tunisian dinars (TND), all taxes included, unless otherwise stated.",
            "The Organizer reserves the right to modify prices at any time. The price charged is that in effect at the time of order validation."
          ]
        },
        {
          title: "5. Order",
          content: [
            "The order is considered final upon payment validation.",
            "The customer is responsible for the accuracy of the information provided, in particular the email address used to receive the electronic ticket."
          ]
        },
        {
          title: "6. Payment",
          content: [
            "Payment is made online via the payment methods offered on the site, in particular through an approved payment service provider.",
            "Any order not paid in full will not be confirmed or processed."
          ]
        },
        {
          title: "7. Role of the payment provider",
          content: [
            "Payments are processed by a third-party payment service provider, including Flouci, acting exclusively as a technical intermediary.",
            "The payment provider does not intervene in any way in the organization, management, delivery or conduct of events.",
            "Any complaint, dispute or refund request related to an event or ticket must be addressed directly to the Organizer.",
            "The payment provider cannot be held liable in the event of cancellation, postponement, modification or dispute related to the event."
          ]
        },
        {
          title: "8. Electronic tickets and QR Code (mandatory access)",
          content: [
            "Access to Andiamo Events events is strictly conditional on the presentation of a valid QR code.",
            "After payment confirmation, an electronic ticket containing a unique QR code is sent by email to the address provided when ordering.",
            "Even in the case of delivery of a physical ticket, a QR code is systematically sent by email and constitutes the main and mandatory reference for access control.",
            "The QR code can be presented:",
            "• on a digital medium (phone, tablet),",
            "• or in printed form.",
            "The absence of a valid QR code, even if in possession of a physical ticket, may result in refusal of access without refund.",
            "Each QR code is personal, unique and valid for a single entry.",
            "Any attempt at duplication, fraud or resale will result in immediate ticket invalidation."
          ]
        },
        {
          title: "11. Access and behavior",
          content: [
            "The Organizer reserves the right to refuse access or exclude any person whose behavior is deemed:",
            "• dangerous,",
            "• inappropriate,",
            "• contrary to safety rules or the proper conduct of the event.",
            "Any exclusion is made without refund."
          ]
        },
        {
          title: "12. Liability",
          content: [
            "The Organizer disclaims all liability in the event of:",
            "• loss, theft or deterioration of personal effects,",
            "• incident caused by the participant,",
            "• force majeure or administrative decisions independent of its will."
          ]
        },
        {
          title: "14. Intellectual property",
          content: [
            "All content on the Andiamo Events website (texts, visuals, logos, videos, concepts) is the exclusive property of the Organizer.",
            "Any reproduction or use without prior authorization is strictly prohibited."
          ]
        },
        {
          title: "15. Applicable law",
          content: [
            "These General Terms and Conditions of Sale are subject to Tunisian law.",
            "In the absence of an amicable resolution, any dispute will be submitted to the competent courts in Tunisia."
          ]
        },
        {
          title: "16. Acceptance of GTCS",
          content: [
            "Order validation constitutes full and complete acceptance of these General Terms and Conditions of Sale."
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
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-4">
            {pageContent.title}
          </h1>
          <p className="text-lg font-semibold text-muted-foreground">{pageContent.organization}</p>
        </div>

        <div className="prose prose-lg max-w-none">
          <div className="space-y-8 text-foreground/80 leading-relaxed">
            {pageContent.sections.map((section, index) => (
              <div key={index} className="border-b border-border/20 pb-6 last:border-b-0">
                <h2 className="text-2xl font-semibold text-primary mb-4">{section.title}</h2>
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

export default Terms;
