import { ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AcademyPageDisabled from '@/components/academy/AcademyPageDisabled';
import AcademyRegistrationForm from '@/components/academy/AcademyRegistrationForm';
import { PageMeta } from '@/components/PageMeta';
import { JsonLdBreadcrumb, JsonLdWebPage } from '@/components/JsonLd';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useAcademyPublicStatus } from '@/hooks/useAcademyPublicStatus';
import { parseAcademyFormulaParam } from '@/lib/academy/academyUtils';
import {
  ACADEMY_PATH,
  ACADEMY_REGISTER_PATH,
  ACADEMY_PAGE_DESCRIPTIONS,
  ACADEMY_PAGE_TITLES,
} from '@/lib/seo/academySeo';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyRegistrationProps {
  language: AcademyLanguage;
}

const AcademyRegistration = ({ language }: AcademyRegistrationProps) => {
  const [searchParams] = useSearchParams();
  const selectedFormula = parseAcademyFormulaParam(searchParams.get('formula'));
  const { loading, registrationsOpen, soldOut, message } = useAcademyPublicStatus(language);

  const backLabel = language === 'en' ? 'Back to Academy' : 'Retour à l\'Académie';

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <main className="pt-16 min-h-screen bg-background animate-page-intro" id="main-content">
      <PageMeta
        title={ACADEMY_PAGE_TITLES.register[language]}
        description={ACADEMY_PAGE_DESCRIPTIONS.register[language]}
        path={ACADEMY_REGISTER_PATH}
      />
      <JsonLdWebPage
        name={ACADEMY_PAGE_TITLES.register[language]}
        description={ACADEMY_PAGE_DESCRIPTIONS.register[language]}
        path={ACADEMY_REGISTER_PATH}
      />
      <JsonLdBreadcrumb
        items={[
          { name: language === 'en' ? 'Home' : 'Accueil', url: '/' },
          { name: language === 'en' ? 'Academy' : 'Académie', url: ACADEMY_PATH },
          {
            name: language === 'en' ? 'Registration' : 'Inscription',
            url: ACADEMY_REGISTER_PATH,
          },
        ]}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <Link
          to={ACADEMY_PATH}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      </div>
      {!registrationsOpen ? (
        <AcademyPageDisabled language={language} message={message} soldOut={soldOut} />
      ) : (
        <AcademyRegistrationForm language={language} selectedFormula={selectedFormula} />
      )}
    </main>
  );
};

export default AcademyRegistration;
