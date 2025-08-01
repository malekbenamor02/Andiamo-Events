import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, ExternalLink } from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { supabase } from '@/integrations/supabase/client';

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
  standard_price?: number;
  vip_price?: number;
}

interface FeaturedEventsSectionProps {
  language: 'en' | 'fr';
}

const FeaturedEventsSection = ({ language }: FeaturedEventsSectionProps) => {
  const navigate = useNavigate();
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_type', 'upcoming')
        .order('date', { ascending: true });
      if (!error && data) setFeaturedEvents(data);
    };
    fetchUpcomingEvents();
  }, []);

  if (featuredEvents.length === 0) return null;

  return (
    <section className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-orbitron font-bold mb-4 text-gradient-neon">
            {language === 'en' ? 'Featured Events' : 'Événements Vedettes'}
          </h2>
          <p className="text-lg text-muted-foreground">
            {language === 'en'
              ? "Don't miss our upcoming nightlife experiences"
              : "Ne manquez pas nos prochaines expériences nocturnes"}
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
                <div className="flex flex-col text-sm text-muted-foreground mb-2">
                  <span>Standard: {event.standard_price} TND</span>
                  {event.vip_price && Number(event.vip_price) > 0 && (
                    <span>VIP: {event.vip_price} TND</span>
                  )}
                </div>
                <ExpandableText
                  text={event.description}
                  maxLength={100}
                  className="text-muted-foreground mb-4"
                  showMoreText={language === 'en' ? 'Show more' : 'Voir plus'}
                  showLessText={language === 'en' ? 'Show less' : 'Voir moins'}
                />
                <div className="flex gap-2">
                  {event.ticket_link && (
                    <a
                      href={event.ticket_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gradient flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-white transition-colors duration-300 hover:bg-primary/80"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {language === 'en' ? 'Book Now' : 'Réserver'}
                    </a>
                  )}
                  {event.whatsapp_link && (
                    <a
                      href={event.whatsapp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-neon flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold border border-primary text-primary hover:bg-primary/10 transition-colors duration-300"
                    >
                      {language === 'en' ? 'Join Event' : 'Rejoindre'}
                    </a>
                  )}
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