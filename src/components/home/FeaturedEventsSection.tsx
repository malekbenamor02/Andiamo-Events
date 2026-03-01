import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateSlug } from '@/lib/utils';
import { useFeaturedEvents, type Event } from '@/hooks/useEvents';

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url?: string;
  featured?: boolean;
  instagram_link?: string; // Changed from whatsapp_link to instagram_link
  whatsapp_link?: string; // Keep for backward compatibility with database
  standard_price?: number;
  vip_price?: number;
}

interface FeaturedEventsSectionProps {
  language: 'en' | 'fr';
}

const FeaturedEventsSection = ({ language }: FeaturedEventsSectionProps) => {
  const navigate = useNavigate();
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);

  // Use cached featured events hook
  const { data: featuredEventsData = [] } = useFeaturedEvents();
  
  useEffect(() => {
    setFeaturedEvents(featuredEventsData);
  }, [featuredEventsData]);

  if (featuredEvents.length === 0) return null;

  return (
    <section className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold mb-4 text-gradient-neon">
            {language === 'en' ? 'Featured Events' : 'Événements Vedettes'}
          </h2>
          <p className="text-lg text-muted-foreground">
            {language === 'en'
              ? "We create memories."
              : "We create memories."}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 pb-4">
          {featuredEvents.map(event => (
            <div 
              key={event.id} 
              className="bg-card rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer group w-[320px] min-w-[320px] max-w-xs flex-shrink-0"
            >
              <div className="relative">
                <img
                  src={event.poster_url || '/api/placeholder/400/300'}
                  alt={event.name}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {event.featured && (
                  <span className="absolute top-4 left-4 bg-gradient-primary text-white px-3 py-1 rounded-full text-sm font-semibold">
                    Featured
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-xl font-bold text-primary mb-2">{event.name}</h3>
                <div className="flex items-center text-sm text-muted-foreground space-x-4 mb-2">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Intl.DateTimeFormat(language, {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }).format(new Date(event.date))}
                  </div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  {event.venue}, {event.city}
                </div>
                {((event.standard_price && Number(event.standard_price) > 0) || (event.vip_price && Number(event.vip_price) > 0)) && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-primary/70 mb-1.5 uppercase tracking-wide">
                      {language === 'en' ? 'Tickets' : 'Billets'}
                    </div>
                    <div className="flex flex-col text-sm text-muted-foreground pl-2 space-y-0.5 border-l-2 border-primary/20">
                      {event.standard_price && Number(event.standard_price) > 0 && (
                        <span>Standard: {event.standard_price} TND</span>
                      )}
                      {event.vip_price && Number(event.vip_price) > 0 && (
                        <span>VIP: {event.vip_price} TND</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      const slug = event.slug || generateSlug(event.name);
                      navigate(`/${slug}`);
                    }}
                    className="btn-gradient w-full inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white shadow-md shadow-primary/40 hover:shadow-lg hover:shadow-primary/50 hover:scale-[1.02] transition-all duration-300"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {language === 'en' ? 'Book Now' : 'Réserver'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <button
            onClick={() => navigate('/events')}
            className="bg-gradient-primary text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            {language === 'en' ? 'View All Events' : 'Voir Tous les Événements'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedEventsSection; 