import { useState, useEffect } from "react";
import { Calendar, MapPin, ExternalLink, Play, X, ChevronLeft, ChevronRight, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  standard_price?: number;
  vip_price?: number;
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

interface EventsProps {
  language: 'en' | 'fr';
}

const Events = ({ language }: EventsProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

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
      completed: "Completed"
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
      completed: "Terminé"
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Cleanup effect to restore scrollbar when component unmounts
  useEffect(() => {
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
    setLoading(false);
  };

  const upcomingEvents = events.filter(event => 
    (event.event_type === 'upcoming' || !event.event_type) && 
    event.event_status !== 'cancelled'
  );

  const galleryEvents = events.filter(event => 
    event.event_type === 'gallery'
  );

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

  const openModal = (event: Event) => {
    console.log('Opening modal, hiding scrollbar');
    setSelectedEvent(event);
    setCurrentMediaIndex(0);
    setShowModal(true);
    // Hide scrollbar when modal is open
    document.body.classList.add('modal-open');
  };

  const closeModal = () => {
    console.log('Closing modal, restoring scrollbar');
    setShowModal(false);
    setSelectedEvent(null);
    setCurrentMediaIndex(0);
    // Restore scrollbar when modal is closed
    document.body.classList.remove('modal-open');
  };

  const nextMedia = () => {
    if (!selectedEvent) return;
    const totalMedia = (selectedEvent.gallery_images?.length || 0) + (selectedEvent.gallery_videos?.length || 0);
    setCurrentMediaIndex((currentMediaIndex + 1) % totalMedia);
  };

  const previousMedia = () => {
    if (!selectedEvent) return;
    const totalMedia = (selectedEvent.gallery_images?.length || 0) + (selectedEvent.gallery_videos?.length || 0);
    setCurrentMediaIndex((currentMediaIndex - 1 + totalMedia) % totalMedia);
  };

  const goToMedia = (index: number) => {
    setCurrentMediaIndex(index);
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
            {content[language].title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {content[language].subtitle}
          </p>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
              {content[language].upcomingTitle}
            </h2>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-2xl text-muted-foreground">{content[language].noUpcomingEvents}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {upcomingEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="glass hover-lift overflow-hidden cursor-pointer"
                  onClick={() => openModal(event)}
                >
                    <div className="relative">
                      <img
                        src={event.poster_url || "/api/placeholder/400/300"}
                        alt={event.name}
                        className="w-full h-48 object-cover"
                      />
                      
                      {event.featured && (
                        <Badge className="absolute top-4 left-4 bg-gradient-primary">
                        {content[language].featured}
                      </Badge>
                    )}
                      
                    {/* Click overlay */}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 hover:opacity-100 transition-opacity text-white text-center">
                        <p className="text-sm font-semibold">{content[language].viewDetails}</p>
                      </div>
                    </div>
                  </div>
                  
                  <CardHeader className="p-4">
                    <h3 className="text-xl font-bold text-primary line-clamp-2">{event.name}</h3>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>{formatDate(event.date)}</span>
                      </div>
                      
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        <span>{event.venue}, {event.city}</span>
                    </div>
                      
                    {(event.standard_price || event.vip_price) && (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary">
                            {event.standard_price && formatPrice(event.standard_price)}
                            {event.standard_price && event.vip_price && ' - '}
                            {event.vip_price && formatPrice(event.vip_price)}
                          </span>
                      </div>
                    )}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Event Gallery Section */}
      {galleryEvents.length > 0 && (
          <section className="py-20 bg-gradient-dark">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gradient-neon mb-4">
                {content[language].galleryTitle}
              </h2>
            </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {galleryEvents.map((event) => (
                    <Card 
                  key={event.id} 
                      className="glass overflow-hidden cursor-pointer hover-lift group"
                  onClick={() => openModal(event)}
                    >
                      <div className="relative aspect-square">
                        <img
                      src={event.poster_url || "/api/placeholder/400/400"}
                      alt={event.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    
                    {/* Media count badge */}
                    {(event.gallery_images?.length || 0) + (event.gallery_videos?.length || 0) > 0 && (
                      <Badge className="absolute top-2 right-2 bg-purple-500">
                        {(event.gallery_images?.length || 0) + (event.gallery_videos?.length || 0)} Media
                      </Badge>
                    )}
                    
                    {/* Click overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center">
                        <p className="text-sm font-semibold">{content[language].viewDetails}</p>
                      </div>
                    </div>
                  </div>
                  
                      <CardContent className="p-4">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2">
                      {event.name}
                        </h3>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(event.date)}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {event.city}
                    </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
            </div>
          </section>
      )}

            {/* Event Modal */}
      {showModal && selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ overflow: 'hidden' }}>
          <div className="bg-gradient-to-br from-background via-background/95 to-background/90 rounded-3xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl border border-border/20 animate-in slide-in-from-bottom-4 duration-300">
            {/* Header with Gradient Overlay */}
            <div className="relative overflow-hidden rounded-t-3xl">
              <img
                src={selectedEvent.poster_url || "/api/placeholder/800/400"}
                alt={selectedEvent.name}
                className="w-full h-72 md:h-80 object-cover"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-6 right-6 bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-110"
                onClick={closeModal}
              >
                <X className="w-5 h-5" />
              </Button>
              
              {/* Badges */}
              <div className="absolute top-6 left-6 flex gap-2">
                {selectedEvent.featured && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg">
                    ⭐ {content[language].featured}
                  </Badge>
                )}
                
                {selectedEvent.event_status === 'cancelled' && (
                  <Badge className="bg-red-500 text-white border-0 shadow-lg">
                    ❌ {content[language].cancelled}
                  </Badge>
                )}
              </div>
              
              {/* Event Title Overlay */}
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg mb-2">
                  {selectedEvent.name}
                </h2>
                <div className="flex items-center gap-4 text-white/90 text-sm">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{formatDate(selectedEvent.date)}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{selectedEvent.venue}, {selectedEvent.city}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8 flex-1 overflow-y-auto">
              {/* Pricing Section */}
              {(selectedEvent.standard_price || selectedEvent.vip_price) && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
                  <h3 className="text-xl font-bold text-gradient-neon mb-4 text-center">
                    {content[language].ticketPricing}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEvent.standard_price && (
                      <div className="bg-background/80 backdrop-blur-sm rounded-xl p-4 text-center border border-border/20 hover:border-purple-500/40 transition-all duration-200">
                        <h4 className="font-semibold text-lg mb-2 text-purple-400">{content[language].standard}</h4>
                        <p className="text-3xl font-bold text-gradient-to-r from-purple-400 to-pink-400">{selectedEvent.standard_price} TND</p>
                      </div>
                    )}
                    {selectedEvent.vip_price && (
                      <div className="bg-background/80 backdrop-blur-sm rounded-xl p-4 text-center border border-border/20 hover:border-pink-500/40 transition-all duration-200">
                        <h4 className="font-semibold text-lg mb-2 text-pink-400">{content[language].vip}</h4>
                        <p className="text-3xl font-bold text-gradient-to-r from-pink-400 to-purple-400">{selectedEvent.vip_price} TND</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing Section */}
              {(selectedEvent.standard_price || selectedEvent.vip_price) && (
                <div className="bg-gradient-dark rounded-xl p-4 mb-6">
                  <h3 className="text-lg font-bold text-gradient-neon mb-3 text-center">
                    {content[language].ticketPricing}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedEvent.standard_price && (
                      <div className="bg-background/50 rounded-lg p-3 text-center">
                        <h4 className="font-semibold text-sm mb-1">{content[language].standard}</h4>
                        <p className="text-xl font-bold text-primary">{selectedEvent.standard_price} TND</p>
                      </div>
                    )}
                    {selectedEvent.vip_price && (
                      <div className="bg-background/50 rounded-lg p-3 text-center">
                        <h4 className="font-semibold text-sm mb-1">{content[language].vip}</h4>
                        <p className="text-xl font-bold text-primary">{selectedEvent.vip_price} TND</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description - Modern Card Design */}
              <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-2xl p-6 border border-blue-500/20">
                <h3 className="text-xl font-bold text-gradient-to-r from-blue-400 to-purple-400 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                  {content[language].aboutEvent}
                </h3>
                <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>
              </div>

              {/* Event Details Grid - Modern Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-green-500/5 to-blue-500/5 rounded-2xl p-6 border border-green-500/20">
                  <h4 className="font-semibold text-lg text-green-400 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                    {content[language].eventDetails}
                  </h4>
                  <div className="space-y-3 text-muted-foreground">
                    <div className="flex items-center p-2 bg-background/50 rounded-lg">
                      <Calendar className="w-4 h-4 mr-3 text-green-400" />
                      <span>{formatDate(selectedEvent.date)}</span>
                    </div>
                    <div className="flex items-center p-2 bg-background/50 rounded-lg">
                      <MapPin className="w-4 h-4 mr-3 text-green-400" />
                      <span>{selectedEvent.venue}</span>
                    </div>
                    <div className="flex items-center p-2 bg-background/50 rounded-lg">
                      <MapPin className="w-4 h-4 mr-3 text-green-400" />
                      <span>{selectedEvent.city}</span>
                    </div>
                    {selectedEvent.capacity && (
                      <div className="flex items-center p-2 bg-background/50 rounded-lg">
                        <Users className="w-4 h-4 mr-3 text-green-400" />
                        <span>{content[language].capacity}: {selectedEvent.capacity}</span>
                      </div>
                    )}
                    {selectedEvent.age_restriction && (
                      <div className="flex items-center p-2 bg-background/50 rounded-lg">
                        <Clock className="w-4 h-4 mr-3 text-green-400" />
                        <span>{content[language].ageRestriction}: {selectedEvent.age_restriction}+</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-2xl p-6 border border-orange-500/20">
                  <h4 className="font-semibold text-lg text-orange-400 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                    {content[language].quickInfo}
                  </h4>
                  <div className="space-y-3 text-muted-foreground">
                    <div className="flex items-center p-2 bg-background/50 rounded-lg">
                      <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                      <span>{selectedEvent.featured ? content[language].featured : 'Regular Event'}</span>
                    </div>
                    {selectedEvent.dress_code && (
                      <div className="flex items-center p-2 bg-background/50 rounded-lg">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                        <span>{content[language].dressCode}: {selectedEvent.dress_code}</span>
                      </div>
                    )}
                    {selectedEvent.special_notes && (
                      <div className="flex items-center p-2 bg-background/50 rounded-lg">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                        <span>{content[language].specialNotes}: {selectedEvent.special_notes}</span>
                      </div>
                    )}
                    {selectedEvent.organizer_contact && (
                      <div className="flex items-center p-2 bg-background/50 rounded-lg">
                        <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                        <span>{content[language].organizerContact}: {selectedEvent.organizer_contact}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons - Modern Design */}
              {selectedEvent.event_type === 'upcoming' && (
                <div className="flex flex-col sm:flex-row gap-4">
                  {selectedEvent.ticket_link && (
                    <Button 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 flex-1 py-6 text-lg font-semibold rounded-xl"
                      onClick={() => window.open(selectedEvent.ticket_link, '_blank')}
                    >
                      <ExternalLink className="w-5 h-5 mr-2" />
                      {content[language].bookNow}
                    </Button>
                  )}
                  {selectedEvent.whatsapp_link && (
              <Button
                      variant="outline"
                      className="border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all duration-200 flex-1 py-6 text-lg font-semibold rounded-xl backdrop-blur-sm"
                      onClick={() => window.open(selectedEvent.whatsapp_link, '_blank')}
              >
                      💬 {content[language].joinEvent}
              </Button>
                  )}
                </div>
          )}
          
              {/* Gallery Media - Modern Design */}
              {selectedEvent.event_type === 'gallery' && 
               ((selectedEvent.gallery_images?.length || 0) + (selectedEvent.gallery_videos?.length || 0) > 0) && (
                <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-2xl p-6 border border-indigo-500/20">
                  <h3 className="text-xl font-bold text-gradient-to-r from-indigo-400 to-purple-400 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full mr-3"></span>
                    {language === 'en' ? 'Event Media' : 'Médias de l\'Événement'}
                  </h3>
                  
                  {/* Main Media Display */}
                  <div className="relative h-64 bg-gradient-to-br from-black/20 to-black/10 rounded-xl overflow-hidden mb-4 border border-indigo-500/20">
            {(() => {
              const allMedia = [
                ...(selectedEvent.gallery_images?.map((url, index) => ({
                  type: 'image' as const,
                  url,
                  index
                })) || []),
                ...(selectedEvent.gallery_videos?.map((url, index) => ({
                  type: 'video' as const,
                  url,
                  index: index + (selectedEvent.gallery_images?.length || 0)
                })) || [])
              ];
              
                      const currentMedia = allMedia[currentMediaIndex];
              
              if (!currentMedia) {
                return (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No media available</p>
                  </div>
                );
              }
              
              return currentMedia.type === 'video' ? (
                <video
                  src={currentMedia.url}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={currentMedia.url}
                  alt={`${selectedEvent.name} - Image ${currentMedia.index + 1}`}
                  className="w-full h-full object-contain"
                />
              );
            })()}
          </div>
          
                  {/* Navigation */}
          {(() => {
            const allMedia = [
              ...(selectedEvent.gallery_images?.map((url, index) => ({
                type: 'image' as const,
                url,
                index
              })) || []),
              ...(selectedEvent.gallery_videos?.map((url, index) => ({
                type: 'video' as const,
                url,
                index: index + (selectedEvent.gallery_images?.length || 0)
              })) || [])
            ];
            
            if (allMedia.length <= 1) return null;
            
            return (
                      <div className="space-y-4">
                        {/* Media Counter */}
                        <div className="text-center">
                          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                            {currentMediaIndex + 1} / {allMedia.length}
                          </span>
                        </div>
                        
                        {/* Navigation Arrows */}
                        <div className="flex justify-center space-x-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={previousMedia}
                            className="bg-background/80 backdrop-blur-sm border-indigo-500/30 hover:border-indigo-500/60 hover:bg-indigo-500/10 transition-all duration-200"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={nextMedia}
                            className="bg-background/80 backdrop-blur-sm border-indigo-500/30 hover:border-indigo-500/60 hover:bg-indigo-500/10 transition-all duration-200"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Thumbnail Navigation */}
                        <div className="flex justify-center space-x-2 overflow-x-auto pb-2">
                {allMedia.map((media, index) => (
                  <button
                    key={index}
                              onClick={() => goToMedia(index)}
                              className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0 hover:scale-105 ${
                                index === currentMediaIndex 
                                  ? 'border-indigo-500 shadow-lg shadow-indigo-500/25' 
                                  : 'border-border/50 hover:border-indigo-500/50'
                    }`}
                  >
                    {media.type === 'video' ? (
                      <div className="relative w-full h-full">
                        <video
                          src={media.url}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <Play className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={media.url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
                        </div>
              </div>
            );
          })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;