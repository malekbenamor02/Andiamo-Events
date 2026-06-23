import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AcademyPageDisabled from '@/components/academy/AcademyPageDisabled';
import AcademyHero from '@/components/academy/AcademyHero';
import AcademyPricing from '@/components/academy/AcademyPricing';
import AcademyProgram from '@/components/academy/AcademyProgram';
import AcademyFaq from '@/components/academy/AcademyFaq';
import { PageMeta } from '@/components/PageMeta';
import { JsonLdBreadcrumb, JsonLdCourse, JsonLdFAQ, JsonLdWebPage } from '@/components/JsonLd';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useAcademyPublicStatus } from '@/hooks/useAcademyPublicStatus';
import { buildAcademyRegisterPath } from '@/lib/academy/academyUtils';
import {
  ACADEMY_PATH,
  ACADEMY_PAGE_DESCRIPTIONS,
  ACADEMY_PAGE_TITLES,
  buildAcademyCourseSchema,
  buildAcademyFaqSchema,
} from '@/lib/seo/academySeo';
import type { AcademyFormulaId, AcademyLanguage } from '@/types/academy';

interface AcademyProps {
  language: AcademyLanguage;
}

const Academy = ({ language }: AcademyProps) => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);
  const { loading, registrationsOpen, soldOut, message } = useAcademyPublicStatus(language);
  const contentReady = !loading && registrationsOpen;

  useEffect(() => {
    if (!contentReady) {
      setHeroVisible(false);
      return;
    }
    const el = heroRef.current;
    if (!el) {
      setHeroVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHeroVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    const fallback = window.setTimeout(() => setHeroVisible(true), 400);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [contentReady]);

  const goToRegistration = (formula?: AcademyFormulaId) => {
    navigate(buildAcademyRegisterPath(formula));
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <main className="pt-16 min-h-screen bg-background animate-page-intro" id="main-content">
      <PageMeta
        title={ACADEMY_PAGE_TITLES.main[language]}
        description={ACADEMY_PAGE_DESCRIPTIONS.main[language]}
        path={ACADEMY_PATH}
      />
      <JsonLdWebPage
        name={ACADEMY_PAGE_TITLES.main[language]}
        description={ACADEMY_PAGE_DESCRIPTIONS.main[language]}
        path={ACADEMY_PATH}
      />
      <JsonLdCourse data={buildAcademyCourseSchema(language)} />
      <JsonLdFAQ items={buildAcademyFaqSchema(language)} />
      <JsonLdBreadcrumb
        items={[
          { name: language === 'en' ? 'Home' : 'Accueil', url: '/' },
          { name: language === 'en' ? 'Academy' : 'Académie', url: ACADEMY_PATH },
        ]}
      />
      {!registrationsOpen ? (
        <AcademyPageDisabled language={language} message={message} soldOut={soldOut} />
      ) : (
        <>
          <div
            ref={heroRef}
            className={`transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <AcademyHero language={language} onCtaClick={() => goToRegistration()} />
          </div>
          <AcademyPricing language={language} onSelectFormula={goToRegistration} />
          <AcademyProgram language={language} onCtaClick={() => goToRegistration()} />
          <AcademyFaq language={language} />
        </>
      )}
    </main>
  );
};

export default Academy;
