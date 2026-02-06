import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import HeroSection from "@/components/home/HeroSection";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdWebPage } from "@/components/JsonLd";
import placeholder from "/placeholder.svg";
import { supabase } from "@/integrations/supabase/client";
import CounterSection from "@/components/home/CounterSection";
import FeaturedEventsSection from "@/components/home/FeaturedEventsSection";
import SponsorsSection from "@/components/home/SponsorsSection";
import LoadingScreen from "@/components/ui/LoadingScreen";

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url?: string;
  ticket_link?: string;
  featured?: boolean;
  instagram_link?: string; // Changed from whatsapp_link to instagram_link
  whatsapp_link?: string; // Keep for backward compatibility
}

interface IndexProps {
  language: 'en' | 'fr';
}

const INDEX_META = {
  title: "Andiamo Events | Nightlife & Events in Tunisia – We Create Memories",
  description:
    "Andiamo Events – Tunisia's premier nightlife & events. Discover upcoming parties, concerts and experiences. Buy tickets online. We create memories.",
};

const Index = ({ language }: IndexProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [counters, setCounters] = useState({ events: 0, members: 0, followers: 0});
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set(['hero']));
  const [heroMediaLoaded, setHeroMediaLoaded] = useState(false);
  
  // Show loader instantly - prevent blank screen
  useEffect(() => {
    // Force immediate render of loader by ensuring state is set
    // This prevents any flash of unstyled content
  }, []);
  
  // Refs for each section
  const heroRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const sponsorsRef = useRef<HTMLDivElement>(null);

  const targetCounts = { events: 20, members: 40, followers: 45000};

  // Scroll to top when page loads/refreshes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Ensure hero section is visible immediately on page load
  useEffect(() => {
    setAnimatedSections(prev => new Set([...prev, 'hero']));
  }, []);

  // Scroll-triggered animations using Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section');
            if (sectionId) {
              setAnimatedSections(prev => new Set([...prev, sectionId]));
              
              // Trigger counter animation when counter section is visible
              if (sectionId === 'counter') {
                animateCounters();
              }
            }
          }
        });
      },
      { 
        threshold: 0.3, // Trigger when 30% of section is visible
        rootMargin: '0px 0px -50px 0px' // Trigger slightly before section comes into view
      }
    );

    // Observe all sections
    const sections = [
      { ref: heroRef, id: 'hero' },
      { ref: counterRef, id: 'counter' },
      { ref: eventsRef, id: 'events' },
      { ref: sponsorsRef, id: 'sponsors' }
    ];

    sections.forEach(({ ref, id }) => {
      if (ref.current) {
        ref.current.setAttribute('data-section', id);
        observer.observe(ref.current);
    }
    });

    return () => observer.disconnect();
  }, []);

  // Lazy load featured events - only after hero is loaded
  // This is non-critical content that shouldn't block the initial render
  useEffect(() => {
    if (!heroMediaLoaded) return; // Wait for hero to load first
    
    const fetchFeaturedEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('featured', true)
        .order('date', { ascending: true });
      if (!error && data) setFeaturedEvents(data);
    };
    fetchFeaturedEvents();
  }, [heroMediaLoaded]);

  const animateCounters = () => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepDuration = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;

      setCounters({
        events: Math.floor(targetCounts.events * progress),
        members: Math.floor(targetCounts.members * progress),
        followers: Math.floor(targetCounts.followers * progress)
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounters(targetCounts);
      }
    }, stepDuration);
  };

  return (
    <main className="relative" id="main-content">
      <PageMeta title={INDEX_META.title} description={INDEX_META.description} path="/" />
      <JsonLdWebPage
        name="Andiamo Events – Nightlife & Events in Tunisia | Buy Tickets"
        description="Andiamo Events – Tunisia's premier nightlife and events. Discover upcoming concerts, parties and festivals in Tunis, Sousse and across Tunisia. Buy tickets online. We create memories."
        path="/"
      />
      {/* Loading Screen - Appears instantly to prevent blank screen */}
      {/* Only waits for critical hero assets: images (decoded) + videos (first frame) */}
      {!heroMediaLoaded && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center min-h-screen bg-black">
          <LoadingScreen 
            variant="default" 
            text="Loading Experience..." 
            size="fullscreen"
          />
        </div>
      )}

      {/* Main Content - Smooth fade transition when critical hero assets are ready */}
      {/* Layout is pre-calculated, media is decoded/ready - no reflow or jumping */}
      <div 
        className={`transition-opacity duration-500 ease-out ${
          heroMediaLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          visibility: heroMediaLoaded ? 'visible' : 'hidden',
        }}
      >
        {/* Hero Section with Scroll Animation - positioned behind navbar */}
        <div 
          ref={heroRef}
          className="transform transition-all duration-1000 ease-out opacity-100 translate-y-0 scale-100"
          style={{ position: 'relative', zIndex: 0 }}
        >
        <HeroSection language={language} onMediaLoaded={() => setHeroMediaLoaded(true)} />
        </div>

      {/* SEO: Keyword-rich intro + internal links */}
      <section className="py-10 px-4 sm:px-6 lg:px-8 bg-background/50" aria-label={language === "en" ? "About Andiamo Events" : "À propos d'Andiamo Events"}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {language === "en" ? (
              <>
                <strong className="text-foreground">Andiamo Events</strong> is Tunisia's leading event and nightlife brand. Discover{" "}
                <Link to="/events" className="text-primary font-medium hover:underline">upcoming events</Link>
                {" "}— concerts, parties and festivals in <strong className="text-foreground">Tunis</strong>, <strong className="text-foreground">Sousse</strong> and across Tunisia.{" "}
                <Link to="/about" className="text-primary font-medium hover:underline">Learn more about us</Link>
                {" "}or <Link to="/contact" className="text-primary font-medium hover:underline">get in touch</Link>. Buy tickets online and create memories.
              </>
            ) : (
              <>
                <strong className="text-foreground">Andiamo Events</strong> est la marque tunisienne d'événements et de vie nocturne. Découvrez nos{" "}
                <Link to="/events" className="text-primary font-medium hover:underline">prochains événements</Link>
                {" "}— concerts, soirées et festivals à <strong className="text-foreground">Tunis</strong>, <strong className="text-foreground">Sousse</strong> et en Tunisie.{" "}
                <Link to="/about" className="text-primary font-medium hover:underline">En savoir plus</Link>
                {" "}ou <Link to="/contact" className="text-primary font-medium hover:underline">nous contacter</Link>. Achetez vos billets en ligne.
              </>
            )}
          </p>
        </div>
      </section>

      {/* Counter Section with Scroll Animation */}
      <div 
        ref={counterRef}
        className={`transform transition-all duration-1000 ease-out ${
          animatedSections.has('counter') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
      <CounterSection language={language} />
      </div>
      
      {/* Featured Events Section with Scroll Animation */}
      <div 
        ref={eventsRef}
        className={`transform transition-all duration-1000 ease-out ${
          animatedSections.has('events') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
      <FeaturedEventsSection language={language} />
      </div>

      {/* Sponsors Section with Scroll Animation */}
      <div 
        ref={sponsorsRef}
        className={`transform transition-all duration-1000 ease-out ${
          animatedSections.has('sponsors') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
      <SponsorsSection language={language} />
      </div>
      </div>
    </main>
  );
};

export default Index;
