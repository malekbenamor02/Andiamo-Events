import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "@/components/ui/LoadingScreen";
import TeamSection from "@/components/home/TeamSection";
import { PageMeta } from "@/components/PageMeta";
import { JsonLdBreadcrumb } from "@/components/JsonLd";
import { PAGE_DESCRIPTIONS } from "@/lib/seo";
import { cn } from "@/lib/utils";

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

const PAGE_TOP = "pt-[calc(4rem+var(--site-countdown-offset,0px))]";
const CARD_SURFACE = "rounded-2xl border border-border/60 bg-card/90";

const About = ({ language }: AboutProps) => {
  const [aboutImages, setAboutImages] = useState<AboutImage[]>([]);
  const [loading, setLoading] = useState(true);

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
          { name: "Tunis", description: "Événements urbains et exclusifs sur toit" },
          { name: "Monastir", description: "Fêtes en bord de mer et expériences de lieux de luxe" },
          { name: "Hammamet", description: "Célébrations de station et lieux touristiques" },
          { name: "Sfax", description: "Événements culturels et expériences modernes" }
        ]
      },
      cta: {
        title: "Rejoignez le Mouvement",
        subtitle: "Faites partie de la communauté événementielle la plus excitante de Tunisie",
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
    <main className={cn("min-h-[100dvh] bg-background overflow-x-hidden", PAGE_TOP)} id="main-content">
      <PageMeta
        title="About Us"
        description={PAGE_DESCRIPTIONS.about[language]}
        path="/about"
      />
      <JsonLdBreadcrumb items={[{ name: "Home", url: "/" }, { name: "About", url: "/about" }]} />

      <section className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-5 sm:pt-10 sm:pb-12">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t.btlHero.label}</p>
        <h1 className="mt-3 font-heading text-[1.75rem] font-bold tracking-tight text-foreground sm:text-4xl">
          {t.btlHero.title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line sm:text-base">
          {t.btlHero.description}
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-5">
        <h2 className="mb-5 text-lg font-semibold tracking-tight sm:text-xl">{t.btlBrands.title}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className={cn(CARD_SURFACE, "shadow-sm")}>
            <CardContent className="p-5 sm:p-6">
              <h3 className="text-base font-semibold text-primary sm:text-lg">{t.btlBrands.andiamo.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.btlBrands.andiamo.text}
              </p>
            </CardContent>
          </Card>
          <Card className={cn(CARD_SURFACE, "shadow-sm")}>
            <CardContent className="p-5 sm:p-6">
              <h3 className="text-base font-semibold text-primary sm:text-lg">{t.btlBrands.wagxt.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.btlBrands.wagxt.text}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-border/50 bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{t.btlVision.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{t.btlVision.text}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-5 sm:py-12">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{t.andiamoHero.label}</p>
        <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t.andiamoHero.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t.andiamoHero.subtitle}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <Card className={cn(CARD_SURFACE, "shadow-sm")}>
            <CardContent className="p-5 sm:p-8">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                {t.andiamoDescription.label}
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                {t.andiamoDescription.title}
              </h2>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                <p>{t.andiamoDescription.paragraph1}</p>
                <p>{t.andiamoDescription.paragraph2}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {t.andiamoDescription.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80 sm:text-sm"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center">
            {aboutImages.length > 0 ? (
              <img
                src={aboutImages[0].src}
                alt={aboutImages[0].alt || "Andiamo Events"}
                className="max-h-72 w-full max-w-xs rounded-2xl object-contain sm:max-w-sm"
              />
            ) : (
              <div className="font-heading text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                ANDIAMO
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-5 sm:pb-16">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
          <div>
            <h3 className="text-base font-semibold text-primary sm:text-lg">
              {t.andiamoDetails.international.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t.andiamoDetails.international.text}
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-primary sm:text-lg">{t.andiamoDetails.mission.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t.andiamoDetails.mission.text}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 py-12 sm:py-16">
        <TeamSection language={language} />
      </section>

      <section className="border-t border-border/50 bg-primary py-12 text-center sm:py-14">
        <h2 className="font-heading text-xl font-bold tracking-tight text-primary-foreground sm:text-2xl">
          {language === "en" ? "We Create Memories" : "Nous Créons des Souvenirs"}
        </h2>
      </section>
    </main>
  );
};

export default About;