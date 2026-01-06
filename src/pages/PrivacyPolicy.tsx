interface PrivacyPolicyProps {
  language: 'en' | 'fr';
}

const PrivacyPolicy = ({ language }: PrivacyPolicyProps) => {
  const content = {
    fr: {
      title: "Politique de Confidentialité",
      sections: [
        {
          title: "13. Données personnelles",
          content: [
            "Les données personnelles collectées sont utilisées exclusivement pour :",
            "• le traitement des commandes,",
            "• la gestion des accès aux événements,",
            "• la communication liée aux événements Andiamo Events.",
            "Elles ne sont ni vendues ni cédées à des tiers non autorisés."
          ]
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      sections: [
        {
          title: "13. Personal Data",
          content: [
            "Personal data collected is used exclusively for:",
            "• order processing,",
            "• event access management,",
            "• communication related to Andiamo Events events.",
            "Such data is neither sold nor transferred to unauthorized third parties."
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

export default PrivacyPolicy;
