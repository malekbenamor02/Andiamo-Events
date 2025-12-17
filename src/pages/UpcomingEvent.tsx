import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  Music,
  Sparkles,
  ExternalLink,
  Camera,
  Ticket,
  Info,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { generateSlug } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ExpandableText } from "@/components/ui/expandable-text";

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url: string;
  instagram_link?: string;
  whatsapp_link?: string;
  featured: boolean;
  event_type?: 'upcoming' | 'gallery';
  gallery_images?: string[];
  gallery_videos?: string[];
  event_status?: 'active' | 'cancelled' | 'completed';
  capacity?: number;
  age_restriction?: number;
  dress_code?: string;
  special_notes?: string;
  organizer_contact?: string;
  event_category?: string;
  standard_price?: number;
  vip_price?: number;
  passes?: Array<{
    id: string;
    name: string;
    price: number;
    is_default?: boolean;
  }>;
}

interface UpcomingEventProps {
  language: 'en' | 'fr';
}

const UpcomingEvent = ({ language }: UpcomingEventProps) => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const content = {
    en: {
      upcomingEvent: "Upcoming Event",
      eventDate: "Event Date",
      location: "Location",
      musicStyle: "Music Style",
      estimatedCrowd: "Estimated Crowd",
      eventDescription: "Event Description",
      tickets: "Tickets",
      bookNow: "Book Now",
      viewOnInstagram: "View on Instagram",
      contactOrganizer: "Contact Organizer",
      ageRestriction: "Age Restriction",
      dressCode: "Dress Code",
      specialNotes: "Special Notes",
      eventInfo: "Event Information",
      capacity: "Capacity",
      relatedEvents: "More Upcoming Events",
      backToEvents: "Back to Events",
      noEventFound: "Event not found",
      loading: "Loading event...",
      showMore: "Read more",
      showLess: "Read less",
      cancelled: "Cancelled",
      featured: "Featured",
      standard: "Standard",
      vip: "VIP"
    },
    fr: {
      upcomingEvent: "Événement à Venir",
      eventDate: "Date de l'événement",
      location: "Lieu",
      musicStyle: "Style de musique",
      estimatedCrowd: "Foule estimée",
      eventDescription: "Description de l'événement",
      tickets: "Billets",
      bookNow: "Réserver",
      viewOnInstagram: "Voir sur Instagram",
      contactOrganizer: "Contacter l'organisateur",
      ageRestriction: "Restriction d'âge",
      dressCode: "Code vestimentaire",
      specialNotes: "Notes spéciales",
      eventInfo: "Informations sur l'événement",
      capacity: "Capacité",
      relatedEvents: "Plus d'Événements à Venir",
      backToEvents: "Retour aux Événements",
      noEventFound: "Événement introuvable",
      loading: "Chargement de l'événement...",
      showMore: "Lire plus",
      showLess: "Lire moins",
      cancelled: "Annulé",
      featured: "En Vedette",
      standard: "Standard",
      vip: "VIP"
    }
  };

  const t = content[language];

  useEffect(() => {
    // Handle empty slug case - redirect to events page
    if (!eventSlug || eventSlug.trim() === '') {
      console.warn('⚠️ Empty eventSlug, redirecting to events page');
      navigate('/events');
      return;
    }
    
    fetchEvent();
    fetchRelatedEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, navigate]);

  const fetchEvent = async () => {
    try {
      if (!eventSlug) {
        setEvent(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // Decode the slug in case it's URL-encoded
      let decodedSlug = eventSlug;
      try {
        decodedSlug = decodeURIComponent(eventSlug);
      } catch (e) {
        decodedSlug = eventSlug;
      }
      
      // Normalize the slug (lowercase, trim)
      const normalizedSlug = decodedSlug.toLowerCase().trim();
      
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          passes:event_passes (
            id,
            name,
            price,
            is_default
          )
        `)
        .eq('event_type', 'upcoming')
        .order('date', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Find event by matching event ID format (event-{id})
      const foundEvent = data?.find(e => {
        const idMatch = normalizedSlug.startsWith('event-') && normalizedSlug === `event-${e.id}`;
        
        // Also support legacy slug format for backward compatibility
        const eventSlugFromName = generateSlug(e.name);
        const slugMatch = eventSlugFromName.toLowerCase() === normalizedSlug;
        
        return idMatch || slugMatch;
      });
      
      if (!foundEvent) {
        console.error('❌ Event not found for slug:', normalizedSlug);
        setEvent(null);
        return;
      }

      console.log('✅ Found event:', foundEvent.name);
      setEvent(foundEvent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('message channel closed') && 
          !errorMessage.includes('asynchronous response')) {
        console.error('Error fetching event:', error);
      }
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_type', 'upcoming')
        .neq('event_status', 'cancelled')
        .neq('id', event?.id || '')
        .order('date', { ascending: true })
        .limit(3);

      if (error) throw error;
      setRelatedEvents(data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('message channel closed') && 
          !errorMessage.includes('asynchronous response')) {
        console.error('Error fetching related events:', error);
      }
    }
  };

  useEffect(() => {
    if (event?.id) {
      fetchRelatedEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center min-h-screen bg-black">
        <LoadingScreen 
          variant="default" 
          size="fullscreen" 
          text={t.loading}
        />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="pt-16 min-h-screen bg-background flex items-center justify-center animate-page-intro">
        <div className="text-center animate-content-fade-in">
          <h1 className="text-4xl font-bold mb-4">{t.noEventFound}</h1>
          <Button onClick={() => navigate('/events')}>
            {t.backToEvents}
          </Button>
        </div>
      </div>
    );
  }

  const eventUrl = `event-${event.id}`;

  return (
    <div className="pt-16 min-h-screen bg-background animate-page-intro">
      {/* Hero Section */}
      <section className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden">
        <div className="absolute inset-0 animate-blur-to-sharp">
          <img
            src={event.poster_url || "/api/placeholder/1920/1080"}
            alt={event.name}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
        </div>
        
        <div className="absolute inset-0 flex items-end">
          <div className="w-full px-4 sm:px-6 lg:px-8 pb-12 md:pb-16">
            <div className="max-w-7xl mx-auto animate-content-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/events')}
                  className="bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/20"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Badge className="bg-primary/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  {t.upcomingEvent}
                </Badge>
                {event.event_status === 'cancelled' && (
                  <Badge className="bg-red-500/80 backdrop-blur-sm animate-fade-in-up">
                    {t.cancelled}
                  </Badge>
                )}
                {event.featured && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500/80 backdrop-blur-sm animate-fade-in-up">
                    ⭐ {t.featured}
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-2xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                {event.name}
              </h1>
              {event.event_category && (
                <p className="text-xl md:text-2xl text-white/90 font-medium animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                  {event.event_category}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Event Identity Block (Quick Info) */}
      <section className="py-12 bg-gradient-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start space-x-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <Calendar className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t.eventDate}</p>
                <p className="text-white font-semibold">{formatDate(event.date)}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <MapPin className="w-5 h-5 text-pink-400 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t.location}</p>
                <p className="text-white font-semibold">{event.venue}, {event.city}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Music className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t.musicStyle}</p>
                <p className="text-white font-semibold">{event.event_category || "Electronic"}</p>
              </div>
            </div>
            
            {event.capacity && (
              <div className="flex items-start space-x-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <Users className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t.capacity}</p>
                  <p className="text-white font-semibold">{event.capacity}+</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Event Description */}
      {event.description && (
        <section className="py-16 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {t.eventDescription}
              </h2>
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="bg-gradient-to-br from-card/50 via-card/40 to-card/30 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-primary/10 hover:border-primary/30 transition-all duration-500 shadow-lg hover:shadow-xl hover:shadow-primary/10">
                <div className="relative">
                  <div className="absolute -top-2 -left-2 w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-2xl opacity-50"></div>
                  <div className="relative z-10">
                    <ExpandableText
                      text={event.description}
                      maxLength={250}
                      className="text-lg text-muted-foreground leading-relaxed"
                      showMoreText={t.showMore}
                      showLessText={t.showLess}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tickets Section */}
      {(event.passes && event.passes.length > 0) || event.standard_price || (event.vip_price && Number(event.vip_price) > 0) ? (
        <section className="py-16 bg-gradient-dark">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4 flex items-center justify-center gap-2">
                <Ticket className="w-8 h-8" />
                {t.tickets}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {event.passes && event.passes.length > 0 ? (
                event.passes.map((pass, index) => (
                  <Card
                    key={pass.id}
                    className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up p-6"
                    style={{ animationDelay: `${0.1 + index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-2xl font-bold ${
                        pass.is_default || pass.name === 'Standard' 
                          ? 'text-green-500' 
                          : pass.name === 'VIP' || pass.name === 'Vip'
                          ? 'text-blue-500'
                          : 'text-primary'
                      }`}>
                        {pass.name}
                      </h3>
                      <Badge variant="outline" className="text-lg font-semibold">
                        {pass.price} TND
                      </Badge>
                    </div>
                    {pass.is_default && (
                      <p className="text-sm text-muted-foreground">{language === 'en' ? 'Most Popular' : 'Le Plus Populaire'}</p>
                    )}
                  </Card>
                ))
              ) : (
                <>
                  {event.standard_price && (
                    <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-green-500">{t.standard}</h3>
                        <Badge variant="outline" className="text-lg font-semibold">
                          {event.standard_price} TND
                        </Badge>
                      </div>
                    </Card>
                  )}
                  {event.vip_price && Number(event.vip_price) > 0 && (
                    <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-blue-500">{t.vip}</h3>
                        <Badge variant="outline" className="text-lg font-semibold">
                          {event.vip_price} TND
                        </Badge>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>

            {event.event_status !== 'cancelled' && (
              <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <Button
                  onClick={() => navigate(`/pass-purchase?eventId=${event.id}`)}
                  className="btn-gradient transform transition-all duration-300 hover:scale-105 text-lg px-8 py-6"
                  size="lg"
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  {t.bookNow}
                </Button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Event Information */}
      {(event.age_restriction || event.dress_code || event.special_notes || event.organizer_contact) && (
        <section className="py-16 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4 flex items-center justify-center gap-2">
                <Info className="w-8 h-8" />
                {t.eventInfo}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {event.age_restriction && (
                <Card className="p-6 border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up">
                  <div className="flex items-start space-x-3">
                    <Users className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t.ageRestriction}</p>
                      <p className="text-white font-semibold">{event.age_restriction}+</p>
                    </div>
                  </div>
                </Card>
              )}
              
              {event.dress_code && (
                <Card className="p-6 border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up">
                  <div className="flex items-start space-x-3">
                    <Sparkles className="w-5 h-5 text-pink-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t.dressCode}</p>
                      <p className="text-white font-semibold">{event.dress_code}</p>
                    </div>
                  </div>
                </Card>
              )}
              
              {event.special_notes && (
                <Card className="p-6 border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up md:col-span-2">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{t.specialNotes}</p>
                      <p className="text-white font-semibold">{event.special_notes}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Social Links */}
      {(event.instagram_link || event.whatsapp_link || event.organizer_contact) && (
        <section className="py-16 bg-gradient-dark">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up">
              {event.instagram_link && (
                <a
                  href={event.instagram_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold border border-pink-500/50 text-pink-500/80 hover:border-pink-500/70 hover:text-pink-500/90 hover:bg-pink-500/5 transition-all duration-300"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  {t.viewOnInstagram}
                </a>
              )}
              {event.organizer_contact && (
                <a
                  href={`https://wa.me/${event.organizer_contact.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold border border-green-500/50 text-green-500/80 hover:border-green-500/70 hover:text-green-500/90 hover:bg-green-500/5 transition-all duration-300"
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  {t.contactOrganizer}
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Related Events */}
      {relatedEvents.length > 0 && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {t.relatedEvents}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedEvents.map((relatedEvent, index) => {
                const relatedEventUrl = `event-${relatedEvent.id}`;
                return (
                  <Card
                    key={relatedEvent.id}
                    className="overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300 animate-fade-in-up"
                    style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                    onClick={() => navigate(`/event/${relatedEventUrl}`)}
                  >
                    <div className="aspect-video relative">
                      <img
                        src={relatedEvent.poster_url || "/api/placeholder/400/300"}
                        alt={relatedEvent.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2">{relatedEvent.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>{formatDate(relatedEvent.date)}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default UpcomingEvent;

