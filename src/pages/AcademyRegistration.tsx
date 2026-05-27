import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AcademyPageDisabled from '@/components/academy/AcademyPageDisabled';
import AcademyRegistrationForm from '@/components/academy/AcademyRegistrationForm';
import { PageMeta } from '@/components/PageMeta';
import { JsonLdBreadcrumb } from '@/components/JsonLd';
import Loader from '@/components/ui/Loader';
import { useAcademyPublicStatus } from '@/hooks/useAcademyPublicStatus';
import { parseAcademyFormulaParam } from '@/lib/academy/academyUtils';
import { PAGE_DESCRIPTIONS } from '@/lib/seo';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyRegistrationProps {
  language: AcademyLanguage;
}

const AcademyRegistration = ({ language }: AcademyRegistrationProps) => {
  const [searchParams] = useSearchParams();
  const selectedFormula = parseAcademyFormulaParam(searchParams.get('formula'));
  const { loading, enabled, message } = useAcademyPublicStatus(language);

  const backLabel = language === 'en' ? 'Back to Academy' : 'Retour à l\'Académie';
  const pageTitle = language === 'en' ? 'Academy registration' : 'Inscription Académie';

  return (
    <main className="pt-16 min-h-screen bg-background animate-page-intro" id="main-content">
      <PageMeta
        title={pageTitle}
        description={PAGE_DESCRIPTIONS.academyRegister[language]}
        path="/academy/register"
      />
      <JsonLdBreadcrumb
        items={[
          { name: language === 'en' ? 'Home' : 'Accueil', url: '/' },
          { name: language === 'en' ? 'Academy' : 'Académie', url: '/academy' },
          { name: pageTitle, url: '/academy/register' },
        ]}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <Link
          to="/academy"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      </div>
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader size="lg" />
        </div>
      ) : !enabled ? (
        <AcademyPageDisabled language={language} message={message} />
      ) : (
        <AcademyRegistrationForm language={language} selectedFormula={selectedFormula} />
      )}
    </main>
  );
};

export default AcademyRegistration;
