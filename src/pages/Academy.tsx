import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AcademyPageDisabled from '@/components/academy/AcademyPageDisabled';
import AcademyHero from '@/components/academy/AcademyHero';
import AcademyPricing from '@/components/academy/AcademyPricing';
import AcademyProgram from '@/components/academy/AcademyProgram';
import AcademyFaq from '@/components/academy/AcademyFaq';
import { PageMeta } from '@/components/PageMeta';
import { JsonLdBreadcrumb } from '@/components/JsonLd';
import Loader from '@/components/ui/Loader';
import { useAcademyPublicStatus } from '@/hooks/useAcademyPublicStatus';
import { PAGE_DESCRIPTIONS } from '@/lib/seo';
import { buildAcademyRegisterPath } from '@/lib/academy/academyUtils';
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

  return (
    <main className="pt-16 min-h-screen bg-background animate-page-intro" id="main-content">
      <PageMeta
        title={language === 'en' ? 'Academy' : 'Académie'}
        description={PAGE_DESCRIPTIONS.academy[language]}
        path="/academy"
      />
      <JsonLdBreadcrumb
        items={[
          { name: language === 'en' ? 'Home' : 'Accueil', url: '/' },
          { name: language === 'en' ? 'Academy' : 'Académie', url: '/academy' },
        ]}
      />
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader size="lg" />
        </div>
      ) : !registrationsOpen ? (
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
