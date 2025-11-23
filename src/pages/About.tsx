import { useState, useEffect } from "react";
import { MapPin, Heart, Users, Zap, Trophy, Sparkles, Star, Image } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/ui/LoadingScreen";

interface AboutProps {
  language: 'en' | 'fr';
}

interface AboutImage {
  src: string;
  alt: string;
  path?: string;
}

interface AboutContent {
  title?: string;
  subtitle?: string;
  description?: string;
  images?: AboutImage[];
  [key: string]: string | AboutImage[] | undefined;
}

const About = ({ language }: AboutProps) => {
  const [aboutContent, setAboutContent] = useState<AboutContent>({});
  const [aboutImages, setAboutImages] = useState<AboutImage[]>([]);
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'about_section')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching about content:', error);
          return;
        }

        if (data && data.content) {
          const content = data.content as AboutContent;
          setAboutContent(content);
          // Extract images from content
          if (content.images && Array.isArray(content.images)) {
            setAboutImages(content.images as AboutImage[]);
          }
        }
      } catch (error) {
        console.error('Error fetching about content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSiteContent();
  }, []);

  // Animation effect for sections with smoother transitions
  useEffect(() => {
    if (!hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        // Animate sections one by one with staggered delays
        const sections = ['hero', 'story', 'values', 'cities', 'cta'];
        sections.forEach((section, index) => {
          setTimeout(() => {
            setAnimatedSections(prev => new Set([...prev, section]));
          }, index * 200); // 200ms delay for smoother flow
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [hasAnimated]);

  const content = {
    en: {
      hero: {
        title: "About Andiamo Events",
        subtitle: "Creating Unforgettable Nightlife Experiences Across Tunisia"
      },
      story: {
        title: "Our Story",
        text: "Born from a passion for bringing people together through music and nightlife, Andiamo Events has become Tunisia's premier event organization company. We started with a simple vision: to create extraordinary experiences that unite party-goers across the country's most vibrant cities."
      },
      mission: {
        title: "Our Mission",
        text: "To transform Tunisia's nightlife scene by organizing world-class events that celebrate music, culture, and community. We believe in creating moments that last a lifetime."
      },
      values: {
        title: "Our Values",
        items: [
          {
            icon: Zap,
            title: "Energy",
            description: "We bring electrifying energy to every event, ensuring unforgettable nights."
          },
          {
            icon: Users,
            title: "Unity", 
            description: "We connect people from all walks of life through the universal language of music."
          },
          {
            icon: Trophy,
            title: "Innovation",
            description: "We constantly push boundaries to deliver cutting-edge entertainment experiences."
          },
          {
            icon: Heart,
            title: "Celebration",
            description: "We believe life's best moments deserve to be celebrated in style."
          }
        ]
      },
      cities: {
        title: "Where We Create Magic",
        subtitle: "From coastal parties to urban celebrations",
        locations: [
          { name: "Sousse", description: "Beachfront celebrations and summer festivals" },
          { name: "Tunis", description: "Urban nightlife and exclusive rooftop events" },
          { name: "Monastir", description: "Seaside parties and luxury venue experiences" },
          { name: "Hammamet", description: "Resort celebrations and tourist hotspots" },
          { name: "Sfax", description: "Cultural events and modern nightlife" }
        ]
      },
      cta: {
        title: "Join the Movement",
        subtitle: "Be part of Tunisia's most exciting nightlife community",
        button: "Become an Ambassador"
      }
    },
    fr: {
      hero: {
        title: "À Propos d'Andiamo Events",
        subtitle: "Créer des Expériences de Vie Nocturne Inoubliables à Travers la Tunisie"
      },
      story: {
        title: "Notre Histoire",
        text: "Né d'une passion pour rassembler les gens à travers la musique et la vie nocturne, Andiamo Events est devenu la première entreprise d'organisation d'événements de Tunisie. Nous avons commencé avec une vision simple : créer des expériences extraordinaires qui unissent les fêtards à travers les villes les plus vibrantes du pays."
      },
      mission: {
        title: "Notre Mission",
        text: "Transformer la scène de la vie nocturne tunisienne en organisant des événements de classe mondiale qui célèbrent la musique, la culture et la communauté. Nous croyons en la création de moments qui durent toute une vie."
      },
      values: {
        title: "Nos Valeurs",
        items: [
          {
            icon: Zap,
            title: "Énergie",
            description: "Nous apportons une énergie électrisante à chaque événement, garantissant des nuits inoubliables."
          },
          {
            icon: Users,
            title: "Unité",
            description: "Nous connectons les gens de tous horizons à travers le langage universel de la musique."
          },
          {
            icon: Trophy,
            title: "Innovation",
            description: "Nous repoussons constamment les limites pour offrir des expériences de divertissement de pointe."
          },
          {
            icon: Heart,
            title: "Célébration",
            description: "Nous croyons que les meilleurs moments de la vie méritent d'être célébrés avec style."
          }
        ]
      },
      cities: {
        title: "Où Nous Créons la Magie",
        subtitle: "Des fêtes côtières aux célébrations urbaines",
        locations: [
          { name: "Sousse", description: "Célébrations en bord de mer et festivals d'été" },
          { name: "Tunis", description: "Vie nocturne urbaine et événements exclusifs sur toit" },
          { name: "Monastir", description: "Fêtes en bord de mer et expériences de lieux de luxe" },
          { name: "Hammamet", description: "Célébrations de station et lieux touristiques" },
          { name: "Sfax", description: "Événements culturels et vie nocturne moderne" }
        ]
      },
      cta: {
        title: "Rejoignez le Mouvement",
        subtitle: "Faites partie de la communauté de vie nocturne la plus excitante de Tunisie",
        button: "Devenir Ambassadeur"
      }
    }
  };

  const t = content[language];

  if (loading) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={language === 'en' ? 'Loading...' : 'Chargement...'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16 overflow-x-hidden">
      {/* Hero Section - Modern Redesign */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Enhanced animated background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-40 right-20 w-40 h-40 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" style={{ animationDuration: '5s' }} />
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-accent/20 rounded-full blur-3xl animate-pulse delay-2000" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-primary/15 rounded-full blur-2xl animate-pulse delay-500" style={{ animationDuration: '7s' }} />
        
        {/* Floating sparkles */}
        <div className="absolute top-32 left-1/4">
          <Sparkles className="w-6 h-6 text-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="absolute top-48 right-1/4">
          <Star className="w-5 h-5 text-secondary/30 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className={`transform transition-all duration-1000 ease-out ${
            animatedSections.has('hero') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <div className="inline-block mb-6">
              <span className="text-sm md:text-base font-semibold text-primary px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-in fade-in duration-1000">
                {language === 'en' ? 'Our Story' : 'Notre Histoire'}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-orbitron font-bold mb-6 text-gradient-neon leading-tight">
              {aboutContent?.title || t.hero.title}
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-foreground/80 max-w-4xl mx-auto leading-relaxed">
              {aboutContent?.subtitle || t.hero.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Story Section - Modern Redesign */}
      <section className="py-16 md:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center transform transition-all duration-1000 ease-out ${
            animatedSections.has('story') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <div className="space-y-10 order-2 lg:order-1">
              <div className="space-y-6">
                <div>
                  <span className="text-sm font-semibold text-primary mb-3 block">
                    {language === 'en' ? 'Our Journey' : 'Notre Parcours'}
                  </span>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-orbitron font-bold mb-6 text-gradient-neon">
                    {t.story.title}
                  </h2>
                  <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
                    {aboutContent?.description || t.story.text}
                  </p>
                </div>
                
                <div className="pt-6 border-t border-border/50">
                  <h3 className="text-2xl md:text-3xl font-orbitron font-bold mb-4 text-gradient-neon">
                    {t.mission.title}
                  </h3>
                  <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
                    {t.mission.text}
                  </p>
                </div>
              </div>
              
              {/* Enhanced Timeline */}
              <div className="relative pt-6">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-accent"></div>
                <div className="space-y-6 pl-6">
                  {[
                    { year: '2020', text: language === 'en' ? 'Founded with a vision' : 'Fondé avec une vision' },
                    { year: '2021', text: language === 'en' ? 'First major event success' : 'Premier succès d\'événement majeur' },
                    { year: '2022', text: language === 'en' ? 'Expanded to 5 cities' : 'Étendu à 5 villes' },
                    { year: '2023', text: language === 'en' ? '500+ events milestone' : 'Jalon de 500+ événements' }
                  ].map((item, index) => (
                    <div key={index} className="relative group">
                      <div className="absolute -left-9 top-1 w-4 h-4 bg-primary rounded-full border-4 border-background transform group-hover:scale-125 transition-transform duration-300"></div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-primary">{item.year}</span>
                        <span className="text-sm text-muted-foreground">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Image Gallery - Database Driven */}
            <div className="relative order-1 lg:order-2">
              {aboutImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {aboutImages.slice(0, 4).map((image, index) => (
                    <div
                      key={index}
                      className={`relative group overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 transform transition-all duration-700 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 ${
                        index === 0 ? 'col-span-2 h-64' : 'h-48'
                      }`}
                      style={{
                        animationDelay: `${index * 100}ms`
                      }}
                    >
                      <img
                        src={image.src}
                        alt={image.alt || `About image ${index + 1}`}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary/30 rounded-full blur-sm group-hover:bg-primary/50 transition-all duration-300"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative group overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 h-96 flex items-center justify-center">
                  <div className="text-center p-8">
                    <Image className="w-16 h-16 mx-auto mb-4 text-primary/30" />
                    <p className="text-muted-foreground">
                      {language === 'en' ? 'No images available' : 'Aucune image disponible'}
                    </p>
                  </div>
                </div>
              )}
              {/* Floating decorative elements */}
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-secondary/20 rounded-full blur-xl animate-pulse delay-1000"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section - Modern Redesign */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 via-primary/5 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-12 md:mb-16 transform transition-all duration-1000 ease-out ${
            animatedSections.has('values') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <span className="text-sm font-semibold text-primary mb-3 block">
              {language === 'en' ? 'What We Stand For' : 'Ce Que Nous Représentons'}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-orbitron font-bold mb-4 text-gradient-neon">
              {t.values.title}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              {language === 'en' 
                ? 'The core principles that drive our success and shape every event we create'
                : 'Les principes fondamentaux qui motivent notre succès et façonnent chaque événement que nous créons'}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {t.values.items.map((value, index) => (
              <Card 
                key={index} 
                className={`group relative overflow-hidden border-2 border-transparent hover:border-primary/30 bg-card/50 backdrop-blur-sm transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-primary/10 ${
                  animatedSections.has('values') 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-12'
                }`}
                style={{ 
                  transitionDelay: `${index * 100}ms`,
                  animationDelay: `${index * 100}ms`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardContent className="p-6 md:p-8 text-center relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg shadow-primary/20">
                    <value.icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-orbitron font-bold mb-3 md:mb-4 text-primary group-hover:text-primary/90 transition-colors">
                    {value.title}
                  </h3>
                  <p className="text-sm md:text-base text-foreground/80 leading-relaxed">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>



      {/* CTA Section - Modern Redesign */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary via-secondary to-accent relative overflow-hidden">
        {/* Enhanced animated background elements */}
        <div className="absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000" style={{ animationDuration: '5s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-3xl animate-pulse delay-2000" style={{ animationDuration: '6s' }}></div>
        <div className="absolute top-1/3 right-1/3 w-20 h-20 bg-white/10 rounded-full blur-2xl animate-pulse delay-500" style={{ animationDuration: '7s' }}></div>
        
        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>
        
        <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 transform transition-all duration-1000 ease-out ${
          animatedSections.has('cta') 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-12'
        }`}>
          <div className="inline-block mb-6">
            <Sparkles className="w-8 h-8 text-white/80 mx-auto animate-pulse" />
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-orbitron font-bold mb-6 md:mb-8 text-white leading-tight">
            {t.cta.title}
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-10 md:mb-12 max-w-2xl mx-auto leading-relaxed">
            {t.cta.subtitle}
          </p>
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-white/90 text-base md:text-lg px-8 md:px-12 py-6 md:py-7 rounded-full font-semibold transform hover:scale-105 hover:shadow-2xl transition-all duration-300 border-2 border-white/20"
            onClick={() => navigate('/ambassador')}
          >
            <span className="flex items-center gap-2">
              {t.cta.button}
              <Sparkles className="w-5 h-5" />
            </span>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default About;