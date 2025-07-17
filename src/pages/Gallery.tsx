import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface GalleryItem {
  id: string;
  title: string;
  image_url: string;
  video_url?: string;
  event_id?: string;
  city?: string;
  type: 'photo' | 'video';
}

interface GalleryProps {
  language: 'en' | 'fr';
}

interface GalleryContent {
  title?: string;
  description?: string;
  [key: string]: string | undefined;
}

const Gallery = ({ language }: GalleryProps) => {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [galleryContent, setGalleryContent] = useState<GalleryContent>({});

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'gallery_content');

        if (error) throw error;
        if (data?.[0]) {
          setGalleryContent(data[0].content as GalleryContent);
        }
      } catch (error) {
        console.error('Error fetching gallery content:', error);
      }
    };

    fetchSiteContent();
  }, []);

  const content = {
    en: {
      title: "Event Gallery",
      subtitle: "Relive the best moments from our incredible events",
      allEvents: "All Events",
      photos: "Photos",
      videos: "Videos",
      cities: ["All Cities", "Tunis", "Sousse", "Monastir", "Sfax"],
      noItems: "No gallery items found",
      viewFull: "View Full Gallery"
    },
    fr: {
      title: "Galerie d'Événements",
      subtitle: "Revivez les meilleurs moments de nos événements incroyables",
      allEvents: "Tous les Événements",
      photos: "Photos",
      videos: "Vidéos", 
      cities: ["Toutes les Villes", "Tunis", "Sousse", "Monastir", "Sfax"],
      noItems: "Aucun élément de galerie trouvé",
      viewFull: "Voir la Galerie Complète"
    }
  };

  useEffect(() => {
    fetchGalleryItems();
  }, []);

  const filterItems = useCallback(() => {
    let filtered = galleryItems;
    
    if (selectedCategory === 'photos') {
      filtered = galleryItems.filter(item => item.type === 'photo');
    } else if (selectedCategory === 'videos') {
      filtered = galleryItems.filter(item => item.type === 'video');
    } else if (selectedCategory !== 'all') {
      filtered = galleryItems.filter(item => 
        item.city?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    setFilteredItems(filtered);
  }, [galleryItems, selectedCategory]);

  useEffect(() => {
    filterItems();
  }, [filterItems]);

  const fetchGalleryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGalleryItems((data || []) as GalleryItem[]);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    }
    setLoading(false);
  };

  const openLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % filteredItems.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
  };

  if (loading) {
    return (
      <div className="pt-16 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading gallery...</p>
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
            {galleryContent?.title || content[language].title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {galleryContent?.description || content[language].subtitle}
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b border-border/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'btn-gradient' : ''}
            >
              {content[language].allEvents}
            </Button>
            <Button
              variant={selectedCategory === 'photos' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('photos')}
              className={selectedCategory === 'photos' ? 'btn-gradient' : ''}
            >
              {content[language].photos}
            </Button>
            <Button
              variant={selectedCategory === 'videos' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('videos')}
              className={selectedCategory === 'videos' ? 'btn-gradient' : ''}
            >
              {content[language].videos}
            </Button>
            {content[language].cities.slice(1).map((city) => (
              <Button
                key={city}
                variant={selectedCategory === city ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(city)}
                className={selectedCategory === city ? 'btn-gradient' : ''}
              >
                {city}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-2xl text-muted-foreground">{content[language].noItems}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item, index) => (
                <Card 
                  key={item.id} 
                  className="glass overflow-hidden cursor-pointer hover-lift group"
                  onClick={() => openLightbox(index)}
                >
                  <div className="relative aspect-square">
                    <img
                      src={item.image_url || "/api/placeholder/400/400"}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {item.type === 'video' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary">
                        {item.city || 'Event'}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightboxOpen && filteredItems.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
            onClick={prevImage}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
            onClick={nextImage}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>

          <div className="max-w-4xl max-h-[80vh] w-full mx-4">
            {filteredItems[currentIndex]?.type === 'video' ? (
              <video
                src={filteredItems[currentIndex].video_url}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={filteredItems[currentIndex]?.image_url || "/api/placeholder/800/600"}
                alt={filteredItems[currentIndex]?.title}
                className="w-full h-full object-contain"
              />
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-center">
            <h3 className="text-lg font-semibold">{filteredItems[currentIndex]?.title}</h3>
            <p className="text-sm text-white/70">
              {currentIndex + 1} / {filteredItems.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;