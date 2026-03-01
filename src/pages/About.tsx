import { useState, useEffect } from "react";
import { MapPin, Heart, Users, Zap, Trophy, Sparkles, Star, Image, Building2, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TeamSection from "@/components/home/TeamSection";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdBreadcrumb } from "@/components/JsonLd";

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
        const sections = ['hero', 'story', 'cities', 'cta'];
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
      btlHero: {
        label: "Our Journey",
        title: "About Born To Lead (BTL) and its brands",
        description: "Born To Lead (BTL) is a Tunisian event agency founded and managed exclusively by passionate young people. Its mission is to revolutionize the event industry in Tunisia through innovative experiences with strong cultural and economic impact.\n\nBTL stands out for its modern approach and commitment to youth, delivering immersive experiences that promote creativity, inclusion, and the digital transformation of events."
      },
      btlBrands: {
        title: "Our Brands",
        andiamo: {
          title: "Andiamo Events",
          text: "Specialized in alcohol-free events, Andiamo Events focuses primarily on young people and students seeking festive, safe, and well-supervised atmospheres."
        },
        wagxt: {
          title: "Wkayet Events",
          text: "Dedicated to large-scale events, Wkayet Events hosts national artists and promotes innovative concepts with high production standards."
        }
      },
      btlVision: {
        title: "Our Vision",
        text: "With an ambitious vision, Born To Lead aims to position Tunisia as a key hub for international concerts while adopting an eco-responsible and fully digitalized event strategy."
      },
      andiamoHero: {
        label: "Our Story",
        title: "About Andiamo Events",
        subtitle: "Creating innovative and inspiring event experiences in Tunisia"
      },
      andiamoDescription: {
        label: "ANDIAMO EVENTS",
        title: "A Youth-Driven Event Label",
        paragraph1: "Andiamo Events, a brand developed by Born To Lead (BTL), is today one of the most popular event labels among young people in Tunisia.",
        paragraph2: "The brand stands out for its ability to combine modern event production with digital content creation, making Andiamo a key player in promoting cultural events nationwide.",
        highlights: [
          "Youth Focused",
          "Modern Production",
          "Digital Driven"
        ]
      },
      andiamoDetails: {
        international: {
          title: "International Opening",
          text: "Andiamo Events has initiated its first international collaborations with artists such as Saint Levant, marking the beginning of a global expansion strategy."
        },
        mission: {
          title: "Our Mission",
          text: "To offer young Tunisians innovative, inspiring events aligned with international standards, while ensuring a secure, professional, and responsible environment."
        }
      },
      hero: {
        title: "About Andiamo Events",
        subtitle: "Creating Innovative and Inspiring Event Experiences in Tunisia"
      },
      story: {
        title: "About Born To Lead (BTL) and its brands",
        text: "Born To Lead (BTL) is a Tunisian event agency founded and managed exclusively by passionate young people. Its goal is to revolutionize the event sector in Tunisia by organizing innovative events with strong cultural and economic impact. BTL stands out for its modern approach and commitment to youth, offering immersive experiences that foster creativity, inclusion, and the development of event digitalization. BTL oversees two major event brands: Andiamo Events, specialized in alcohol-free events, primarily targeting young people and students seeking festive and supervised atmospheres; and Wkayet Events, dedicated to large-scale events, hosting national artists and promoting innovative concepts. With an ambitious vision, BTL seeks to position Tunisia as an essential hub for international concerts, while adopting an eco-responsible and digitized approach."
      },
      mission: {
        title: "About Andiamo Events",
        text: "Andiamo Events, a brand developed by Born To Lead (BTL), is today one of the most popular event labels among young people in Tunisia. The brand stands out for its ability to combine modern event production and digital content creation, making Andiamo an influential player in promoting cultural events. International opening: Andiamo Events has initiated its first contacts with international artists such as Saint Levant, marking the beginning of an expansion strategy towards global collaborations. Mission: To offer young Tunisians innovative, inspiring events aligned with international standards, while ensuring a secure, professional, and responsible framework."
      },
      cities: {
        title: "Where We Create Magic",
        subtitle: "From coastal parties to urban celebrations",
        locations: [
          { name: "Sousse", description: "Beachfront celebrations and summer festivals" },
          { name: "Tunis", description: "Urban and exclusive rooftop events" },
          { name: "Monastir", description: "Seaside parties and luxury venue experiences" },
          { name: "Hammamet", description: "Resort celebrations and tourist hotspots" },
          { name: "Sfax", description: "Cultural events and modern experiences" }
        ]
      },
      cta: {
        title: "Join the Movement",
        subtitle: "Be part of Tunisia's most exciting event community",
        button: "Become an Ambassador"
      }
    },
    fr: {
      btlHero: {
        label: "Notre Parcours",
        title: "Présentation de Born To Lead (BTL) et ses marques",
        description: "Born To Lead (BTL) est une agence événementielle tunisienne fondée et dirigée exclusivement par des jeunes passionnés. Sa mission est de révolutionner le secteur événementiel en Tunisie en organisant des événements innovants à fort impact culturel et économique.\n\nBTL se distingue par son approche moderne et son engagement envers la jeunesse, en proposant des expériences immersives qui favorisent la créativité, l'inclusion et le développement de la digitalisation événementielle."
      },
      btlBrands: {
        title: "Nos Marques",
        andiamo: {
          title: "Andiamo Events",
          text: "Spécialisée dans les événements sans alcool, Andiamo Events s'adresse principalement aux jeunes et aux étudiants en quête d'ambiances festives, sécurisées et encadrées."
        },
        wagxt: {
          title: "Wkayet Events",
          text: "Dédiée aux événements de grande envergure, Wkayet Events accueille des artistes nationaux et met en avant des concepts innovants avec des standards de production élevés."
        }
      },
      btlVision: {
        title: "Notre Vision",
        text: "Avec une vision ambitieuse, Born To Lead cherche à positionner la Tunisie comme un hub incontournable pour les concerts internationaux, tout en adoptant une démarche écoresponsable et entièrement digitalisée."
      },
      andiamoHero: {
        label: "Notre Histoire",
        title: "Présentation de Andiamo Events",
        subtitle: "Créer des expériences événementielles innovantes et inspirantes en Tunisie"
      },
      andiamoDescription: {
        label: "ANDIAMO EVENTS",
        title: "Un Label Événementiel Porté par la Jeunesse",
        paragraph1: "Andiamo Events, marque développée par Born To Lead (BTL), est aujourd'hui l'un des labels événementiels les plus populaires auprès des jeunes en Tunisie.",
        paragraph2: "La marque se distingue par sa capacité à combiner production événementielle moderne et création de contenu digital, faisant d'Andiamo un acteur influent dans la promotion d'événements culturels à l'échelle nationale.",
        highlights: [
          "Orientation Jeunesse",
          "Production Moderne",
          "Approche Digitale"
        ]
      },
      andiamoDetails: {
        international: {
          title: "Ouverture Internationale",
          text: "Andiamo Events a initié ses premiers contacts avec des artistes internationaux tels que Saint Levant, marquant le début d'une stratégie d'expansion vers des collaborations mondiales."
        },
        mission: {
          title: "Notre Mission",
          text: "Offrir aux jeunes tunisiens des événements innovants, inspirants et alignés avec les standards internationaux, tout en garantissant un cadre sécurisé, professionnel et responsable."
        }
      },
      hero: {
        title: "À Propos d'Andiamo Events",
        subtitle: "Créer des Expériences Événementielles Innovantes et Inspirantes en Tunisie"
      },
      story: {
        title: "Présentation de Born To Lead (BTL) et ses marques",
        text: "Born To Lead (BTL) est une agence événementielle tunisienne fondée et dirigée exclusivement par des jeunes passionnés. Son objectif est de révolutionner le secteur événementiel en Tunisie en organisant des événements innovants à fort impact culturel et économique. BTL se distingue par son approche moderne et son engagement envers la jeunesse, en proposant des expériences immersives qui favorisent la créativité, l'inclusion et le développement de la digitalisation événementielle. BTL supervise deux grandes marques événementielles : Andiamo Events, spécialisée dans les événements sans alcool, s'adresse principalement aux jeunes et aux étudiants en quête d'ambiances festives et encadrées ; et Wkayet Events, dédiée aux événements de grande envergure, accueille des artistes nationaux et met en avant des concepts innovants. Avec une vision ambitieuse, BTL cherche à positionner la Tunisie comme un hub incontournable pour les concerts internationaux, tout en adoptant une démarche écoresponsable et digitalisée."
      },
      mission: {
        title: "Présentation de Andiamo Events",
        text: "Andiamo Events, marque développée par Born To Lead (BTL), est aujourd'hui l'un des labels événementiels les plus populaires auprès des jeunes en Tunisie. La marque se distingue par sa capacité à combiner production événementielle moderne et création de contenu digital, faisant d'Andiamo un acteur influent dans la promotion d'événements culturels. Andiamo Events a initié ses premiers contacts avec des artistes internationaux tels que Saint Levant, marquant le début d'une stratégie d'expansion vers des collaborations mondiales. Notre mission est d'offrir aux jeunes tunisiens des événements innovants, inspirants et alignés avec les standards internationaux, tout en garantissant un cadre sécurisé, professionnel et responsable."
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
        size="fullscreen" 
        text={language === 'en' ? 'Loading...' : 'Chargement...'}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background pt-16 overflow-x-hidden" id="main-content">
      <PageMeta
        title="About Us"
        description="Creating innovative and inspiring event experiences in Tunisia. We create memories."
        path="/about"
      />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "About", url: "/about" }]} />
      {/* 1️⃣ BTL Hero Section - Left Aligned */}
      <section className="relative py-20 md:py-32 overflow-hidden animate-page-intro">
        {/* Enhanced animated background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/5 to-primary/5" />
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-40 right-20 w-40 h-40 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" style={{ animationDuration: '5s' }} />
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-accent/20 rounded-full blur-3xl animate-pulse delay-2000" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-primary/15 rounded-full blur-2xl animate-pulse delay-500" style={{ animationDuration: '7s' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`transform transition-all duration-1000 ease-out ${
            animatedSections.has('hero') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <div className="max-w-4xl">
              <div className="inline-block mb-6">
                <span className="text-sm md:text-base font-semibold text-primary px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-in fade-in duration-1000">
                  {t.btlHero.label}
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 text-gradient-neon leading-tight uppercase">
                {t.btlHero.title}
              </h1>
              <p className="text-lg md:text-xl text-foreground/80 leading-relaxed whitespace-pre-line">
                {t.btlHero.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2️⃣ BTL Brands Section - Two Cards Side-by-Side */}
      <section className="py-16 md:py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-12 md:mb-16 transform transition-all duration-1000 ease-out ${
            animatedSections.has('story') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mb-4 text-gradient-neon uppercase">
              {t.btlBrands.title}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <Card className="group relative overflow-hidden border-2 border-transparent hover:border-primary/30 bg-card/50 backdrop-blur-sm transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-primary/10">
              <CardContent className="p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-heading font-bold mb-4 text-center text-primary uppercase">
                  {t.btlBrands.andiamo.title}
                </h3>
                <p className="text-base md:text-lg text-foreground/80 leading-relaxed text-center">
                  {t.btlBrands.andiamo.text}
                </p>
              </CardContent>
            </Card>
            <Card className="group relative overflow-hidden border-2 border-transparent hover:border-primary/30 bg-card/50 backdrop-blur-sm transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-primary/10">
              <CardContent className="p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-heading font-bold mb-4 text-center text-primary uppercase">
                  {t.btlBrands.wagxt.title}
                </h3>
                <p className="text-base md:text-lg text-foreground/80 leading-relaxed text-center">
                  {t.btlBrands.wagxt.text}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 3️⃣ BTL Vision Section - Centered with Darker Background */}
      <section className="py-16 md:py-24 relative bg-gradient-to-b from-secondary/10 via-secondary/15 to-secondary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className={`transform transition-all duration-1000 ease-out ${
            animatedSections.has('story') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mb-6 text-gradient-neon uppercase">
              {t.btlVision.title}
            </h2>
            <p className="text-base md:text-lg text-foreground/80 leading-relaxed max-w-3xl mx-auto">
              {t.btlVision.text}
            </p>
          </div>
        </div>
      </section>

      {/* 4️⃣ Andiamo Events Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/5 to-primary/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className={`transform transition-all duration-1000 ease-out ${
            animatedSections.has('hero') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <div className="inline-block mb-6">
              <span className="text-sm md:text-base font-semibold text-primary px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-in fade-in duration-1000">
                {t.andiamoHero.label}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 text-gradient-neon leading-tight uppercase">
              {t.andiamoHero.title}
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-foreground/80 max-w-4xl mx-auto leading-relaxed">
              {t.andiamoHero.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* 5️⃣ Andiamo Events Description - Premium Redesign */}
      <section className="py-24 md:py-32 lg:py-40 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
          <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Section - Text Content */}
            <div className={`order-2 lg:order-1 transform transition-all duration-700 ease-out ${
              animatedSections.has('story') 
                ? 'opacity-100 translate-x-0' 
                : 'opacity-0 -translate-x-8'
            }`}>
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:border-primary/30">
                <CardContent className="p-8 md:p-12 lg:p-16">
                  {/* Label */}
                  <div className="mb-4">
                    <span className="inline-block text-xs md:text-sm font-semibold text-primary px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 uppercase tracking-wider">
                      {t.andiamoDescription.label}
                    </span>
                  </div>
                  
                  {/* Title */}
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mb-8 text-foreground leading-tight uppercase">
                    {t.andiamoDescription.title}
                  </h2>
                  
                  {/* Paragraphs */}
                  <div className="space-y-6 mb-10">
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      {t.andiamoDescription.paragraph1}
                    </p>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      {t.andiamoDescription.paragraph2}
                    </p>
                  </div>
                  
                  {/* Micro-highlights */}
                  <div className="flex flex-wrap gap-3 md:gap-4">
                    {t.andiamoDescription.highlights.map((highlight, index) => (
                      <div 
                        key={index}
                        className="group relative"
                        style={{
                          animationDelay: `${index * 100}ms`,
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div className="px-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm md:text-base text-foreground/90 font-medium group-hover:bg-primary/10 group-hover:border-primary/30 group-hover:text-primary transition-all duration-300">
                          {highlight}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Section - Image Container */}
            <div className={`order-1 lg:order-2 transform transition-all duration-700 ease-out ${
              animatedSections.has('story') 
                ? 'opacity-100 translate-x-0 scale-100' 
                : 'opacity-0 translate-x-8 scale-95'
            }`} style={{
              transitionDelay: '150ms'
            }}>
              <div className="relative group flex items-center justify-center min-h-[400px]">
                {/* Glow Effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Image without container */}
                {aboutImages.length > 0 ? (
                  <img 
                    src={aboutImages[0].src} 
                    alt={aboutImages[0].alt || "Andiamo Events"} 
                    className="relative z-10 w-full h-auto object-contain max-w-xs md:max-w-sm rounded-2xl transform group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="relative z-10 text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary bg-clip-text text-transparent tracking-tight transform group-hover:scale-105 transition-transform duration-500">
                    ANDIAMO
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6️⃣ International Opening & Mission - Two Blocks */}
      <section className="py-16 md:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid md:grid-cols-2 gap-8 md:gap-12 transform transition-all duration-1000 ease-out ${
            animatedSections.has('story') 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-12'
          }`}>
            <div className="space-y-4">
              <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 text-gradient-neon uppercase">
                {t.andiamoDetails.international.title}
              </h3>
              <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
                {t.andiamoDetails.international.text}
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 text-gradient-neon uppercase">
                {t.andiamoDetails.mission.title}
              </h3>
              <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
                {t.andiamoDetails.mission.text}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 md:py-24 relative">
        <TeamSection language={language} />
      </section>

      {/* CTA Section - Modern Redesign */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary via-primary/80 to-primary/60 relative overflow-hidden">
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
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-bold mb-6 md:mb-8 text-white leading-tight whitespace-nowrap uppercase">
            {language === 'en' ? 'We Create Memories' : 'Nous Créons des Souvenirs'}
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent mx-auto rounded-full"></div>
        </div>
      </section>
    </main>
  );
};

export default About;