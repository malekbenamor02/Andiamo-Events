import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn, generateSlug } from "@/lib/utils";
import { avifVariantUrl, buildHeroImageSrcSet } from "@/lib/image-utils";
import TypewriterText from "./TypewriterText";
import { HeroMultiEventCarousel } from "./HeroMultiEventCarousel";
import { useFeaturedEvents, type Event } from "@/hooks/useEvents";
import { isPassPurchaseWindowClosed } from "@/lib/date-utils";
import { isLocalhostClient } from "@/lib/localhost";

interface HeroSectionProps {
  language: 'en' | 'fr';
  onMediaLoaded?: () => void;
}

interface HeroSlide {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  poster?: string;
  thumbUrl?: string;
  midUrl?: string;
  avifUrl?: string;
}

/** While hero copy is loading, or when admin left no lines for this language */
const PLACEHOLDER_TYPEWRITER_LINE = "We Create Memories";

const VideoSlide = ({
  slide,
  isActive,
  isPageInteractive,
  loadSource,
  onLoaded,
}: {
  slide: HeroSlide;
  isActive: boolean;
  isPageInteractive: boolean;
  /** When false, no `src` — avoids downloading off-screen hero videos */
  loadSource: boolean;
  onLoaded?: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasNotified = useRef(false);

  useEffect(() => {
    if (loadSource) {
      hasNotified.current = false;
    }
  }, [loadSource]);

  const attemptPlay = async (reason: string) => {
    const video = videoRef.current;
    if (!video) return;
    if (!isActive) return;

    // Required for mobile autoplay policies
    video.muted = true;
    video.volume = 0;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    // Avoid throwing before metadata is present
    try {
      await video.play();
    } catch (err) {
      console.warn(`Video autoplay prevented (${reason}):`, err);
    }
  };

  // Try to play when active and page is interactive
  useEffect(() => {
    if (videoRef.current && isActive && isPageInteractive) {
      attemptPlay("active+interactive");
    }
  }, [isActive, isPageInteractive]);

  // Retry autoplay when browser restores page / tab becomes visible (common mobile case)
  useEffect(() => {
    if (!isActive) return;

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        attemptPlay("visibilitychange");
      }
    };

    const onPageShow = () => {
      attemptPlay("pageshow");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [isActive]);

  // One-time retry on first user interaction (tap/scroll) to satisfy strict mobile policies
  useEffect(() => {
    if (!isActive) return;

    let done = false;
    const tryOnce = () => {
      if (done) return;
      done = true;
      attemptPlay("first-user-interaction");
      window.removeEventListener("touchstart", tryOnce, true);
      window.removeEventListener("click", tryOnce, true);
      window.removeEventListener("scroll", tryOnce, true);
    };

    window.addEventListener("touchstart", tryOnce, true);
    window.addEventListener("click", tryOnce, true);
    window.addEventListener("scroll", tryOnce, true);

    return () => {
      window.removeEventListener("touchstart", tryOnce, true);
      window.removeEventListener("click", tryOnce, true);
      window.removeEventListener("scroll", tryOnce, true);
    };
  }, [isActive]);

  const preload: HTMLVideoElement['preload'] = !loadSource
    ? 'none'
    : isActive
      ? 'auto'
      : 'metadata';

  return (
    <video
      ref={videoRef}
      src={loadSource ? slide.src : undefined}
      poster={slide.poster}
      className="absolute inset-0 h-full w-full min-h-0 object-cover"
      autoPlay
      loop
      muted
      playsInline
      preload={preload}
      style={{
        objectFit: "cover",
      }}
      onLoadedData={(e) => {
        // Ensure video is muted and ready - critical for autoplay
        const video = e.currentTarget;
        video.muted = true;
        video.volume = 0;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        // Notify that first frame is ready (loadeddata fires when first frame can be displayed)
        // This is what we want - don't wait for full video download
        if (!hasNotified.current) {
          hasNotified.current = true;
          onLoaded?.();
        }
        // Force play to ensure autoplay works (only if active)
        if (isActive) {
          attemptPlay("loadeddata");
        }
      }}
      onCanPlay={(e) => {
        // Alternative: canplay also fires when first frame is ready
        // Use this as backup if loadeddata doesn't fire
        if (!hasNotified.current) {
          hasNotified.current = true;
          onLoaded?.();
        }
        if (isActive) {
          attemptPlay("canplay");
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
  const [heroContentLoaded, setHeroContentLoaded] = useState(false);
  const [isPageInteractive, setIsPageInteractive] = useState(false);
  const [loadedMedia, setLoadedMedia] = useState<Set<number>>(new Set());
  const { data: featuredEvents = [], isFetched, isFetching } = useFeaturedEvents();
  /** Latch once: first time featured query finishes, so refetch/focus doesn't flash placeholder vs hero. */
  const [featuredLayoutReady, setFeaturedLayoutReady] = useState(false);
  useLayoutEffect(() => {
    if (featuredLayoutReady) return;
    if (isFetched && !isFetching) {
      setFeaturedLayoutReady(true);
    }
  }, [isFetched, isFetching, featuredLayoutReady]);
  const showLocalTestFlow = isLocalhostClient();

  const bookableUpcomingEvents = useMemo(() => {
    return featuredEvents.filter((e) => {
      if (isPassPurchaseWindowClosed(e.date, e.event_status)) return false;
      const hasPasses = (e.passes?.length ?? 0) > 0;
      const isTest = Boolean(e.is_test);
      if (hasPasses) return true;
      // Local dev: test events can drive multi-hero without passes so you can preview layout/flow.
      if (showLocalTestFlow && isTest) return true;
      return false;
    });
  }, [featuredEvents, showLocalTestFlow]);
  const isMultiEventHero =
    featuredLayoutReady && bookableUpcomingEvents.length >= 2;

  const nextEvent = useMemo<Event | null>(
    () => (featuredEvents.length > 0 ? featuredEvents[0] : null),
    [featuredEvents]
  );
  const navigate = useNavigate();
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLoadedMedia(new Set());
  }, [heroContent]);

  useEffect(() => {
    if (isMultiEventHero) {
      setCurrentSlide(0);
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    }
  }, [isMultiEventHero]);

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
        } else {
          setHeroContent({});
        }
      } catch (error) {
        console.error('Error fetching site content:', error);
        setHeroContent({});
      } finally {
        setHeroContentLoaded(true);
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

  const typewriterLines = useMemo(() => {
    const placeholderOnly = [PLACEHOLDER_TYPEWRITER_LINE];
    if (!heroContentLoaded) {
      return placeholderOnly;
    }
    const cmsTypewriterTexts = (heroContent?.typewriter_texts || {}) as {
      en?: string[];
      fr?: string[];
    };
    const raw = Array.isArray(cmsTypewriterTexts[language])
      ? cmsTypewriterTexts[language]!
      : [];
    const cleaned = raw.map((t) => String(t).trim()).filter((t) => t.length > 0);
    if (cleaned.length > 0) {
      return cleaned;
    }
    return placeholderOnly;
  }, [heroContent, language, heroContentLoaded]);

  const typewriterKey = `${heroContentLoaded}:${language}:${typewriterLines.join("\0")}`;
  
  // Get hero images from Supabase content
  // If no images are set in Supabase, use empty array (will show placeholder or nothing)
  const heroSlides = heroContent.images || [];
  const firstSlideReady = loadedMedia.has(0);

  // Gate shell/LCP on slide 0 only (other slides load in the background)
  useEffect(() => {
    if (!featuredLayoutReady) return;
    if (isMultiEventHero) return;

    if (heroSlides.length === 0) {
      onMediaLoaded?.();
      return;
    }

    const maxTimeout = setTimeout(() => {
      console.warn('Critical hero media loading timeout - showing content anyway');
      onMediaLoaded?.();
    }, 5000);

    if (firstSlideReady) {
      clearTimeout(maxTimeout);
      onMediaLoaded?.();
      return () => clearTimeout(maxTimeout);
    }

    return () => clearTimeout(maxTimeout);
  }, [
    featuredLayoutReady,
    isMultiEventHero,
    firstSlideReady,
    heroSlides.length,
    onMediaLoaded,
  ]);

  // Handle media load callbacks
  const handleMediaLoad = (index: number) => {
    setLoadedMedia(prev => new Set([...prev, index]));
  };

  useEffect(() => {
    if (!featuredLayoutReady) return;
    if (isMultiEventHero) return;
    if (heroSlides.length === 0) return;
    if (!firstSlideReady) {
      setCurrentSlide(0);
      return;
    }

    setCurrentSlide(0);

    if (transitionTimerRef.current) {
      clearInterval(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    const startTimer = setTimeout(() => {
      transitionTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 6000);
    }, 500);

    return () => {
      clearTimeout(startTimer);
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, [featuredLayoutReady, isMultiEventHero, heroSlides.length, firstSlideReady]);


  return (
    <section
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-dark",
        !featuredLayoutReady
          ? "h-[calc(100svh-4rem)]"
          : isMultiEventHero
            ? "h-[min(52dvh,460px)] min-h-[200px] md:h-[calc(100svh-4rem)] md:min-h-0"
            : "h-[calc(100svh-4rem)]"
      )}
    >
      {/* Background: wait for featured events, then multi carousel or CMS slideshow */}
      <div className="absolute inset-0 z-0">
        {!featuredLayoutReady ? (
          <div className="absolute inset-0 bg-gradient-dark" />
        ) : isMultiEventHero ? (
          <HeroMultiEventCarousel
            events={bookableUpcomingEvents}
            language={language}
            onCriticalMediaLoaded={onMediaLoaded}
          />
        ) : heroSlides.length > 0 ? heroSlides.map((slide, index) => {
          const isActive = index === currentSlide;
          const len = heroSlides.length;
          const nextIndex = len > 0 ? (currentSlide + 1) % len : 0;
          const loadVideoSource =
            slide.type === 'video' && (index === 0 || isActive || index === nextIndex);

          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity [transition-duration:2s] ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              {slide.type === 'video' ? (
                <VideoSlide 
                  slide={slide} 
                  isActive={isActive} 
                  isPageInteractive={isPageInteractive}
                  loadSource={loadVideoSource}
                  onLoaded={() => handleMediaLoad(index)}
                />
              ) : (
                (() => {
                  const { srcSet, imgSrc, sizes } = buildHeroImageSrcSet({
                    src: slide.src,
                    thumbUrl: slide.thumbUrl,
                    midUrl: slide.midUrl,
                  });
                  const avifSrc = slide.avifUrl || avifVariantUrl(slide.src);
                  const imgProps = {
                    alt: slide.alt || `Andiamo Events – Hero image ${index + 1}`,
                    className: 'w-full h-full object-cover' as const,
                    style: { objectFit: 'cover' as const },
                    loading: (index === 0 ? 'eager' : 'lazy') as 'eager' | 'lazy',
                    fetchPriority: (index === 0 ? 'high' : 'low') as 'high' | 'low',
                    decoding: 'async' as const,
                    width: 1920,
                    height: 1080,
                    sizes,
                    ...(srcSet ? { srcSet } : {}),
                    src: imgSrc,
                    onLoad: () => handleMediaLoad(index),
                    onError: () => handleMediaLoad(index),
                  };
                  if (avifSrc) {
                    return (
                      <picture className="absolute inset-0 block h-full w-full min-h-0">
                        <source srcSet={avifSrc} type="image/avif" />
                        <img
                          {...imgProps}
                          className="absolute inset-0 h-full w-full min-h-0 object-cover"
                        />
                      </picture>
                    );
                  }
                  return (
                    <img
                      {...imgProps}
                      className="absolute inset-0 h-full w-full min-h-0 object-cover"
                    />
                  );
                })()
              )}
              <div 
                className="absolute inset-0" 
                style={{
                  background: 'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.3))'
                }}
              />
            </div>
          );
        }) : (
          <div className="absolute inset-0 bg-gradient-dark" />
        )}
      </div>

      {/* CMS typewriter + single CTA (only after featured layout known; hidden in multi-event mode) */}
      {featuredLayoutReady && !isMultiEventHero ? (
      <div className="relative z-20 text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl md:text-7xl font-heading font-black mb-6 min-h-[1.2em] uppercase">
            <span className="block text-white">
              <TypewriterText
                key={typewriterKey}
                texts={typewriterLines}
                speed={80}
                deleteSpeed={40}
                pauseTime={2500}
                className="inline"
              />
            </span>
          </h1>

          {nextEvent &&
            !isPassPurchaseWindowClosed(nextEvent.date, nextEvent.event_status) &&
            ((nextEvent.passes?.length ?? 0) > 0 ||
              (showLocalTestFlow && Boolean(nextEvent.is_test))) && (
            <div className="flex justify-center items-center mt-14 md:mt-20 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
              <Button
                variant="default"
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 hover:scale-110 active:scale-95 transition-all duration-300 relative overflow-hidden group font-normal"
                style={{
                  backgroundColor: '#E21836',
                  color: '#FFFFFF',
                  boxShadow: '0 0 30px rgba(226, 24, 54, 0.6)',
                  fontWeight: 400
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FF3B5C';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(226, 24, 54, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#E21836';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(226, 24, 54, 0.6)';
                }}
                onClick={() => {
                  const slug = nextEvent.slug || generateSlug(nextEvent.name);
                  navigate(`/${slug}`);
                }}
              >
                <span className="relative z-10 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:scale-110" />
                  {language === 'en' ? 'Book Now' : 'Réserver un Pass'}
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
      ) : null}

      {/* Slide Indicators (CMS hero only) */}
      {featuredLayoutReady && !isMultiEventHero && heroSlides.length > 0 && (
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-20">
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
    </section>
  );
};

export default HeroSection;