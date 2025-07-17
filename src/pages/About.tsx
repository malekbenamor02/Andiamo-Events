import { useState, useEffect } from "react";
import { MapPin, Heart, Users, Zap, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import aboutHero from "@/assets/about-hero.jpg";

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
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-orbitron font-bold mb-6 text-gradient-neon">
            {aboutContent?.title || t.hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 max-w-4xl mx-auto">
            {aboutContent?.subtitle || t.hero.subtitle}
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-orbitron font-bold mb-8 text-gradient-neon">
                {t.story.title}
              </h2>
              <p className="text-lg text-foreground/80 leading-relaxed mb-8">
                {aboutContent?.description || t.story.text}
              </p>
              <h3 className="text-3xl font-orbitron font-bold mb-6 text-gradient-neon">
                {t.mission.title}
              </h3>
              <p className="text-lg text-foreground/80 leading-relaxed">
                {t.mission.text}
              </p>
            </div>
            <div className="relative">
              <div className="glass p-8 rounded-2xl border border-primary/20">
                <img
                  src={aboutHero}
                  alt="About Andiamo Events"
                  className="w-full h-64 object-cover rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-secondary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-orbitron font-bold mb-6 text-gradient-neon">
              {t.values.title}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.values.items.map((value, index) => (
              <Card key={index} className="glass hover-glow">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-primary flex items-center justify-center">
                    <value.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-orbitron font-bold mb-4 text-primary">
                    {value.title}
                  </h3>
                  <p className="text-foreground/80">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Cities Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-orbitron font-bold mb-6 text-gradient-neon">
              {t.cities.title}
            </h2>
            <p className="text-xl text-foreground/80">
              {t.cities.subtitle}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.cities.locations.map((location, index) => (
              <Card key={index} className="glass hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-orbitron font-bold mb-2 text-primary">
                        {location.name}
                      </h3>
                      <p className="text-foreground/80">
                        {location.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-orbitron font-bold mb-6 text-white">
            {t.cta.title}
          </h2>
          <p className="text-xl text-white/90 mb-8">
            {t.cta.subtitle}
          </p>
          <Button 
            size="lg" 
            className="btn-neon text-lg px-8 py-4"
            onClick={() => window.location.href = '/ambassador'}
          >
            {t.cta.button}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default About;