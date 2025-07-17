import { useState, useEffect } from "react";
import { Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url: string;
  ticket_link: string;
  whatsapp_link: string;
  featured: boolean;
}

interface EventsProps {
  language: 'en' | 'fr';
}

interface EventsContent {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

const Events = ({ language }: EventsProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [eventsContent, setEventsContent] = useState<EventsContent>({});

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'events_content');

        if (error) throw error;
        if (data?.[0]) {
          setEventsContent(data[0].content as EventsContent);
        }
      } catch (error) {
        console.error('Error fetching events content:', error);
      }
    };

    fetchSiteContent();
  }, []);

  const content = {
    en: {
      title: "Upcoming Events",
      subtitle: "Join us for unforgettable nights across Tunisia",
      filterAll: "All Events",
      filterFeatured: "Featured",
      bookNow: "Book Now",
      joinEvent: "Join Event",
      noEvents: "No events found",
      cities: ["All Cities", "Tunis", "Sousse", "Monastir", "Sfax"]
    },
    fr: {
      title: "Événements à Venir",
      subtitle: "Rejoignez-nous pour des nuits inoubliables à travers la Tunisie",
      filterAll: "Tous les Événements",
      filterFeatured: "En Vedette",
      bookNow: "Réserver",
      joinEvent: "Rejoindre",
      noEvents: "Aucun événement trouvé",
      cities: ["Toutes les Villes", "Tunis", "Sousse", "Monastir", "Sfax"]
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
    setLoading(false);
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'featured') return event.featured;
    if (filter === 'all') return true;
    return event.city.toLowerCase() === filter.toLowerCase();
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-background">
      {/* Header */}
      <section className="py-20 bg-gradient-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gradient-neon mb-4">
            {eventsContent?.title || content[language].title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {eventsContent?.description || content[language].subtitle}
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'btn-gradient' : ''}
            >
              {content[language].filterAll}
            </Button>
            <Button
              variant={filter === 'featured' ? 'default' : 'outline'}
              onClick={() => setFilter('featured')}
              className={filter === 'featured' ? 'btn-gradient' : ''}
            >
              {content[language].filterFeatured}
            </Button>
            {content[language].cities.slice(1).map((city) => (
              <Button
                key={city}
                variant={filter === city ? 'default' : 'outline'}
                onClick={() => setFilter(city)}
                className={filter === city ? 'btn-gradient' : ''}
              >
                {city}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-2xl text-muted-foreground">{content[language].noEvents}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEvents.map((event) => (
                <Card key={event.id} className="glass hover-lift overflow-hidden">
                  <div className="relative">
                    <img
                      src={event.poster_url || "/api/placeholder/400/300"}
                      alt={event.name}
                      className="w-full h-48 object-cover"
                    />
                    {event.featured && (
                      <Badge className="absolute top-4 left-4 bg-gradient-primary">
                        Featured
                      </Badge>
                    )}
                  </div>
                  
                  <CardHeader>
                    <h3 className="text-xl font-bold text-primary">{event.name}</h3>
                    <div className="flex items-center text-sm text-muted-foreground space-x-4">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(event.date)}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-1" />
                      {event.venue}, {event.city}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">
                      {event.description}
                    </p>
                  </CardContent>

                  <CardFooter className="flex space-x-2">
                    {event.ticket_link && (
                      <Button 
                        className="btn-gradient flex-1"
                        onClick={() => window.open(event.ticket_link, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {content[language].bookNow}
                      </Button>
                    )}
                    {event.whatsapp_link && (
                      <Button 
                        variant="outline"
                        className="btn-neon flex-1"
                        onClick={() => window.open(event.whatsapp_link, '_blank')}
                      >
                        {content[language].joinEvent}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Events;