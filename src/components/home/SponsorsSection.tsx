import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Sponsor {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  category?: string;
}

interface SponsorsSectionProps {
  language: 'en' | 'fr';
}

const SponsorsSection = ({ language }: SponsorsSectionProps) => {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const fetchSponsors = async () => {
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .eq('is_global', true)
        .order('created_at', { ascending: true });
      if (!error && data) setSponsors(data);
    };
    fetchSponsors();
  }, []);

  if (!sponsors.length) return null;

  return (
    <section className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold mb-4 text-gradient-neon">
            {language === 'en' ? 'Our Sponsors' : 'Nos Sponsors'}
          </h2>
          <p className="text-lg text-muted-foreground">
            {language === 'en'
              ? 'We are proud to be supported by these amazing partners.'
              : 'Nous sommes fiers d\'être soutenus par ces partenaires incroyables.'}
          </p>
        </div>
        <div className="relative overflow-x-hidden">
          <div className="flex items-center gap-4 md:gap-8 animate-marquee whitespace-nowrap will-change-transform">
            {sponsors.map((sponsor, idx) => (
              <div
                key={sponsor.id + '-' + idx}
                className="rounded-lg p-6 flex flex-col items-center min-w-[220px] max-w-xs mx-2 hover:shadow-xl transition-shadow"
              >
                {sponsor.logo_url && (
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className="w-24 h-24 object-contain mb-2 rounded-lg border"
                  />
                )}
                <h3 className="font-semibold text-center mb-1">{sponsor.name}</h3>
                {sponsor.description && (
                  <p className="text-xs text-muted-foreground text-center mb-2 line-clamp-2">
                    {sponsor.description}
                  </p>
                )}
                {sponsor.website_url && (
                  <a
                    href={sponsor.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs"
                  >
                    {language === 'en' ? 'Visit Website' : 'Visiter le Site'}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-12">
          <button
            onClick={() => window.location.href = '/contact'}
            className="bg-gradient-primary text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            {language === 'en' ? 'Become a Sponsor' : 'Devenir Sponsor'}
          </button>
        </div>
      </div>
      {/* Marquee animation style */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 10s linear infinite;
        }
      `}</style>
    </section>
  );
};

export default SponsorsSection; 