import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  Calendar, 
  MapPin, 
  Users, 
  ArrowLeft,
  ChevronLeft, 
  ChevronRight, 
  X,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { generateSlug } from "@/lib/utils";
import { formatDateTimeLong } from "@/lib/date-utils";
import { Card } from "@/components/ui/card";
import { ExpandableText } from "@/components/ui/expandable-text";
import { Helmet } from "react-helmet-async";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdEvent, JsonLdBreadcrumb } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";
import { isLocalhostClient } from "@/lib/localhost";
import { MasonryMediaGallery } from "@/components/gallery/MasonryMediaGallery";

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
  gallery_credit?: string | null;
  is_test?: boolean;
  slug?: string;
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
  const lightboxRef = useRef<HTMLDivElement>(null);

  const content = {
    en: {
      pastEvent: "Past Event",
      eventDate: "Event Date",
      location: "Location",
      estimatedCrowd: "Estimated Crowd",
      eventStory: "Event Story",
      gallery: "Gallery",
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
      estimatedCrowd: "Foule estimée",
      eventStory: "Histoire de l'événement",
      gallery: "Galerie",
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
        window.location.hostname.startsWith('10.0.') ||
        window.location.hostname.startsWith('172.')
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

      const foundEvent = filteredData?.find((e: Event) => {
        const rawSlug = typeof e.slug === "string" ? e.slug.trim() : "";
        const officialMatch =
          rawSlug !== "" && rawSlug.toLowerCase() === normalizedSlug;

        const idMatch =
          normalizedSlug.startsWith("event-") && normalizedSlug === `event-${e.id}`;

        const eventSlugFromName = generateSlug(e.name);
        const slugMatch = eventSlugFromName.toLowerCase() === normalizedSlug;

        return officialMatch || idMatch || slugMatch;
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
        .limit(24);

      if (error) throw error;

      const now = Date.now();
      const isLocal = isLocalhostClient();
      const rows = (data || []).filter((e: Event) => {
        if (e.event_status === 'completed') return false;
        const t = new Date(e.date).getTime();
        if (Number.isNaN(t) || t <= now) return false;
        if (!isLocal && (e.is_test || e.name?.trim().toLowerCase() === 'test event')) {
          return false;
        }
        return true;
      });

      setUpcomingEvents(rows.slice(0, 3));
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

  const formatDate = (dateString: string) => formatDateTimeLong(dateString, language);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

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
  }, [lightboxOpen, nextLightbox, previousLightbox, closeLightbox]);

  // Lock document scroll while lightbox is open; restore exact position on close (no jump).
  useLayoutEffect(() => {
    if (!lightboxOpen) return;

    const scrollY = window.scrollY;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`;
    }

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.paddingRight = "";
      window.scrollTo(0, scrollY);
    };
  }, [lightboxOpen]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center min-h-screen bg-black">
        <LoadingScreen 
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

  const canonicalGallerySlug = (event.slug && event.slug.trim()) || generateSlug(event.name);
  const eventPath = `/gallery/${canonicalGallerySlug}`;
  const eventImage = event.poster_url?.startsWith("http") ? event.poster_url : event.poster_url ? `${SITE_URL}${event.poster_url}` : undefined;
  const startDateIso = event.date?.includes("T") ? event.date : event.date ? `${event.date}T20:00:00` : "";

  return (
    <main className="pt-16 min-h-screen bg-background animate-page-intro" id="main-content">
      <PageMeta
        title={`${event.name} – Gallery | Andiamo Events`}
        description={event.description?.slice(0, 155) || `${event.name} – ${event.venue}, ${event.city}. Past event gallery.`}
        path={eventPath}
        image={eventImage}
      />
      {startDateIso && (
        <JsonLdEvent
          name={event.name}
          description={event.description || event.name}
          startDate={startDateIso}
          venue={event.venue}
          city={event.city}
          image={event.poster_url || ""}
          eventUrl={eventPath}
          status="completed"
        />
      )}
      <JsonLdBreadcrumb
        items={[
          { name: "Home", url: "/" },
          { name: "Events", url: "/events" },
          { name: `${event.name} – Gallery`, url: eventPath },
        ]}
      />
      {eventImage && (
        <Helmet>
          <link rel="preload" as="image" href={eventImage} />
        </Helmet>
      )}
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
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/events')}
                  className="bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/20"
                  aria-label={language === 'en' ? 'Back to events' : 'Retour aux événements'}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Badge className="bg-primary/80 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  {t.pastEvent}
                </Badge>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 drop-shadow-2xl animate-fade-in-up uppercase" style={{ animationDelay: '0.4s' }}>
                {event.name}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* 2️⃣ Event Identity Block (Quick Info) */}
      <section className="py-12 bg-gradient-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            
            {event.capacity && (
              <div className="flex items-start space-x-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
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

      {/* 3️⃣ Event Story */}
      {event.description && (
        <section className="py-16 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {t.eventStory}
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

      {/* 4️⃣ Main Gallery Section */}
      {allMedia.length > 0 && (
        <section className="py-16 bg-gradient-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon">
                {t.gallery}
              </h2>
            </div>

            <MasonryMediaGallery
              items={allMedia}
              eventId={event.id}
              eventName={event.name}
              onItemClick={openLightbox}
              language={language}
              creditLine={event.gallery_credit?.trim() || undefined}
            />
          </div>
        </section>
      )}

      {/* 5️⃣ Link to Upcoming Events */}
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

      {/* Lightbox: portal + scroll lock so opening never shifts the page; backdrop press closes */}
      {lightboxOpen &&
        allMedia[lightboxIndex] &&
        createPortal(
          <div
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={language === "en" ? "Image gallery" : "Galerie"}
            className="fixed inset-0 z-[100] flex items-center justify-center overscroll-none bg-black/98 backdrop-blur-xl"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 border border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </Button>

            {allMedia.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 transform border border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    previousLightbox();
                  }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 transform border border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    nextLightbox();
                  }}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>

                <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 transform rounded-full bg-black/60 px-4 py-2 text-white backdrop-blur-sm">
                  {lightboxIndex + 1} / {allMedia.length}
                </div>
              </>
            )}

            <div
              className="relative max-h-[90vh] max-w-full p-4"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ touchAction: "auto" }}
            >
              {allMedia[lightboxIndex].type === "video" ? (
                <div className="relative">
                  <video
                    src={allMedia[lightboxIndex].url}
                    controls={!videoMuted}
                    autoPlay
                    loop
                    playsInline
                    className="max-h-[90vh] max-w-full rounded-lg object-contain"
                    muted={videoMuted}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-4 right-4 border border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoMuted(!videoMuted);
                    }}
                  >
                    {videoMuted ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              ) : (
                <img
                  src={allMedia[lightboxIndex].url}
                  alt={`${event.name} - ${lightboxIndex + 1}`}
                  className="max-h-[90vh] max-w-full rounded-lg object-contain"
                  draggable={false}
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </main>
  );
};

export default GalleryEvent;

