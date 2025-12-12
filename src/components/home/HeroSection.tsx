import { useState, useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import TypewriterText from "./TypewriterText";

interface HeroSectionProps {
  language: 'en' | 'fr';
  onMediaLoaded?: () => void;
}

interface SiteContentItem {
  key: string;
  content: any; // Using any for Supabase Json type
}

interface HeroSlide {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  poster?: string;
}

// Video slide component with lazy loading
const VideoSlide = ({ slide, isActive, isPageInteractive, onLoaded }: { slide: HeroSlide; isActive: boolean; isPageInteractive: boolean; onLoaded?: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasNotified = useRef(false);

  // Load video immediately for loading screen tracking
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      // Preload video immediately with high priority
      video.preload = 'auto';
      video.load();
      // Try to load faster
      if ('webkitDecodedFrameCount' in video) {
        // Force faster loading on WebKit browsers
        video.load();
      }
    }
  }, []);

  // Try to play when active and page is interactive
  useEffect(() => {
    if (videoRef.current && isActive && isPageInteractive) {
      const video = videoRef.current;
      video.play().catch((err) => {
        console.warn('Video autoplay prevented:', err);
      });
    }
  }, [isActive, isPageInteractive]);

  return (
    <video
      ref={videoRef}
      src={slide.src}
      poster={slide.poster}
      className="w-full h-full object-cover"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      style={{ 
        objectFit: 'cover',
        width: '100%',
        height: '100%'
      }}
      onLoadedData={(e) => {
        // Ensure video is muted and ready - critical for autoplay
        const video = e.currentTarget;
        video.muted = true;
        video.volume = 0;
        // Notify that first frame is ready (loadeddata fires when first frame can be displayed)
        // This is what we want - don't wait for full video download
        if (!hasNotified.current) {
          hasNotified.current = true;
          onLoaded?.();
        }
        // Force play to ensure autoplay works (only if active)
        if (isActive) {
          video.play().catch((err) => {
            console.warn('Video autoplay prevented:', err);
          });
        }
      }}
      onCanPlay={(e) => {
        // Alternative: canplay also fires when first frame is ready
        // Use this as backup if loadeddata doesn't fire
        if (!hasNotified.current) {
          hasNotified.current = true;
          onLoaded?.();
        }
      }}
      onPlay={(e) => {
        // Ensure video stays muted even if browser tries to unmute
        const video = e.currentTarget;
        if (!video.muted) {
          video.muted = true;
          video.volume = 0;
        }
      }}
      onError={() => {
        // Count errors as "loaded" to prevent infinite loading - only once
        if (!hasNotified.current) {
          hasNotified.current = true;
          onLoaded?.();
        }
      }}
    />
  );
};

