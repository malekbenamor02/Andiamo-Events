import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight } from 'lucide-react';

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
  const [isHovered, setIsHovered] = useState(false);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  useEffect(() => {
    const fetchSponsors = async () => {
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .eq('is_global', true)
        .order('name', { ascending: true });
      if (!error && data) {
        // Sort by category first, then by name for better organization
        const sorted = [...data].sort((a, b) => {
          if (a.category && b.category && a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        });
        setSponsors(sorted);
      }
    };
    fetchSponsors();
  }, []);

  // Initialize animation once when sponsors are loaded
  useEffect(() => {
    if (!marqueeRef.current || sponsors.length === 0 || animationRef.current) return;

    const element = marqueeRef.current;
    const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const duration = isMobile 
      ? Math.max(12, sponsors.length * 2) * 1000 
      : Math.max(15, sponsors.length * 1.5) * 1000;

    // Create Web Animation API for smooth control - only once
    // Use percentage for seamless infinite loop
    animationRef.current = element.animate(
      [
        { transform: 'translateX(0%)' },
        { transform: 'translateX(-50%)' }
      ],
      {
        duration: duration,
        iterations: Infinity,
        easing: 'linear'
      }
    );

    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
      }
    };
  }, [sponsors.length]);

  // Handle pause/resume separately
  useEffect(() => {
    if (!animationRef.current) return;

    if (isHovered) {
      animationRef.current.pause();
    } else {
      animationRef.current.play();
    }
  }, [isHovered]);

  // Sponsor card component with enhanced hover effects
  const SponsorCard = ({ sponsor }: { sponsor: Sponsor }) => {
    const [isCardHovered, setIsCardHovered] = useState(false);
    const [isLinkHovered, setIsLinkHovered] = useState(false);

    return (
      <div 
        className="flex-shrink-0 w-[280px] md:w-[320px]"
        onMouseEnter={() => setIsCardHovered(true)}
        onMouseLeave={() => {
          setIsCardHovered(false);
          setIsLinkHovered(false);
        }}
      >
        <div className={`
          bg-card/50 backdrop-blur-sm rounded-xl p-6 flex flex-col items-center h-full 
          border transition-all duration-300
          ${isCardHovered 
            ? 'border-primary/70 shadow-lg shadow-primary/20 -translate-y-1 bg-card/70' 
            : 'border-border/30 hover:border-primary/50'
          }
        `}>
          {sponsor.logo_url && (
            <div className={`
              mb-4 w-28 h-28 md:w-32 md:h-32 flex items-center justify-center 
              rounded-lg p-3 border transition-all duration-300
              ${isCardHovered 
                ? 'bg-background/70 border-primary/30 scale-105' 
                : 'bg-background/50 border-border/20'
              }
            `}>
              <img
                src={sponsor.logo_url}
                alt={sponsor.name}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <h3 className={`
            font-semibold text-center mb-2 transition-colors duration-300
            ${isCardHovered ? 'text-foreground' : 'text-foreground'}
          `}>
            {sponsor.name}
          </h3>
          {sponsor.description && (
            <p className="text-sm text-muted-foreground text-center mb-3 line-clamp-2 min-h-[2.5rem]">
              {sponsor.description}
            </p>
          )}
          {sponsor.website_url && (
            <a
              href={sponsor.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-300 mt-auto
                ${isLinkHovered 
                  ? 'text-primary scale-105' 
                  : 'text-primary/80 hover:text-primary'
                }
              `}
              onMouseEnter={() => setIsLinkHovered(true)}
              onMouseLeave={() => setIsLinkHovered(false)}
            >
              <span>{language === 'en' ? 'Visit Website' : 'Visiter le Site'}</span>
              <ArrowRight 
                className={`
                  w-3.5 h-3.5 transition-transform duration-300
                  ${isLinkHovered ? 'translate-x-1' : ''}
                `} 
              />
            </a>
          )}
        </div>
      </div>
    );
  };

  if (!sponsors.length) return null;

  return (
    <section className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold mb-4 text-white">
            {language === 'en' ? 'Our Sponsors' : 'Nos Sponsors'}
          </h2>
          <p className="text-lg text-white/80">
            {language === 'en'
              ? 'We are proud to be supported by these amazing partners.'
              : 'Nous sommes fiers d\'être soutenus par ces partenaires incroyables.'}
          </p>
        </div>
        <div 
          className="relative overflow-hidden marquee-wrapper"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={() => setIsHovered(true)}
          onTouchEnd={() => setIsHovered(false)}
        >
          {/* Infinite scroll marquee container */}
          <div 
            ref={marqueeRef}
            className="flex gap-6 md:gap-8 marquee-container"
          >
            {/* First set of sponsors */}
            {sponsors.map((sponsor, idx) => (
              <SponsorCard 
                key={`first-${sponsor.id}-${idx}`} 
                sponsor={sponsor}
              />
            ))}
            {/* Duplicate set for seamless infinite scroll */}
            {sponsors.map((sponsor, idx) => (
              <SponsorCard 
                key={`second-${sponsor.id}-${idx}`} 
                sponsor={sponsor}
              />
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
      {/* Premium Infinite Marquee Animation - using Web Animation API for smooth pause/resume */}
      <style>{`
        .marquee-container {
          display: flex;
          will-change: transform;
          width: fit-content;
        }
        
        /* Ensure no transitions that could cause jumps */
        .marquee-container {
          transition: none !important;
        }
        
        /* Premium feel - subtle and elegant */
        .marquee-container * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Ensure cards don't interfere with animation */
        .marquee-container > div {
          pointer-events: auto;
        }
      `}</style>
    </section>
  );
};

export default SponsorsSection; 