import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import AcademyPageDisabled from '@/components/academy/AcademyPageDisabled';
import { PageMeta } from '@/components/PageMeta';
import { JsonLdBreadcrumb } from '@/components/JsonLd';
import { ACADEMY_TERMS_SECTIONS, ACADEMY_TERMS_UI } from '@/data/academyTermsContent';
import { ACADEMY_REGISTER_PATH, ACADEMY_TERMS_PATH, pickLocalized } from '@/lib/academy/academyUtils';
import Loader from '@/components/ui/Loader';
import { useAcademyPublicStatus } from '@/hooks/useAcademyPublicStatus';
import { PAGE_DESCRIPTIONS } from '@/lib/seo';
import { cn } from '@/lib/utils';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyTermsProps {
  language: AcademyLanguage;
}

const AcademyTerms = ({ language }: AcademyTermsProps) => {
  const ui = ACADEMY_TERMS_UI;
  const { loading, enabled, message } = useAcademyPublicStatus(language);

  if (loading) {
    return (
      <main className="pt-16 min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="pt-16 min-h-screen bg-gradient-dark">
        <AcademyPageDisabled language={language} message={message} />
      </main>
    );
  }

  return (
    <main
      className="pt-16 min-h-screen bg-gradient-dark relative overflow-hidden animate-page-intro"
      id="main-content"
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
      </div>

      <PageMeta
        title={pickLocalized(ui.metaTitle, language)}
        description={PAGE_DESCRIPTIONS.academyTerms[language]}
        path={ACADEMY_TERMS_PATH}
      />
      <JsonLdBreadcrumb
        items={[
          { name: language === 'en' ? 'Home' : 'Accueil', url: '/' },
          { name: language === 'en' ? 'Academy' : 'Académie', url: '/academy' },
          { name: pickLocalized(ui.metaTitle, language), url: ACADEMY_TERMS_PATH },
        ]}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 pb-20">
        <Link
          to="/academy"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {pickLocalized(ui.backAcademy, language)}
        </Link>

        <header className="text-center mb-10 space-y-3">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary tracking-tight">
            {pickLocalized(ui.title, language)}
          </h1>
          <p className="text-muted-foreground">{pickLocalized(ui.subtitle, language)}</p>
          <p className="text-xs text-muted-foreground/80">
            {pickLocalized(ui.lastUpdatedLabel, language)}: {pickLocalized(ui.lastUpdated, language)}
          </p>
        </header>

        <div className="rounded-2xl border border-primary/25 bg-card/40 backdrop-blur-md p-6 sm:p-8 mb-10 shadow-[0_8px_40px_hsl(var(--primary)/0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-primary mb-3">
            {pickLocalized(ui.summaryTitle, language)}
          </h2>
          <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
            {pickLocalized(ui.summary, language)}
          </p>
        </div>

        <div className="space-y-8">
          {ACADEMY_TERMS_SECTIONS.map((section) => (
            <section
              key={pickLocalized(section.title, 'en')}
              className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-6 sm:p-7"
            >
              <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground mb-4">
                {pickLocalized(section.title, language)}
              </h2>
              <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                {section.blocks.map((block, index) =>
                  block.type === 'p' ? (
                    <p key={index}>{pickLocalized(block.text, language)}</p>
                  ) : (
                    <ul key={index} className="list-disc pl-5 space-y-1.5">
                      {block.items.map((item) => (
                        <li key={pickLocalized(item, 'en')}>{pickLocalized(item, language)}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/academy"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {pickLocalized(ui.backAcademy, language)}
          </Link>
          <span className="hidden sm:inline text-border" aria-hidden>
            |
          </span>
          <Link
            to={ACADEMY_REGISTER_PATH}
            className={cn(
              'inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium',
              'btn-gradient'
            )}
          >
            {pickLocalized(ui.backRegister, language)}
          </Link>
        </div>
      </div>
    </main>
  );
};

export default AcademyTerms;