const HeroSection = ({ language, onMediaLoaded }: HeroSectionProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroContent, setHeroContent] = useState<any>({});
  const [isPageInteractive, setIsPageInteractive] = useState(false);
  const [loadedMedia, setLoadedMedia] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure we start with the first slide
  useEffect(() => {
    setCurrentSlide(0);
  }, [heroContent]);

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'hero_section');

        if (error) throw error;

        if (data && data[0]) {
          setHeroContent(data[0].content as any);
        }
      } catch (error) {
        console.error('Error fetching site content:', error);
      }
    };

    fetchSiteContent();
  }, []);

  // Start loading videos immediately for loading screen tracking
  // We want to track all media loading, so we load videos right away
  useEffect(() => {
    // Set interactive immediately to start loading videos
    setIsPageInteractive(true);
  }, []);

  const defaultContent = {
    en: {
      title: "Live the Night with Andiamo",
      subtitle: "Tunisia's Premier Nightlife Experience",
      description: "Join thousands of party-goers across Tunisia for unforgettable nights filled with energy, music, and memories that last forever.",
      cta: "Join the Movement",
      watchVideo: "Watch Highlights"
    },
    fr: {
      title: "Vivez la Nuit avec Andiamo",
      subtitle: "L'Expérience Nocturne Premium de Tunisie",
      description: "Rejoignez des milliers de fêtards à travers la Tunisie pour des nuits inoubliables remplies d'énergie, de musique et de souvenirs qui durent pour toujours.",
      cta: "Rejoignez le Mouvement",
      watchVideo: "Voir les Highlights"
    }
  };

  // Typewriter texts for the first part of the title
  const typewriterTexts = {
    en: [
      "Live the Night",
      "Dance the Night Away",
      "Experience the Ultimate Party",
      "Join the Nightlife Revolution",
      "Where Music Meets Magic",
    ],
    fr: [
      "Vivez la Nuit",
      "Dansez toute la Nuit",
      "Vivez la Fête Ultime",
      "Rejoignez la Révolution Nocturne",
      "Là où la Musique Rencontre la Magie",
    ],
  };

  const staticSuffix = language === 'en' ? "with Andiamo" : "avec Andiamo";

  // Use Supabase content if available, otherwise fall back to default
  const content = heroContent[language] || defaultContent[language];
  
  // Get hero images from Supabase content
  // If no images are set in Supabase, use empty array (will show placeholder or nothing)
  const heroSlides = heroContent.images || [];

  // Track critical hero media loading only
  // Only wait for hero images (decoded) and hero videos (first frame ready)
  useEffect(() => {
    if (heroSlides.length === 0) {
      // If no slides, consider media loaded immediately
      onMediaLoaded?.();
      return;
    }

    // Set a maximum timeout (5 seconds) to prevent infinite loading
    // This ensures we don't block the user experience
    const maxTimeout = setTimeout(() => {
      console.warn('Critical hero media loading timeout - showing content anyway');
      onMediaLoaded?.();
    }, 5000);

    // Check if all critical hero media is loaded
    // Images: ready when decoded (onLoad)
    // Videos: ready when first frame can display (loadeddata/canplay)
    if (loadedMedia.size === heroSlides.length && heroSlides.length > 0) {
      clearTimeout(maxTimeout);
      // Immediate reveal - no delay needed since media is ready
      // Layout is already calculated, media is decoded/ready
      onMediaLoaded?.();
      return () => clearTimeout(maxTimeout);
    }

    return () => clearTimeout(maxTimeout);
  }, [loadedMedia.size, heroSlides.length, onMediaLoaded]);

  // Handle media load callbacks
  const handleMediaLoad = (index: number) => {
    setLoadedMedia(prev => new Set([...prev, index]));
  };

  // Handle slide transitions with crossfade effect
  // Only start transitions after media is loaded
  useEffect(() => {
    if (heroSlides.length === 0) return;
    if (loadedMedia.size < heroSlides.length) {
      // Reset to first slide while loading
      setCurrentSlide(0);
      return;
    }
    
    // Reset to first slide when all media is loaded
    setCurrentSlide(0);
    
    // Clear any existing timer
    if (transitionTimerRef.current) {
      clearInterval(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    
    // Start transitions after a brief delay
    const startTimer = setTimeout(() => {
      transitionTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 6000); // 6 seconds per slide for better video viewing
    }, 500);
    
    return () => {
      clearTimeout(startTimer);
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [heroSlides.length, loadedMedia.size]);


  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-gradient-dark">
      {/* Background Slideshow with Crossfade Transition */}
      <div className="absolute inset-0 z-0">
        {heroSlides.length > 0 ? heroSlides.map((slide, index) => {
          const isActive = index === currentSlide;
          
          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-[2s] ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              {slide.type === 'video' ? (
                <VideoSlide 
                  slide={slide} 
                  isActive={isActive} 
                  isPageInteractive={isPageInteractive}
                  onLoaded={() => handleMediaLoad(index)}
                />
              ) : (
                <img
                  src={slide.src}
                  alt={slide.alt || `Hero slide ${index + 1}`}
                  className="w-full h-full object-cover"
                  style={{ objectFit: 'cover' }}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => {
                    // Image is ready when decoded - this is what we need for LCP
                    // Browser has finished decoding the image
                    handleMediaLoad(index);
                  }}
                  onError={() => {
                    // Count errors as "loaded" to prevent infinite loading
                    handleMediaLoad(index);
                  }}
                />
              )}
              <div className="absolute inset-0 bg-black/60" />
            </div>
          );
        }) : (
          // Fallback when no slides are available
          <div className="absolute inset-0 bg-gradient-dark" />
        )}
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-10">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-24 h-24 rounded-full bg-gradient-to-r from-accent/20 to-primary/20 animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 rounded-full bg-gradient-to-r from-secondary/20 to-accent/20 animate-float" style={{ animationDelay: "2s" }} />
      </div>

      {/* Content */}
      <div className="relative z-20 text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 min-h-[1.2em]">
            <span className="block text-gradient-neon animate-pulse-glow">
              <TypewriterText 
                texts={typewriterTexts[language]}
                speed={80}
                deleteSpeed={40}
                pauseTime={2500}
                className="inline"
              />
            </span>
            <span className="block text-white mt-2 animate-pulse-glow">
              {staticSuffix}
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-secondary font-medium mb-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            {content?.subtitle || defaultContent[language].subtitle}
          </p>
          
          {/* Description text removed for testing */}
          {/* <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            {content?.description || defaultContent[language].description}
          </p> */}

          <div className="flex justify-center items-center animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <Button
              variant="outline"
              size="lg"
              className="btn-neon text-lg px-8 py-4 hover:scale-110 active:scale-95 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/50 relative overflow-hidden group"
              onClick={() => navigate('/events')}
            >
              <span className="relative z-10 flex items-center">
                <Play className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:scale-110" />
                {content?.watchVideo || defaultContent[language].watchVideo}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Button>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      {heroSlides.length > 0 && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex space-x-2">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? "bg-primary scale-125"
                    : "bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 right-8 z-20 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;