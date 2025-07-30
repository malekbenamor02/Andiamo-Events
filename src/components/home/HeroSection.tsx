import { useState, useEffect } from "react";
import { MessageCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import hero1 from "@/assets/1.jpg";
import hero2 from "@/assets/2.jpg";
import hero3 from "@/assets/3.jpg";
import { useNavigate } from "react-router-dom";
import bcrypt from 'bcryptjs';

interface HeroSectionProps {
  language: 'en' | 'fr';
}

interface SocialLinks {
  whatsapp?: string;
  [key: string]: string | undefined;
}

interface SiteContentItem {
  key: string;
  content: any; // Using any for Supabase Json type
}

const HeroSection = ({ language }: HeroSectionProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroContent, setHeroContent] = useState<any>({});
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .in('key', ['hero_section', 'social_links']);

        if (error) throw error;

        data?.forEach((item: SiteContentItem) => {
          if (item.key === 'hero_section') {
            setHeroContent(item.content as any);
          } else if (item.key === 'social_links') {
            setSocialLinks(item.content as SocialLinks);
          }
        });
      } catch (error) {
        console.error('Error fetching site content:', error);
      }
    };

    fetchSiteContent();
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

  // Use Supabase content if available, otherwise fall back to default
  const content = heroContent[language] || defaultContent[language];
  
  // Get hero images from Supabase content or use default
  const defaultSlides = [
    {
      type: "image",
      src: hero1,
      alt: "Hero Image 1"
    },
    {
      type: "image", 
      src: hero2,
      alt: "Hero Image 2"
    },
    {
      type: "image",
      src: hero3,
      alt: "Hero Image 3"
    }
  ];
  
  const heroSlides = heroContent.images || defaultSlides;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const whatsappClick = () => {
    const whatsappLink = socialLinks?.whatsapp || "https://wa.me/216XXXXXXXX";
    window.open(whatsappLink, "_blank");
  };

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-gradient-dark">
      {/* Background Slideshow */}
      <div className="absolute inset-0 z-0">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        ))}
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
          <h1 className="text-5xl md:text-7xl font-orbitron font-bold mb-6">
            <span className="block text-gradient-neon animate-pulse-glow">
              {(content?.title || defaultContent[language].title).split(' ').slice(0, 3).join(' ')}
            </span>
            <span className="block text-white mt-2">
              {(content?.title || defaultContent[language].title).split(' ').slice(3).join(' ')}
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-secondary font-medium mb-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            {content?.subtitle || defaultContent[language].subtitle}
          </p>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            {content?.description || defaultContent[language].description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <Button
              onClick={whatsappClick}
              size="lg"
              className="btn-gradient text-lg px-8 py-4 hover-lift"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              {content?.cta || defaultContent[language].cta}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="btn-neon text-lg px-8 py-4 hover-lift"
              onClick={() => navigate('/events')}
            >
              <Play className="w-5 h-5 mr-2" />
              {content?.watchVideo || defaultContent[language].watchVideo}
            </Button>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
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