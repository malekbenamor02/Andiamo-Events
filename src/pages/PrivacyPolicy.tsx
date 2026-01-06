interface PrivacyPolicyProps {
  language: 'en' | 'fr';
}

const PrivacyPolicy = ({ language }: PrivacyPolicyProps) => {
  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-8">
            📄 PAGE 3 — PRIVACY POLICY
          </h1>
          <p className="text-muted-foreground mb-8">(/privacy-policy)</p>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-primary mb-6">🇫🇷 POLITIQUE DE CONFIDENTIALITÉ</h2>

            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">13. Données personnelles</h3>
                <p>Les données personnelles collectées sont utilisées exclusivement pour :</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>le traitement des commandes,</li>
                  <li>la gestion des accès aux événements,</li>
                  <li>la communication liée aux événements Andiamo Events.</li>
                </ul>
                <p>Elles ne sont ni vendues ni cédées à des tiers non autorisés.</p>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-primary mb-6">🇬🇧 PRIVACY POLICY</h2>

            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">13. Personal Data</h3>
                <p>Personal data collected is used exclusively for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>order processing,</li>
                  <li>event access management,</li>
                  <li>communication related to Andiamo Events events.</li>
                </ul>
                <p>Such data is neither sold nor transferred to unauthorized third parties.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
