import { useState, useEffect } from "react";
import { MapPin, Heart, Users, Zap, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import aboutHero from "@/assets/about-hero.jpg";
import { useNavigate } from "react-router-dom";

interface AboutProps {
  language: 'en' | 'fr';
}

interface AboutContent {
  title?: string;
  subtitle?: string;
  description?: string;
  [key: string]: string | undefined;
}

const About = ({ language }: AboutProps) => {
  const [aboutContent, setAboutContent] = useState<AboutContent>({});
  const [animatedSections, setAnimatedSections] = useState<Set<string>>(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSiteContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .eq('key', 'about_section');

        if (error) throw error;
        if (data?.[0]) {
          setAboutContent(data[0].content as AboutContent);
        }
      } catch (error) {
        console.error('Error fetching about content:', error);
      }
    };

    fetchSiteContent();
  }, []);

  // Animation effect for sections
  useEffect(() => {
    if (!hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        // Animate sections one by one
        const sections = ['hero', 'story', 'values', 'cities', 'cta'];
        sections.forEach((section, index) => {
          setTimeout(() => {
            setAnimatedSections(prev => new Set([...prev, section]));
          }, index * 300); // 300ms delay between each section
        });
      }, 500);
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

  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Hero Section */}
      <section className="relative py-32 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-secondary/20 rounded-full blur-xl animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-accent/20 rounded-full blur-xl animate-pulse delay-2000" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className={`transform transition-all duration-1000 ${
            animatedSections.has('hero') 
              ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' 
              : 'opacity-0 translate-y-8'
          }`}>
            <h1 className="text-5xl md:text-7xl font-orbitron font-bold mb-8 text-gradient-neon animate-in slide-in-from-top-4 duration-1000">
              {aboutContent?.title || t.hero.title}
            </h1>
            <p className="text-xl md:text-2xl text-foreground/80 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-1000 delay-300">
              {aboutContent?.subtitle || t.hero.subtitle}
            </p>
            
            {/* Floating stats */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-1000 delay-500">
              <div className="glass p-6 rounded-xl border border-primary/20 transform hover:scale-105 transition-all duration-300">
                <div className="text-3xl font-bold text-primary mb-2">500+</div>
                <div className="text-sm text-muted-foreground">Events Organized</div>
              </div>
              <div className="glass p-6 rounded-xl border border-primary/20 transform hover:scale-105 transition-all duration-300">
                <div className="text-3xl font-bold text-primary mb-2">50K+</div>
                <div className="text-sm text-muted-foreground">Happy Attendees</div>
              </div>
              <div className="glass p-6 rounded-xl border border-primary/20 transform hover:scale-105 transition-all duration-300">
                <div className="text-3xl font-bold text-primary mb-2">5</div>
                <div className="text-sm text-muted-foreground">Cities Covered</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid lg:grid-cols-2 gap-16 items-center transform transition-all duration-1000 ${
            animatedSections.has('story') 
              ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' 
              : 'opacity-0 translate-y-8'
          }`}>
            <div className="space-y-8">
              <div className="animate-in slide-in-from-left-4 duration-700 delay-200">
                <h2 className="text-4xl font-orbitron font-bold mb-6 text-gradient-neon">
                  {t.story.title}
                </h2>
                <p className="text-lg text-foreground/80 leading-relaxed">
                  {aboutContent?.description || t.story.text}
                </p>
              </div>
              
              <div className="animate-in slide-in-from-left-4 duration-700 delay-400">
                <h3 className="text-3xl font-orbitron font-bold mb-6 text-gradient-neon">
                  {t.mission.title}
                </h3>
                <p className="text-lg text-foreground/80 leading-relaxed">
                  {t.mission.text}
                </p>
              </div>
              
              {/* Timeline */}
              <div className="animate-in slide-in-from-left-4 duration-700 delay-600">
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-sm text-muted-foreground">2020 - Founded with a vision</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-sm text-muted-foreground">2021 - First major event success</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-sm text-muted-foreground">2022 - Expanded to 5 cities</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-sm text-muted-foreground">2023 - 500+ events milestone</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative animate-in slide-in-from-right-4 duration-700 delay-300">
              <div className="glass p-8 rounded-2xl border border-primary/20 transform hover:scale-105 transition-all duration-500">
                <img
                  src={aboutHero}
                  alt="About Andiamo Events"
                  className="w-full h-80 object-cover rounded-xl transform hover:scale-110 transition-transform duration-500"
                />
              </div>
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-primary/20 rounded-full blur-sm animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-secondary/20 rounded-full blur-sm animate-pulse delay-1000"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-gradient-to-b from-secondary/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transform transition-all duration-1000 ${
            animatedSections.has('values') 
              ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' 
              : 'opacity-0 translate-y-8'
          }`}>
            <h2 className="text-4xl font-orbitron font-bold mb-6 text-gradient-neon animate-in slide-in-from-top-4 duration-700">
              {t.values.title}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-700 delay-200">
              The core principles that drive our success and shape every event we create
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.values.items.map((value, index) => (
              <Card 
                key={index} 
                className={`glass hover-glow transform transition-all duration-500 hover:scale-105 hover:shadow-xl ${
                  animatedSections.has('values') 
                    ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                    : 'opacity-0 translate-y-8'
                }`}
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <CardContent className="p-8 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-primary flex items-center justify-center transform hover:scale-110 transition-transform duration-300">
                    <value.icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-orbitron font-bold mb-4 text-primary">
                    {value.title}
                  </h3>
                  <p className="text-foreground/80 leading-relaxed">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Cities Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transform transition-all duration-1000 ${
            animatedSections.has('cities') 
              ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' 
              : 'opacity-0 translate-y-8'
          }`}>
            <h2 className="text-4xl font-orbitron font-bold mb-6 text-gradient-neon animate-in slide-in-from-top-4 duration-700">
              {t.cities.title}
            </h2>
            <p className="text-xl text-foreground/80 animate-in slide-in-from-bottom-4 duration-700 delay-200">
              {t.cities.subtitle}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.cities.locations.map((location, index) => (
              <Card 
                key={index} 
                className={`glass hover-lift transform transition-all duration-500 hover:scale-105 hover:shadow-xl ${
                  animatedSections.has('cities') 
                    ? 'animate-in slide-in-from-bottom-4 fade-in duration-700' 
                    : 'opacity-0 translate-y-8'
                }`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-8">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 transform hover:scale-110 transition-transform duration-300">
                      <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-orbitron font-bold mb-3 text-primary">
                        {location.name}
                      </h3>
                      <p className="text-foreground/80 leading-relaxed">
                        {location.description}
                      </p>
                      {/* City stats */}
                      <div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>🎉 50+ Events</span>
                        <span>👥 10K+ Attendees</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-primary relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white/10 rounded-full blur-xl animate-pulse delay-2000"></div>
        
        <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transform transition-all duration-1000 ${
          animatedSections.has('cta') 
            ? 'animate-in slide-in-from-bottom-4 fade-in duration-1000' 
            : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-4xl md:text-6xl font-orbitron font-bold mb-8 text-white animate-in slide-in-from-top-4 duration-700">
            {t.cta.title}
          </h2>
          <p className="text-xl text-white/90 mb-12 animate-in slide-in-from-bottom-4 duration-700 delay-200">
            {t.cta.subtitle}
          </p>
          <div className="animate-in slide-in-from-bottom-4 duration-700 delay-400">
            <Button 
              size="lg" 
              className="btn-neon text-lg px-12 py-6 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl"
              onClick={() => navigate('/ambassador')}
            >
              {t.cta.button}
            </Button>
          </div>
          
          {/* Additional info */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-700 delay-600">
            <div className="text-white/80">
              <div className="text-2xl font-bold mb-2">🎯</div>
              <div className="text-sm">Join our team</div>
            </div>
            <div className="text-white/80">
              <div className="text-2xl font-bold mb-2">💎</div>
              <div className="text-sm">Earn commissions</div>
            </div>
            <div className="text-white/80">
              <div className="text-2xl font-bold mb-2">🚀</div>
              <div className="text-sm">Grow with us</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;