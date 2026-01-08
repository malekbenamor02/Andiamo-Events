import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  Image as ImageIcon, 
  Video, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Music,
  Sparkles,
  Camera,
  Play,
  Volume2,
  VolumeX,
  Maximize2
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
  instagram_link?: string; // Changed from whatsapp_link to instagram_link
  whatsapp_link?: string; // Keep for backward compatibility
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
}

interface GalleryEventProps {
  language: 'en' | 'fr';
}

const GalleryEvent = ({ language }: GalleryEventProps) => {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const [imageLoaded, setImageLoaded] = useState<Set<string>>(new Set());
  const lightboxRef = useRef<HTMLDivElement>(null);

  const content = {
    en: {
      pastEvent: "Past Event",
      eventDate: "Event Date",
      location: "Location",
      djs: "DJs / Artists",
      musicStyle: "Music Style",
      estimatedCrowd: "Estimated Crowd",
      eventStory: "Event Story",
      recap: "Recap",
      gallery: "Gallery",
      highlightMoments: "Highlight Moments",
      bestMoments: "Best Moments of the Night",
      crowdReactions: "Crowd Reactions",
      djPeakTime: "DJ Peak Time",
      peopleVibes: "People & Vibes",
      eventStats: "Event Stats",
      hoursOfMusic: "hours of music",
      attendees: "attendees",
      djsCount: "DJs",
      photos: "photos",
      missedThis: "You missed this one… but not the next.",
      discoverUpcoming: "Discover Upcoming Events",
      backToGallery: "Back to Gallery",
      noEventFound: "Event not found",
      loading: "Loading event...",
      showMore: "Read more",
      showLess: "Read less"
    },
    fr: {
      pastEvent: "Événement passé",
      eventDate: "Date de l'événement",
      location: "Lieu",
      djs: "DJs / Artistes",
      musicStyle: "Style de musique",
      estimatedCrowd: "Foule estimée",
      eventStory: "Histoire de l'événement",
      recap: "Récapitulatif",
      gallery: "Galerie",
      highlightMoments: "Moments Forts",
      bestMoments: "Meilleurs Moments de la Nuit",
      crowdReactions: "Réactions de la Foule",
      djPeakTime: "Moment Fort du DJ",
      peopleVibes: "Personnes & Ambiance",
      eventStats: "Statistiques de l'Événement",
      hoursOfMusic: "heures de musique",
      attendees: "participants",
      djsCount: "DJs",
      photos: "photos",
      missedThis: "Vous avez manqué celui-ci… mais pas le suivant.",
      discoverUpcoming: "Découvrir les Événements à Venir",
      backToGallery: "Retour à la Galerie",
      noEventFound: "Événement introuvable",
      loading: "Chargement de l'événement...",
      showMore: "Lire plus",
      showLess: "Lire moins"
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
    fetchUpcomingEvents();
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
      
      // Decode the slug in case it's URL-encoded (React Router should already decode, but be safe)
      let decodedSlug = eventSlug;
      try {
        decodedSlug = decodeURIComponent(eventSlug);
      } catch (e) {
        // If decoding fails, use original
        decodedSlug = eventSlug;
      }
      
      // Normalize the slug (lowercase, trim)
      const normalizedSlug = decodedSlug.toLowerCase().trim();
      
      // Check if we're on localhost (for testing) or production
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.')
      );
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_type', 'gallery')
        .order('date', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Filter out test events if on production (not localhost)
      const filteredData = isLocalhost 
        ? data 
        : (data || []).filter((event: any) => !event.is_test);

      // Debug: Log all events and their slugs
      
      if (filteredData && filteredData.length > 0) {
        filteredData.forEach((e: Event) => {
          const slug = generateSlug(e.name);
          const matches = slug === normalizedSlug;
        });
      }

      // Find event by matching event ID format (event-{id})
      // All gallery events now use event ID format
      const foundEvent = filteredData?.find(e => {
        const idMatch = normalizedSlug.startsWith('event-') && normalizedSlug === `event-${e.id}`;
        
        // Also support legacy slug format for backward compatibility
        const eventSlugFromName = generateSlug(e.name);
        const slugMatch = eventSlugFromName.toLowerCase() === normalizedSlug;
        
        return idMatch || slugMatch;
      });
      
      if (!foundEvent) {
        console.error('❌ Event not found for slug:', normalizedSlug);
        const availableSlugs = data?.map(e => ({
          name: e.name,
          slug: generateSlug(e.name)
        })) || [];
        console.error('Available events and slugs:', availableSlugs);
        setEvent(null);
        return;
      }

      setEvent(foundEvent);
    } catch (error) {
      // Suppress browser extension errors
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

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_type', 'upcoming')
        .neq('event_status', 'cancelled')
        .order('date', { ascending: true })
        .limit(3);

      if (error) throw error;
      setUpcomingEvents(data || []);
    } catch (error) {
      // Suppress browser extension errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('message channel closed') && 
          !errorMessage.includes('asynchronous response')) {
        console.error('Error fetching upcoming events:', error);
      }
      // Don't set state on error, just leave it empty
    }
  };

  const getAllMedia = useCallback(() => {
    if (!event) return [];
    return [
      ...(event.gallery_images?.map((url, index) => ({ type: 'image' as const, url, index })) || []),
      ...(event.gallery_videos?.map((url, index) => ({ type: 'video' as const, url, index: index + (event.gallery_images?.length || 0) })) || [])
    ];
  }, [event]);

  const allMedia = getAllMedia();

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

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextLightbox = useCallback(() => {
    if (allMedia.length === 0) return;
    setLightboxIndex((prev) => (prev + 1) % allMedia.length);
  }, [allMedia.length]);

  const previousLightbox = useCallback(() => {
    if (allMedia.length === 0) return;
    setLightboxIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
  }, [allMedia.length]);


  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousLightbox();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextLightbox();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, nextLightbox, previousLightbox]);

  // Calculate stats
  const eventStats = {
    hoursOfMusic: 6, // Default, can be enhanced with database field
    attendees: event?.capacity || 700,
    djs: 3, // Default, can be enhanced with database field
    photos: event?.gallery_images?.length || 0
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
          <h1 className="text-4xl font-bold mb-4 uppercase">{t.noEventFound}</h1>
          <Button onClick={() => navigate('/events')}>
            {t.backToGallery}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-background animate-page-intro">
      {/* 1️⃣ Hero Section – Event Memory Cover */}
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
              <Badge className="mb-4 bg-primary/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                {t.pastEvent}
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-2xl animate-fade-in-up uppercase" style={{ animationDelay: '0.4s' }}>
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

      {/* 2️⃣ Event Identity Block (Quick Info) */}
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
                  <p className="text-sm text-muted-foreground mb-1">{t.estimatedCrowd}</p>
                  <p className="text-white font-semibold">{event.capacity}+</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3️⃣ Event Story / Recap */}
      {event.description && (
        <section className="py-16 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {t.eventStory}
              </h2>
              <Badge variant="outline" className="text-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                {t.recap}
              </Badge>
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

      {/* 4️⃣ Main Gallery Section */}
      {allMedia.length > 0 && (
        <section className="py-16 bg-gradient-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {t.gallery}
              </h2>
              <p className="text-muted-foreground animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                {allMedia.length} {allMedia.length === 1 ? 'media' : 'media'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {allMedia.map((media, index) => {
                const imageKey = `${event.id}-${index}`;
                const isLoaded = imageLoaded.has(imageKey);
                
                return (
                  <div
                    key={index}
                    className="group relative aspect-square overflow-hidden rounded-xl cursor-pointer transform transition-all duration-300 hover:scale-105 animate-fade-in-up"
                    style={{ animationDelay: `${0.2 + index * 0.05}s` }}
                    onClick={() => openLightbox(index)}
                  >
                    {!isLoaded && (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse blur-2xl" />
                    )}
                    
                    {media.type === 'video' ? (
                      <div className="relative w-full h-full">
                        <video
                          src={media.url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          loop
                          onLoadedData={() => setImageLoaded(prev => new Set([...prev, imageKey]))}
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                          <Play className="w-12 h-12 text-white opacity-80" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={media.url}
                        alt={`${event.name} - ${index + 1}`}
                        className="w-full h-full object-cover transition-opacity duration-300"
                        loading="lazy"
                        onLoad={() => setImageLoaded(prev => new Set([...prev, imageKey]))}
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Maximize2 className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 5️⃣ Highlight Moments (Optional) */}
      {allMedia.length > 0 && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4 flex items-center justify-center gap-2">
                <Sparkles className="w-8 h-8" />
                {t.highlightMoments}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="aspect-video relative">
                  {allMedia[0] && (
                    allMedia[0].type === 'video' ? (
                      <video src={allMedia[0].url} className="w-full h-full object-cover" muted playsInline loop />
                    ) : (
                      <img src={allMedia[0].url} alt="Highlight 1" className="w-full h-full object-cover" />
                    )
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg">{t.bestMoments}</h3>
                </div>
              </Card>
              
              {allMedia.length > 1 && (
                <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="aspect-video relative">
                    {allMedia[1] && (
                      allMedia[1].type === 'video' ? (
                        <video src={allMedia[1].url} className="w-full h-full object-cover" muted playsInline loop />
                      ) : (
                        <img src={allMedia[1].url} alt="Highlight 2" className="w-full h-full object-cover" />
                      )
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg">{t.crowdReactions}</h3>
                  </div>
                </Card>
              )}
              
              {allMedia.length > 2 && (
                <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <div className="aspect-video relative">
                    {allMedia[2] && (
                      allMedia[2].type === 'video' ? (
                        <video src={allMedia[2].url} className="w-full h-full object-cover" muted playsInline loop />
                      ) : (
                        <img src={allMedia[2].url} alt="Highlight 3" className="w-full h-full object-cover" />
                      )
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg">{t.djPeakTime}</h3>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 6️⃣ People & Vibes Section */}
      {allMedia.length > 3 && (
        <section className="py-16 bg-gradient-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4 flex items-center justify-center gap-2">
                <Camera className="w-8 h-8" />
                {t.peopleVibes}
              </h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {allMedia.slice(3, 7).map((media, index) => (
                <div
                  key={index + 3}
                  className="aspect-square overflow-hidden rounded-lg cursor-pointer transform transition-all duration-300 hover:scale-105 animate-fade-in-up"
                  style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                  onClick={() => openLightbox(index + 3)}
                >
                  {media.type === 'video' ? (
                    <video src={media.url} className="w-full h-full object-cover" muted playsInline loop />
                  ) : (
                    <img src={media.url} alt={`People ${index + 1}`} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7️⃣ Event Stats */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-fade-in-up">
            <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
              {t.eventStats}
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="text-4xl md:text-5xl font-bold text-gradient-neon mb-2">
                {eventStats.hoursOfMusic}
              </div>
              <p className="text-muted-foreground">{t.hoursOfMusic}</p>
            </div>
            
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-4xl md:text-5xl font-bold text-gradient-neon mb-2">
                {eventStats.attendees}+
              </div>
              <p className="text-muted-foreground">{t.attendees}</p>
            </div>
            
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="text-4xl md:text-5xl font-bold text-gradient-neon mb-2">
                {eventStats.djs}
              </div>
              <p className="text-muted-foreground">{t.djsCount}</p>
            </div>
            
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="text-4xl md:text-5xl font-bold text-gradient-neon mb-2">
                {eventStats.photos}
              </div>
              <p className="text-muted-foreground">{t.photos}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8️⃣ Link to Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {t.missedThis}
              </h2>
              <Link to="/events">
                <Button className="btn-gradient transform transition-all duration-300 hover:scale-105 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  {t.discoverUpcoming}
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {upcomingEvents.map((upcomingEvent, index) => (
                <Card
                  key={upcomingEvent.id}
                  className="overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300 animate-fade-in-up"
                  style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                  onClick={() => navigate('/events')}
                >
                  <div className="aspect-video relative">
                    <img
                      src={upcomingEvent.poster_url || "/api/placeholder/400/300"}
                      alt={upcomingEvent.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2">{upcomingEvent.name}</h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{formatDate(upcomingEvent.date)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && allMedia[lightboxIndex] && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-50 bg-black/98 backdrop-blur-xl flex items-center justify-center"
          onClick={closeLightbox}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 z-10"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </Button>

          {allMedia.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  previousLightbox();
                }}
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  nextLightbox();
                }}
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
              
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full backdrop-blur-sm z-10">
                {lightboxIndex + 1} / {allMedia.length}
              </div>
            </>
          )}

          <div
            className="relative max-w-full max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {allMedia[lightboxIndex].type === 'video' ? (
              <div className="relative">
                <video
                  src={allMedia[lightboxIndex].url}
                  controls={!videoMuted}
                  autoPlay
                  loop
                  playsInline
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  muted={videoMuted}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoMuted(!videoMuted);
                  }}
                >
                  {videoMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
              </div>
            ) : (
              <img
                src={allMedia[lightboxIndex].url}
                alt={`${event.name} - ${lightboxIndex + 1}`}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryEvent;

