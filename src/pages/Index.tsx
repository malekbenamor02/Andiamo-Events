import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import placeholder from "/placeholder.svg";
import { supabase } from "@/integrations/supabase/client";
import CounterSection from "@/components/home/CounterSection";
import FeaturedEventsSection from "@/components/home/FeaturedEventsSection";
import TeamSection from "@/components/home/TeamSection";
import SponsorsSection from "@/components/home/SponsorsSection";

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
  whatsapp_link?: string;
}

interface IndexProps {
  language: 'en' | 'fr';
}

const Index = ({ language }: IndexProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [counters, setCounters] = useState({ events: 0, members: 0, followers: 0});
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  
  // Refs for each section
  const heroRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const sponsorsRef = useRef<HTMLDivElement>(null);

  const targetCounts = { events: 20, members: 40, followers: 25000};

  // Scroll to top when page loads/refreshes
  useEffect(() => {
    window.scrollTo(0, 0);
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
      { ref: teamRef, id: 'team' },
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

  useEffect(() => {
    const fetchFeaturedEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('featured', true)
        .order('date', { ascending: true });
      if (!error && data) setFeaturedEvents(data);
    };
    fetchFeaturedEvents();
  }, []);

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
    <div className="pt-16">
      {/* Hero Section with Scroll Animation */}
      <div 
        ref={heroRef}
        className={`transform transition-all duration-1000 ease-out ${
          animatedSections.has('hero') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        <HeroSection language={language} />
      </div>

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
      
      {/* Team Section with Scroll Animation */}
      <div 
        ref={teamRef}
        className={`transform transition-all duration-1000 ease-out ${
          animatedSections.has('team') 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        <TeamSection language={language} />
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
  );
};

export default Index;
