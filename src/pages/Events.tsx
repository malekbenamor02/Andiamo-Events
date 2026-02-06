import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, ExternalLink, Play, X, ChevronLeft, ChevronRight, Users, Clock, DollarSign, Info, Image as ImageIcon, Maximize2, Minimize2, Volume2, VolumeX, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdWebPage, JsonLdBreadcrumb, JsonLdItemList } from "@/components/JsonLd";
import { generateSlug } from "@/lib/utils";
import { useEvents, type Event } from "@/hooks/useEvents";

// Event types are now imported from useEvents hook

interface EventsProps {
  language: 'en' | 'fr';
}

const Events = ({ language }: EventsProps) => {
  const navigate = useNavigate();
  // Use cached events hook
  const { data: events = [], isLoading: loading, error: eventsError } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isFullScreenGallery, setIsFullScreenGallery] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'gallery'>('details');
  const galleryRef = useRef<HTMLDivElement>(null);
  const [animatedEvents, setAnimatedEvents] = useState<Set<string>>(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const [animatedGalleryEvents, setAnimatedGalleryEvents] = useState<Set<string>>(new Set());
  const [hasGalleryAnimated, setHasGalleryAnimated] = useState(false);
  const [scrollAnimatedEvents, setScrollAnimatedEvents] = useState<Set<string>>(new Set());
  const [scrollAnimatedGalleryEvents, setScrollAnimatedGalleryEvents] = useState<Set<string>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<Set<string>>(new Set());
  const [videoMuted, setVideoMuted] = useState(true);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const [modalAnimating, setModalAnimating] = useState(false);
  const [clickedCardId, setClickedCardId] = useState<string | null>(null);
  const [contentBlocksAnimated, setContentBlocksAnimated] = useState<Set<string>>(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);

  const content = {
    en: {
      title: "Events",
      subtitle: "Discover amazing nightlife experiences across Tunisia",
      upcomingTitle: "Upcoming Events",
      upcomingSubtitle: "Don't miss our next incredible events",
      galleryTitle: "Event Gallery",
      gallerySubtitle: "Relive the best moments from our past events",
      bookNow: "Book Now",
      joinEvent: "Join Event",
      viewDetails: "View Details",
      noUpcomingEvents: "No upcoming events found",
      noGalleryEvents: "No gallery events found",
      close: "Close",
      previous: "Previous",
      next: "Next",
      eventDetails: "Event Details",
      aboutEvent: "About This Event",
      ticketPricing: "Ticket Pricing",
      quickInfo: "Quick Info",
      capacity: "Capacity",
      ageRestriction: "Age Restriction",
      dressCode: "Dress Code",
      specialNotes: "Special Notes",
      organizerContact: "Organizer Contact",
      standard: "Standard",
      vip: "VIP",
      featured: "Featured",
      cancelled: "Cancelled",
      completed: "Completed",
      gallery: "Gallery",
      details: "Details",
      viewFullscreen: "View Fullscreen",
      exitFullscreen: "Exit Fullscreen"
    },
    fr: {
      title: "Événements",
      subtitle: "Découvrez des expériences nocturnes incroyables à travers la Tunisie",
      upcomingTitle: "Événements à Venir",
      upcomingSubtitle: "Ne manquez pas nos prochains événements incroyables",
      galleryTitle: "Galerie d'Événements",
      gallerySubtitle: "Revivez les meilleurs moments de nos événements passés",
      bookNow: "Réserver",
      joinEvent: "Rejoindre",
      viewDetails: "Voir les Détails",
      noUpcomingEvents: "Aucun événement à venir trouvé",
      noGalleryEvents: "Aucun événement de galerie trouvé",
      close: "Fermer",
      previous: "Précédent",
      next: "Suivant",
      eventDetails: "Détails de l'Événement",
      aboutEvent: "À Propos de Cet Événement",
      ticketPricing: "Tarifs des Billets",
      quickInfo: "Info Rapide",
      capacity: "Capacité",
      ageRestriction: "Âge Minimum",
      dressCode: "Code Vestimentaire",
      specialNotes: "Notes Spéciales",
      organizerContact: "Contact Organisateur",
      standard: "Standard",
      vip: "VIP",
      featured: "En Vedette",
      cancelled: "Annulé",
      completed: "Terminé",
      gallery: "Galerie",
      details: "Détails",
      viewFullscreen: "Voir Plein Écran",
      exitFullscreen: "Quitter Plein Écran"
    }
  };

  // Cleanup effect to restore scrollbar when component unmounts
  useEffect(() => {
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  // Handle errors
  useEffect(() => {
    if (eventsError) {
      console.error('❌ Error fetching events:', eventsError);
    }
  }, [eventsError]);

  // Scroll to top when events load
  useEffect(() => {
    if (!loading && events.length > 0) {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    }
  }, [loading, events.length]);
  
  // Check for gallery events specifically
  const galleryEventsInData = useMemo(() => {
    return events.filter((e: any) => e.event_type === 'gallery');
  }, [events]);
  
  useEffect(() => {
  }, [galleryEventsInData]);

  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.date);
    const now = new Date();
    // Show as upcoming only if date is in the future, not cancelled, not completed
    return (
      eventDate >= now &&
      (event.event_type === 'upcoming' || !event.event_type) &&
      event.event_status !== 'cancelled' &&
      event.event_status !== 'completed'
    );
  });

  const galleryEvents = events.filter(event => {
    // Show events explicitly marked as gallery (not cancelled)
    if (event.event_type === 'gallery') {
      return event.event_status !== 'cancelled';
    }
    // Also show past upcoming events in gallery (date passed or completed) — manual move to gallery added later
    const eventDate = new Date(event.date);
    const now = new Date();
    const isPastOrCompleted =
      eventDate < now ||
      event.event_status === 'completed';
    const wasUpcoming = event.event_type === 'upcoming' || !event.event_type;
    if (wasUpcoming && isPastOrCompleted && event.event_status !== 'cancelled') {
      return true;
    }
    return false;
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

  const formatPrice = (price?: number) => {
    if (!price) return null;
    return `${price} TND`;
  };

  const openModal = (event: Event, cardElement?: HTMLElement) => {
    // Save scroll position
    setScrollPosition(window.scrollY);
    
    // Card scale-up feedback
    if (cardElement) {
      cardElement.classList.add('animate-card-scale-up');
      setTimeout(() => {
        cardElement.classList.remove('animate-card-scale-up');
      }, 300);
    }
    
    // Small delay for card animation, then open modal
    setTimeout(() => {
      setSelectedEvent(event);
      setCurrentMediaIndex(0);
      setModalAnimating(false);
      setShowModal(true);
      setActiveTab('details');
      setIsFullScreenGallery(false);
      setLightboxOpen(false);
      setLightboxIndex(0);
      document.body.classList.add('modal-open');
      setContentBlocksAnimated(new Set());
    }, 150);
  };

  const closeModal = () => {
    setModalAnimating(true);
    // Exit animation
    setTimeout(() => {
      setShowModal(false);
      setSelectedEvent(null);
      setCurrentMediaIndex(0);
      setIsFullScreenGallery(false);
      setLightboxOpen(false);
      setLightboxIndex(0);
      setActiveTab('details');
      setContentBlocksAnimated(new Set());
      document.body.classList.remove('modal-open');
      setModalAnimating(false);
      setClickedCardId(null);
      
      // Restore scroll position
      setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 100);
    }, 500);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // Get all media for current event (used in modal) - Must be defined before useMemo
  const getAllMediaForEvent = useCallback((event: Event | null) => {
    if (!event) return [];
    return [
      ...(event.gallery_images?.map((url, index) => ({ type: 'image' as const, url, index })) || []),
      ...(event.gallery_videos?.map((url, index) => ({ type: 'video' as const, url, index: index + (event.gallery_images?.length || 0) })) || [])
    ];
  }, []);

  const nextLightbox = useCallback(() => {
    if (!selectedEvent) return;
    const allMedia = getAllMediaForEvent(selectedEvent);
    if (allMedia.length === 0) return;
    setLightboxIndex((prev) => (prev + 1) % allMedia.length);
  }, [selectedEvent]);

  const previousLightbox = useCallback(() => {
    if (!selectedEvent) return;
    const allMedia = getAllMediaForEvent(selectedEvent);
    if (allMedia.length === 0) return;
    setLightboxIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
  }, [selectedEvent]);

  const nextMedia = useCallback(() => {
    if (!selectedEvent) return;
    const allMedia = [
      ...(selectedEvent.gallery_images?.map((url, index) => ({ type: 'image' as const, url, index })) || []),
      ...(selectedEvent.gallery_videos?.map((url, index) => ({ type: 'video' as const, url, index: index + (selectedEvent.gallery_images?.length || 0) })) || [])
    ];
    if (allMedia.length === 0) return;
    setCurrentMediaIndex((prev) => (prev + 1) % allMedia.length);
  }, [selectedEvent]);

  const previousMedia = useCallback(() => {
    if (!selectedEvent) return;
    const allMedia = [
      ...(selectedEvent.gallery_images?.map((url, index) => ({ type: 'image' as const, url, index })) || []),
      ...(selectedEvent.gallery_videos?.map((url, index) => ({ type: 'video' as const, url, index: index + (selectedEvent.gallery_images?.length || 0) })) || [])
    ];
    if (allMedia.length === 0) return;
    setCurrentMediaIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
  }, [selectedEvent]);

  // Keyboard navigation for modal and lightbox
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) {
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
      } else if (activeTab === 'gallery') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          previousMedia();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextMedia();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeModal();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, lightboxOpen, activeTab, nextLightbox, previousLightbox, nextMedia, previousMedia]);

  const goToMedia = (index: number) => {
    setCurrentMediaIndex(index);
  };

  // Swipe handlers for mobile gallery
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (lightboxOpen) {
      if (isLeftSwipe) {
        nextLightbox();
      }
      if (isRightSwipe) {
        previousLightbox();
      }
    } else if (activeTab === 'gallery') {
      if (isLeftSwipe) {
        nextMedia();
      }
      if (isRightSwipe) {
        previousMedia();
      }
    }
  };

  // Animation effects
  useEffect(() => {
    if (!hasAnimated && upcomingEvents.length > 0) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        upcomingEvents.forEach((event, index) => {
          setTimeout(() => {
            setAnimatedEvents(prev => new Set([...prev, event.id]));
          }, index * 200);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasAnimated, upcomingEvents]);

  useEffect(() => {
    if (!hasGalleryAnimated && galleryEvents.length > 0) {
      const timer = setTimeout(() => {
        setHasGalleryAnimated(true);
        galleryEvents.forEach((event, index) => {
          setTimeout(() => {
            setAnimatedGalleryEvents(prev => new Set([...prev, event.id]));
          }, index * 150);
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [hasGalleryAnimated, galleryEvents]);

  useEffect(() => {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    const handleScroll = () => {
      const upcomingCards = document.querySelectorAll('.upcoming-event-card');
      const galleryCards = document.querySelectorAll('.gallery-event-card');
      
      upcomingCards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.8;
        if (isVisible && !scrollAnimatedEvents.has(upcomingEvents[index]?.id)) {
          setScrollAnimatedEvents(prev => new Set([...prev, upcomingEvents[index]?.id]));
        }
      });
      
      galleryCards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.8;
        if (isVisible && !scrollAnimatedGalleryEvents.has(galleryEvents[index]?.id)) {
          setScrollAnimatedGalleryEvents(prev => new Set([...prev, galleryEvents[index]?.id]));
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [upcomingEvents, galleryEvents, scrollAnimatedEvents, scrollAnimatedGalleryEvents]);

  // Debug gallery events - Log when events change (MUST be before any early returns)
  useEffect(() => {
    if (!loading) {
      const galleryCount = events.filter(e => e.event_type === 'gallery').length;
      const galleryEventsList = events.filter(e => e.event_type === 'gallery').map(e => ({ 
        id: e.id,
        name: e.name, 
        type: e.event_type, 
        status: e.event_status,
        hasImages: !!(e.gallery_images && e.gallery_images.length > 0),
        hasVideos: !!(e.gallery_videos && e.gallery_videos.length > 0)
      }));
      const now = new Date();
        const upcomingCount = events.filter(e => {
          const eventDate = new Date(e.date);
          return eventDate >= now && (e.event_type === 'upcoming' || !e.event_type) && e.event_status !== 'cancelled' && e.event_status !== 'completed';
        }).length;
    }
  }, [events, loading]);

  // Compute media for selected event using useMemo
  const allMedia = useMemo(() => {
    return getAllMediaForEvent(selectedEvent);
  }, [selectedEvent, getAllMediaForEvent]);
  
  const hasGallery = useMemo(() => {
    return allMedia.length > 0;
  }, [allMedia]);

  if (loading) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={content[language].title ? `Loading ${content[language].title.toLowerCase()}...` : "Loading events..."}
      />
    );
  }

  return (
    <main className="pt-16 min-h-screen bg-background animate-page-intro" id="main-content">
      <PageMeta
        title="Upcoming Events"
        description="Discover upcoming nightlife events and parties in Tunisia. Andiamo Events – concerts, festivals and experiences. Get tickets online."
        path="/events"
      />
      <JsonLdWebPage
        name="Upcoming Events | Andiamo Events – Tunisia Concerts & Parties"
        description="Discover upcoming events in Tunisia. Concerts, parties and festivals in Tunis, Sousse and more. Buy tickets online. Andiamo Events."
        path="/events"
      />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "Events", url: "/events" }]} />
      {upcomingEvents.length > 0 && (
        <JsonLdItemList
          items={upcomingEvents.slice(0, 20).map((e) => ({
            name: e.name,
            url: `/event/event-${e.id}`,
          }))}
        />
      )}
      {/* Header */}
      <section className="py-20 bg-gradient-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gradient-neon mb-4 animate-in slide-in-from-top-4 duration-1000 uppercase">
            {content[language].title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-1000 delay-300">
            {content[language].subtitle}
          </p>
          <p className="text-base text-muted-foreground/90 max-w-2xl mx-auto mt-4 animate-in slide-in-from-bottom-4 duration-1000 delay-500">
            {language === "en"
              ? "Find concerts, parties and festivals in Tunis, Sousse, Monastir, Hammamet and across Tunisia. Book your tickets online."
              : "Trouvez concerts, soirées et festivals à Tunis, Sousse, Monastir, Hammamet et en Tunisie. Réservez vos billets en ligne."}
          </p>
        </div>
      </section>

      {/* Upcoming Events Section - Only show if there are events */}
      {upcomingEvents.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-in slide-in-from-bottom-4 duration-700 delay-200">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4 animate-in slide-in-from-left-4 duration-1000 uppercase">
                {content[language].upcomingTitle}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
              {upcomingEvents.map((event, index) => {
                const eventUrl = `event-${event.id}`;
                return (
                <Card 
                  key={event.id} 
                  className={`upcoming-event-card glass group overflow-hidden cursor-pointer w-full max-w-md transition-all duration-300 ease-out hover:shadow-2xl hover:shadow-primary/20 ${
                    scrollAnimatedEvents.has(event.id) 
                      ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/event/${eventUrl}`);
                  }}
                >
                  <div className="relative overflow-hidden">
                    {/* Image Layer - No transforms that affect layout */}
                    <div className="relative w-full h-48">
                      <img
                        src={event.poster_url || "/api/placeholder/400/300"}
                        alt={event.name}
                        className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                        loading="lazy"
                        decoding="async"
                      />
                      
                      {/* Overlay Layer - Smooth fade in, not too strong */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-opacity duration-300 pointer-events-none"></div>
                      
                      {/* View Details Button - Independent overlay layer */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                          <div className="bg-primary/95 backdrop-blur-sm rounded-lg px-4 py-2 border border-primary/50 shadow-lg">
                            <p className="text-sm font-semibold text-white">{content[language].viewDetails}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Featured Badge - Always visible */}
                      {event.featured && (
                        <Badge className="absolute top-4 left-4 bg-gradient-primary animate-in slide-in-from-top-4 duration-500 z-20">
                          {content[language].featured}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardHeader className="p-4 relative z-0">
                    <h3 className="text-xl font-bold text-primary group-hover:text-primary transition-colors duration-300 line-clamp-2 animate-in slide-in-from-left-4 duration-500 delay-200">{event.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-muted-foreground group-hover:text-foreground transition-colors duration-300 animate-in slide-in-from-left-4 duration-500 delay-300">
                        <Calendar className="w-4 h-4 mr-2 animate-pulse" />
                        <span>{formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center text-muted-foreground group-hover:text-foreground transition-colors duration-300 animate-in slide-in-from-left-4 duration-500 delay-400">
                        <MapPin className="w-4 h-4 mr-2 animate-pulse" />
                        <span>{event.venue}, {event.city}</span>
                      </div>
                      {/* Display all passes */}
                      {event.passes && event.passes.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm mb-2 animate-in slide-in-from-left-4 duration-500 delay-500">
                          {event.passes.map((pass, idx) => (
                            <span 
                              key={idx}
                              className="font-semibold text-foreground"
                            >
                              {pass.name}: {pass.price} TND
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Premium Event Gallery Section */}
      <section className="py-20 bg-gradient-dark relative overflow-hidden">
        {/* Animated background effects */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-in slide-in-from-bottom-4 duration-700 delay-200">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gradient-neon mb-4 animate-in slide-in-from-left-4 duration-1000 uppercase">
              {content[language].galleryTitle}
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {content[language].gallerySubtitle}
            </p>
          </div>

          {galleryEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {galleryEvents.map((event, index) => {
                const mediaCount = (event.gallery_images?.length || 0) + (event.gallery_videos?.length || 0);
                const isAnimated = scrollAnimatedGalleryEvents.has(event.id) || animatedGalleryEvents.has(event.id);
                
                // Use event ID for all gallery events
                const eventUrl = `event-${event.id}`;
                
                return (
                  <div
                    key={event.id}
                    className={`group relative overflow-hidden rounded-2xl cursor-pointer transform transition-all duration-700 ease-out ${
                      isAnimated 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-100 translate-y-0'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/gallery/${eventUrl}`);
                    }}
                  >
                    {/* Premium Card with Glass Effect */}
                    <div className="relative h-[420px] md:h-[480px] bg-gradient-to-br from-card/40 via-card/30 to-card/20 backdrop-blur-xl border border-primary/20 rounded-2xl overflow-hidden group-hover:border-primary/40 transition-all duration-500">
                      {/* Poster Image Layer */}
                      <div className="relative h-3/4 overflow-hidden">
                        {/* Gradient overlay for text readability - always visible */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10"></div>
                        
                        {/* Image - only opacity changes, no scale transforms */}
                        <img
                          src={event.poster_url || "/api/placeholder/400/400"}
                          alt={event.name}
                          className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                          loading="lazy"
                        />
                        
                        {/* Hover Overlay - Smooth fade, not too strong */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-opacity duration-300 z-[15] pointer-events-none"></div>
                        
                        {/* Media Count Badge */}
                        {mediaCount > 0 && (
                          <Badge className="absolute top-4 left-4 bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg shadow-primary/50 z-30 backdrop-blur-sm">
                            <ImageIcon className="w-3 h-3 mr-1" />
                            {mediaCount} {mediaCount === 1 ? 'Media' : 'Media'}
                          </Badge>
                        )}
                        
                        {/* Featured Badge */}
                        {event.featured && (
                          <Badge className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-lg shadow-yellow-500/50 z-30 backdrop-blur-sm">
                            ⭐ Featured
                          </Badge>
                        )}
                        
                        {/* View Details Button - Independent overlay layer */}
                        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                            <div className="bg-primary/95 backdrop-blur-sm rounded-lg px-6 py-3 border border-primary/50 shadow-lg">
                              <p className="text-sm font-semibold text-white">{content[language].viewDetails}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Card Content - Always readable with explicit colors */}
                      <div className="absolute bottom-0 left-0 right-0 p-5 z-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-2 line-clamp-2 transition-colors duration-300 group-hover:text-primary">
                          {event.name}
                        </h3>
                        
                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-white/90 group-hover:text-white transition-colors duration-300">
                            <Calendar className="w-4 h-4 mr-2 text-primary" />
                            <span className="truncate">{formatDate(event.date)}</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-white/90 group-hover:text-white transition-colors duration-300">
                            <MapPin className="w-4 h-4 mr-2 text-accent" />
                            <span className="truncate">{event.city}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Shadow Glow Effect - Subtle, no layout impact */}
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">
                {content[language].noGalleryEvents}
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Debug: Total events: {events.length}, Gallery events: {galleryEvents.length}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Enhanced Event Modal */}
      {showModal && selectedEvent && (
        <>
          {/* Full Screen Gallery View (Mobile) */}
          {isFullScreenGallery && (
            <div 
              className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 z-10"
                onClick={() => setIsFullScreenGallery(false)}
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Exit Fullscreen Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 z-10"
                onClick={() => setIsFullScreenGallery(false)}
              >
                <Minimize2 className="w-6 h-6" />
              </Button>

              {/* Media Counter */}
              {allMedia.length > 1 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full backdrop-blur-sm z-10">
                  {currentMediaIndex + 1} / {allMedia.length}
                </div>
              )}

              {/* Main Media Display - Full Screen */}
              {allMedia[currentMediaIndex] && (
                <div className="w-full h-full flex items-center justify-center p-4">
                  {allMedia[currentMediaIndex].type === 'video' ? (
                    <video
                      src={allMedia[currentMediaIndex].url}
                      controls
                      className="max-w-full max-h-full object-contain"
                      autoPlay
                    />
                  ) : (
                    <img
                      src={allMedia[currentMediaIndex].url}
                      alt={`${selectedEvent.name} - Image ${currentMediaIndex + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
              )}

              {/* Navigation Arrows */}
              {allMedia.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 z-10"
                    onClick={previousMedia}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 z-10"
                    onClick={nextMedia}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* Thumbnail Strip (Bottom) */}
              {allMedia.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 overflow-x-auto px-4 pb-2">
                  {allMedia.map((media, index) => (
                    <button
                      key={index}
                      onClick={() => goToMedia(index)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0 ${
                        index === currentMediaIndex 
                          ? 'border-white shadow-lg shadow-white/50 scale-110' 
                          : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {media.type === 'video' ? (
                        <div className="relative w-full h-full">
                          <video
                            src={media.url}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={media.url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Modal with Premium Animations */}
          {!isFullScreenGallery && (
            <div 
              className={`fixed inset-0 z-50 flex items-end md:items-center justify-center ${
                modalAnimating ? 'animate-backdrop-blur-out' : 'animate-backdrop-blur-in'
              }`}
              style={{ 
                overflow: 'hidden',
                backdropFilter: 'blur(20px)',
                background: 'rgba(0, 0, 0, 0.85)'
              }}
              onClick={closeModal}
            >
              <div 
                className={`bg-gradient-to-br from-background via-background/98 to-background/95 rounded-t-3xl md:rounded-3xl w-full h-[95vh] md:h-[92vh] md:max-w-6xl flex flex-col shadow-2xl border-0 md:border border-primary/30 ${
                  modalAnimating ? 'animate-modal-exit' : 'animate-modal-enter'
                }`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  boxShadow: '0 0 80px hsl(285 85% 65% / 0.4), 0 20px 80px rgba(0,0,0,0.6)'
                }}
              >
                {/* Immersive Hero Banner */}
                <div className="relative overflow-hidden rounded-t-3xl flex-shrink-0">
                  <div className="relative w-full h-80 md:h-96 overflow-hidden">
                    <img
                      src={selectedEvent.poster_url || "/api/placeholder/800/400"}
                      alt={selectedEvent.name}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                    
                    {/* Gradient Overlay for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-accent/10 to-primary/15 pointer-events-none"></div>
                    
                    {/* Subtle Neon Glow Border */}
                    <div className="absolute inset-0 rounded-t-3xl pointer-events-none" 
                         style={{ 
                           boxShadow: 'inset 0 0 60px hsl(285 85% 65% / 0.2), 0 0 80px hsl(285 85% 65% / 0.15)'
                         }}></div>
                  </div>
          
                  {/* Close Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/30 transition-all duration-200 hover:scale-110 z-20"
                    onClick={closeModal}
                  >
                    <X className="w-5 h-5 md:w-6 h-6" />
                  </Button>
                  
                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex gap-2 flex-wrap z-20">
                    {selectedEvent.featured && (
                      <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg backdrop-blur-sm">
                        ⭐ {content[language].featured}
                      </Badge>
                    )}
                    {selectedEvent.event_status === 'cancelled' && (
                      <Badge className="bg-red-500 text-white border-0 shadow-lg backdrop-blur-sm">
                        ❌ {content[language].cancelled}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Event Title & Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 pb-8">
                    <h2 className="text-3xl md:text-5xl font-bold text-white drop-shadow-2xl mb-3 leading-tight">
                      {selectedEvent.name}
                    </h2>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 text-white/95">
                      <div className="flex items-center text-sm md:text-base">
                        <Calendar className="w-5 h-5 mr-2 text-primary" />
                        <span className="font-medium">{formatDate(selectedEvent.date)}</span>
                      </div>
                      <div className="flex items-center text-sm md:text-base">
                        <MapPin className="w-5 h-5 mr-2 text-pink-300" />
                        <span className="font-medium">{selectedEvent.venue}, {selectedEvent.city}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs for Details/Gallery */}
                {hasGallery && (
                  <div className="flex border-b border-border/20 bg-background/50 backdrop-blur-sm flex-shrink-0">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`flex-1 px-6 py-4 text-sm md:text-base font-semibold transition-all duration-200 border-b-2 ${
                        activeTab === 'details'
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Info className="w-4 h-4 md:w-5 h-5 inline-block mr-2" />
                      {content[language].details}
                    </button>
                    <button
                      onClick={() => setActiveTab('gallery')}
                      className={`flex-1 px-6 py-4 text-sm md:text-base font-semibold transition-all duration-200 border-b-2 ${
                        activeTab === 'gallery'
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 md:w-5 h-5 inline-block mr-2" />
                      {content[language].gallery} ({allMedia.length})
                    </button>
                  </div>
                )}

                {/* Content Area with Scroll Animations */}
                <div 
                  className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar"
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    const blocks = target.querySelectorAll('[data-content-block]');
                    blocks.forEach((block) => {
                      const rect = block.getBoundingClientRect();
                      const containerRect = target.getBoundingClientRect();
                      const isVisible = rect.top < containerRect.bottom * 0.8 && rect.bottom > containerRect.top;
                      if (isVisible && !contentBlocksAnimated.has(block.id)) {
                        setContentBlocksAnimated(prev => new Set([...prev, block.id]));
                      }
                    });
                  }}
                  ref={(el) => {
                    // Trigger initial animation check when modal opens
                    if (el) {
                      setTimeout(() => {
                        const blocks = el.querySelectorAll('[data-content-block]');
                        blocks.forEach((block) => {
                          const rect = block.getBoundingClientRect();
                          const containerRect = el.getBoundingClientRect();
                          const isVisible = rect.top < containerRect.bottom * 0.8 && rect.bottom > containerRect.top;
                          if (isVisible && !contentBlocksAnimated.has(block.id)) {
                            setContentBlocksAnimated(prev => new Set([...prev, block.id]));
                          }
                        });
                      }, 100);
                    }
                  }}
                >
                  {activeTab === 'details' ? (
                    <>
                      {/* Pricing Section - Show all passes */}
                      {selectedEvent.passes && selectedEvent.passes.length > 0 && (
                        <div 
                          id="pricing-block"
                          data-content-block
                          className={`bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-4 md:p-6 border border-primary/20 transition-all duration-700 ${
                            contentBlocksAnimated.has('pricing-block')
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-8'
                          }`}
                        >
                          <h3 className="text-lg md:text-xl font-bold text-gradient-neon mb-4 text-center flex items-center justify-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            {content[language].ticketPricing}
                          </h3>
                          <div className={`grid gap-4 ${
                            selectedEvent.passes && selectedEvent.passes.length > 0
                              ? selectedEvent.passes.length === 1 
                                ? 'grid-cols-1' 
                                : selectedEvent.passes.length === 2
                                ? 'grid-cols-1 md:grid-cols-2'
                                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                              : 'grid-cols-1 md:grid-cols-2'
                          }`}>
                            {/* Display all passes from event_passes table */}
                            {selectedEvent.passes.map((pass, idx) => {
                              return (
                                <div 
                                  key={idx}
                                  className="bg-background/80 backdrop-blur-sm rounded-xl p-4 md:p-6 text-center border border-border/20 transition-all duration-200 hover:border-primary/40"
                                >
                                  <h4 className="font-semibold text-base md:text-lg mb-2 text-foreground">
                                    {pass.name}
                                  </h4>
                                  <p className="text-2xl md:text-3xl font-bold text-gradient-to-r from-primary to-accent">
                                    {pass.price} TND
                                  </p>
                                  {pass.description && (
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                      {pass.description}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div 
                        id="description-block"
                        data-content-block
                        className={`bg-gradient-to-r from-primary/5 to-primary/5 rounded-2xl p-4 md:p-6 border border-primary/20 transition-all duration-700 ${
                          contentBlocksAnimated.has('description-block')
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-8'
                        }`}
                      >
                        <h3 className="text-lg md:text-xl font-bold text-gradient-to-r from-primary to-primary mb-4 flex items-center">
                          <span className="w-2 h-2 bg-primary rounded-full mr-3"></span>
                          {content[language].aboutEvent}
                        </h3>
                        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                          {selectedEvent.description}
                        </p>
                      </div>

                      {/* Event Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div 
                          id="details-block"
                          data-content-block
                          className={`bg-gradient-to-r from-green-500/5 to-primary/5 rounded-2xl p-4 md:p-6 border border-green-500/20 transition-all duration-700 ${
                            contentBlocksAnimated.has('details-block')
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-8'
                          }`}
                        >
                          <h4 className="font-semibold text-base md:text-lg text-green-400 mb-4 flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                            {content[language].eventDetails}
                          </h4>
                          <div className="space-y-3 text-muted-foreground text-sm md:text-base">
                            <div className="flex items-center p-2 bg-background/50 rounded-lg">
                              <Calendar className="w-4 h-4 mr-3 text-green-400 flex-shrink-0" />
                              <span className="break-words">{formatDate(selectedEvent.date)}</span>
                            </div>
                            <div className="flex items-center p-2 bg-background/50 rounded-lg">
                              <MapPin className="w-4 h-4 mr-3 text-green-400 flex-shrink-0" />
                              <span className="break-words">{selectedEvent.venue}</span>
                            </div>
                            <div className="flex items-center p-2 bg-background/50 rounded-lg">
                              <MapPin className="w-4 h-4 mr-3 text-green-400 flex-shrink-0" />
                              <span>{selectedEvent.city}</span>
                            </div>
                            {selectedEvent.capacity && (
                              <div className="flex items-center p-2 bg-background/50 rounded-lg">
                                <Users className="w-4 h-4 mr-3 text-green-400 flex-shrink-0" />
                                <span>{content[language].capacity}: {selectedEvent.capacity}</span>
                              </div>
                            )}
                            {selectedEvent.age_restriction && (
                              <div className="flex items-center p-2 bg-background/50 rounded-lg">
                                <Clock className="w-4 h-4 mr-3 text-green-400 flex-shrink-0" />
                                <span>{content[language].ageRestriction}: {selectedEvent.age_restriction}+</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div 
                          id="quickinfo-block"
                          data-content-block
                          className={`bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-2xl p-4 md:p-6 border border-orange-500/20 transition-all duration-700 ${
                            contentBlocksAnimated.has('quickinfo-block')
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-8'
                          }`}
                        >
                          <h4 className="font-semibold text-base md:text-lg text-orange-400 mb-4 flex items-center">
                            <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                            {content[language].quickInfo}
                          </h4>
                          <div className="space-y-3 text-muted-foreground text-sm md:text-base">
                            <div className="flex items-center p-2 bg-background/50 rounded-lg">
                              <span className="w-2 h-2 bg-orange-400 rounded-full mr-3 flex-shrink-0"></span>
                              <span>{selectedEvent.featured ? content[language].featured : 'Regular Event'}</span>
                            </div>
                            {selectedEvent.dress_code && (
                              <div className="flex items-center p-2 bg-background/50 rounded-lg">
                                <span className="w-2 h-2 bg-orange-400 rounded-full mr-3 flex-shrink-0"></span>
                                <span className="break-words">{content[language].dressCode}: {selectedEvent.dress_code}</span>
                              </div>
                            )}
                            {selectedEvent.special_notes && (
                              <div className="flex items-center p-2 bg-background/50 rounded-lg">
                                <span className="w-2 h-2 bg-orange-400 rounded-full mr-3 flex-shrink-0"></span>
                                <span className="break-words">{content[language].specialNotes}: {selectedEvent.special_notes}</span>
                              </div>
                            )}
                            {selectedEvent.organizer_contact && (
                              <div className="flex items-center p-2 bg-background/50 rounded-lg">
                                <span className="w-2 h-2 bg-orange-400 rounded-full mr-3 flex-shrink-0"></span>
                                <span className="break-words">{content[language].organizerContact}: {selectedEvent.organizer_contact}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {selectedEvent.event_type === 'upcoming' && (
                        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                          <Button 
                            className="btn-gradient flex-1 py-6 text-base md:text-lg font-semibold shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60 hover:scale-[1.02] transition-all duration-300"
                            onClick={() => {
                              closeModal();
                              const slug = selectedEvent.slug || generateSlug(selectedEvent.name);
                              navigate(`/${slug}`);
                            }}
                          >
                            <ExternalLink className="w-5 h-5 mr-2" />
                            {content[language].bookNow}
                          </Button>
                          {(selectedEvent.instagram_link || selectedEvent.whatsapp_link) && (
                            <Button
                              variant="outline"
                              className="flex-1 py-6 text-base md:text-lg font-semibold border border-pink-500/50 text-pink-500/80 hover:border-pink-500/70 hover:text-pink-500/90 hover:bg-pink-500/5 flex items-center justify-center gap-2 transition-all duration-300"
                              onClick={() => window.open(selectedEvent.instagram_link || selectedEvent.whatsapp_link, '_blank')}
                            >
                              <Camera className="w-5 h-5 flex-shrink-0" />
                              <span className="flex flex-col items-start leading-tight">
                                <span>{language === 'en' ? 'Join' : 'Rejoindre'}</span>
                                {language === 'en' && <span className="leading-none">Event</span>}
                              </span>
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Premium Horizontal Scrollable Gallery */
                    <div className="space-y-6">
                      {/* Horizontal Scrollable Media Carousel */}
                      <div 
                        ref={mediaContainerRef}
                        className="relative bg-gradient-to-br from-black/40 via-black/20 to-black/10 rounded-2xl overflow-x-auto overflow-y-hidden border border-primary/30 h-[70vh] md:h-[500px] min-h-[400px] md:min-h-[500px] shadow-2xl shadow-primary/10 snap-x snap-mandatory scrollbar-hide"
                        style={{
                          scrollBehavior: 'smooth',
                          WebkitOverflowScrolling: 'touch'
                        }}
                        onScroll={(e) => {
                          const container = e.currentTarget;
                          const scrollLeft = container.scrollLeft;
                          const itemWidth = container.clientWidth;
                          const currentIndex = Math.round(scrollLeft / itemWidth);
                          if (currentIndex !== currentMediaIndex && currentIndex < allMedia.length) {
                            setCurrentMediaIndex(currentIndex);
                          }
                        }}
                      >
                        <div className="flex h-full" style={{ width: `${allMedia.length * 100}%` }}>
                          {allMedia.map((media, index) => {
                            const imageKey = `${selectedEvent.id}-${index}`;
                            const isLoaded = imageLoaded.has(imageKey);
                            
                            return (
                              <div
                                key={index}
                                className="flex-shrink-0 w-full h-full snap-center"
                                style={{ width: `${100 / allMedia.length}%` }}
                              >
                                {media.type === 'video' ? (
                                  <div className="relative w-full h-full flex items-center justify-center bg-black/50">
                                    <video
                                      src={media.url}
                                      controls={!videoMuted}
                                      muted={videoMuted}
                                      autoPlay
                                      loop
                                      playsInline
                                      className="w-full h-full object-contain"
                                      onLoadedData={() => setImageLoaded(prev => new Set([...prev, imageKey]))}
                                    />
                                    {/* Mute/Unmute Toggle */}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 z-20"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setVideoMuted(!videoMuted);
                                      }}
                                    >
                                      {videoMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                    </Button>
                                  </div>
                                ) : (
                                  <div 
                                    className="relative w-full h-full cursor-pointer group"
                                    onClick={() => openLightbox(index)}
                                  >
                                    {/* Progressive Blur Placeholder */}
                                    {!isLoaded && (
                                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse blur-2xl z-0"></div>
                                    )}
                                    
                                    {/* Main Image */}
                                    <img
                                      src={media.url}
                                      alt={`${selectedEvent.name} - Image ${index + 1}`}
                                      className="w-full h-full object-contain transition-opacity duration-300"
                                      loading="lazy"
                                      onLoad={() => {
                                        setImageLoaded(prev => new Set([...prev, imageKey]));
                                      }}
                                    />
                                    
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-95 group-hover:scale-100">
                                        <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-2 border border-primary/50">
                                          <Maximize2 className="w-6 h-6 text-white" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Gallery Navigation Dots */}
                      {allMedia.length > 1 && (
                        <div className="flex justify-center gap-2">
                          {allMedia.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (mediaContainerRef.current) {
                                  const itemWidth = mediaContainerRef.current.clientWidth;
                                  mediaContainerRef.current.scrollTo({
                                    left: index * itemWidth,
                                    behavior: 'smooth'
                                  });
                                }
                                setCurrentMediaIndex(index);
                              }}
                              className={`h-2 rounded-full transition-all duration-300 ${
                                index === currentMediaIndex
                                  ? 'w-8 bg-gradient-to-r from-primary to-accent'
                                  : 'w-2 bg-white/30 hover:bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Premium Thumbnail Navigation with Smooth Scrolling */}
                      {allMedia.length > 1 && (
                        <div className="flex justify-center gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                          {allMedia.map((media, index) => {
                            const isActive = index === currentMediaIndex;
                            return (
                              <button
                                key={index}
                                onClick={() => goToMedia(index)}
                                className={`relative w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border-2 transition-all duration-300 flex-shrink-0 group ${
                                  isActive 
                                    ? 'border-primary shadow-lg shadow-primary/50 scale-110 ring-2 ring-primary/50' 
                                    : 'border-border/50 hover:border-primary/50 opacity-70 hover:opacity-100 hover:scale-105'
                                }`}
                              >
                                {media.type === 'video' ? (
                                  <>
                                    <video
                                      src={media.url}
                                      className="w-full h-full object-cover"
                                      muted
                                      playsInline
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                      <Play className="w-4 h-4 text-white" />
                                    </div>
                                  </>
                                ) : (
                                  <img
                                    src={media.url}
                                    alt={`Thumbnail ${index + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                )}
                                {/* Active Indicator */}
                                {isActive && (
                                  <div className="absolute inset-0 border-2 border-primary rounded-xl animate-pulse"></div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Keyboard Navigation Hint */}
                      <div className="text-center text-xs text-muted-foreground">
                        <p>{language === 'en' ? 'Use arrow keys to navigate • Click image for fullscreen' : 'Utilisez les flèches pour naviguer • Cliquez sur l\'image pour plein écran'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Premium Lightbox Modal with Fade-out UI */}
      {lightboxOpen && selectedEvent && (
        <div 
          className="fixed inset-0 z-[70] bg-black/98 backdrop-blur-xl flex items-center justify-center"
          onClick={closeLightbox}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Minimal UI - Fades in on hover, fades out for immersion */}
          <div className="absolute inset-0">
            {/* Close Button - Always visible */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-primary/30 transition-all duration-300 hover:scale-110 z-30"
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
            >
              <X className="w-6 h-6" />
            </Button>

            {/* Media Counter - Always visible */}
            {allMedia.length > 1 && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary/60 to-accent/60 text-white px-6 py-2 rounded-full backdrop-blur-md text-sm font-semibold border border-primary/30 shadow-lg z-30">
                {lightboxIndex + 1} / {allMedia.length}
              </div>
            )}

            {/* Navigation Arrows - Always visible */}
            {allMedia.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 md:left-8 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-primary/30 transition-all duration-300 hover:scale-110 z-30 hover:border-primary/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    previousLightbox();
                  }}
                  style={{
                    boxShadow: '0 0 20px hsl(285 85% 65% / 0.3)'
                  }}
                >
                  <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 md:right-8 top-1/2 transform -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-primary/30 transition-all duration-300 hover:scale-110 z-30 hover:border-primary/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextLightbox();
                  }}
                  style={{
                    boxShadow: '0 0 20px hsl(285 85% 65% / 0.3)'
                  }}
                >
                  <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                </Button>
              </>
            )}
          </div>

          {/* Main Media Display */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-4 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {allMedia[lightboxIndex] && (
              <div className="relative max-w-full max-h-full">
                {allMedia[lightboxIndex].type === 'video' ? (
                  <>
                    <video
                      src={allMedia[lightboxIndex].url}
                      controls={!videoMuted}
                      autoPlay
                      loop
                      playsInline
                      className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                      muted={videoMuted}
                    />
                    {/* Mute/Unmute Toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-110 z-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoMuted(!videoMuted);
                      }}
                    >
                      {videoMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </Button>
                  </>
                ) : (
                  <img
                    src={allMedia[lightboxIndex].url}
                    alt={`${selectedEvent.name} - Image ${lightboxIndex + 1}`}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    loading="eager"
                  />
                )}
              </div>
            )}
          </div>

          {/* Thumbnail Strip (Bottom) */}
          {allMedia.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
              {allMedia.map((media, index) => {
                const isActive = index === lightboxIndex;
                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(index);
                    }}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0 ${
                      isActive 
                        ? 'border-primary shadow-lg shadow-primary/50 scale-110 ring-2 ring-primary/50' 
                        : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    {media.type === 'video' ? (
                      <div className="relative w-full h-full">
                        <video
                          src={media.url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Play className="w-3 h-3 md:w-4 md:h-4 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={media.url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default Events;
