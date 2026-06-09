import { useState, useEffect, useRef } from "react";
import HeroSection from "@/components/home/HeroSection";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdWebPage } from "@/components/JsonLd";
import { PAGE_DESCRIPTIONS } from "@/lib/seo";
import CounterSection from "@/components/home/CounterSection";
import FeaturedEventsSection from "@/components/home/FeaturedEventsSection";
import SponsorsSection from "@/components/home/SponsorsSection";
import { HomeCountdownBannerSection } from "@/components/countdown/HomeCountdownBannerSection";

interface IndexProps {
  language: 'en' | 'fr';
}

const Index = ({ language }: IndexProps) => {
  const [counters, setCounters] = useState({ events: 0, members: 0, followers: 0});
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set(['hero']));

  // Refs for each section
  const heroRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
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
        threshold: 0.3,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    const sections = [
      { ref: heroRef, id: 'hero' },
      { ref: counterRef, id: 'counter' },
      { ref: sponsorsRef, id: 'sponsors' },
    ];

    sections.forEach(({ ref, id }) => {
      if (ref.current) {
        ref.current.setAttribute('data-section', id);
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

  const animateCounters = () => {
    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;

      setCounters({
        events: Math.floor(targetCounts.events * progress),
        members: Math.floor(targetCounts.members * progress),
        followers: Math.floor(targetCounts.followers * progress),
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounters(targetCounts);
      }
    }, stepDuration);
  };

  return (
    <main className="relative" id="main-content">
      <PageMeta title="Andiamo Events – We Create Memories" description={PAGE_DESCRIPTIONS.home[language]} path="/" />
      <JsonLdWebPage
        name="Andiamo Events – We Create Memories"
        description={PAGE_DESCRIPTIONS.home.en}
        path="/"
      />
      <HomeCountdownBannerSection language={language} />

      {/* Clears fixed nav (4rem) + optional home countdown strip (`--site-countdown-offset`) */}
      <div
        ref={heroRef}
        className="transform transition-all duration-1000 ease-out opacity-100 translate-y-0 scale-100 pt-[calc(4rem+var(--site-countdown-offset,0px))]"
        style={{ position: 'relative', zIndex: 0 }}
      >
        <HeroSection language={language} />
      </div>

      <FeaturedEventsSection language={language} />

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
    </main>
  );
};

export default Index;
