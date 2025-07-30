import { useState, useEffect } from "react";
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
  const [hasAnimated, setHasAnimated] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);

  const targetCounts = { events: 20, members: 40, followers: 25000};

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            animateCounters();
          }
        });
      },
      { threshold: 0.5 }
    );

    const counterSection = document.getElementById('counter-section');
    if (counterSection) {
      observer.observe(counterSection);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

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
    const duration = 20; // 2 seconds
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
      <HeroSection language={language} />
      <CounterSection language={language} />
      
      {/* Featured Events Section */}
      <FeaturedEventsSection language={language} />
      
      {/* Team Section */}
      <TeamSection language={language} />
      <SponsorsSection language={language} />
      
    </div>
  );
};

export default Index;
