import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FontTest = () => {
  const [fontOption, setFontOption] = useState<'current' | 'option1' | 'option2' | 'option3' | 'option4' | 'option5' | 'option6' | 'option7' | 'option8' | 'option9' | 'option10' | 'josefin'>('josefin');

  const fontOptions = {
    current: {
      heading: 'font-heading',
      body: 'font-sans',
      headingName: 'Orbitron',
      bodyName: 'Inter',
      description: 'Current setup - Futuristic & Tech'
    },
    option1: {
      heading: 'font-heading', // Will be Bebas Neue when activated
      body: 'font-body', // Will be Work Sans when activated
      headingName: 'Bebas Neue',
      bodyName: 'Work Sans',
      description: 'Modern & Bold - Great for Nightlife ⭐'
    },
    option2: {
      heading: 'font-heading', // Will be Outfit when activated
      body: 'font-body', // Will be DM Sans when activated
      headingName: 'Outfit',
      bodyName: 'DM Sans',
      description: 'Clean & Contemporary'
    },
    option3: {
      heading: 'font-heading', // Will be Space Grotesk when activated
      body: 'font-body', // Will be Manrope when activated
      headingName: 'Space Grotesk',
      bodyName: 'Manrope',
      description: 'Geometric & Modern'
    },
    option4: {
      heading: 'font-heading', // Will be Rajdhani when activated
      body: 'font-body', // Will be Plus Jakarta Sans when activated
      headingName: 'Rajdhani',
      bodyName: 'Plus Jakarta Sans',
      description: 'Energetic & Dynamic'
    },
    option5: {
      heading: 'font-heading', // Will be Montserrat when activated
      body: 'font-body', // Will be Poppins when activated
      headingName: 'Montserrat',
      bodyName: 'Poppins',
      description: 'Bold & Impactful'
    },
    option6: {
      heading: 'font-heading', // Will be Bungee when activated
      body: 'font-body', // Will be Raleway when activated
      headingName: 'Bungee',
      bodyName: 'Raleway',
      description: 'Bold & Playful - Great for Events ⭐'
    },
    option7: {
      heading: 'font-heading', // Will be Righteous when activated
      body: 'font-body', // Will be Nunito when activated
      headingName: 'Righteous',
      bodyName: 'Nunito',
      description: 'Energetic & Dynamic ⭐'
    },
    option8: {
      heading: 'font-heading', // Will be Exo 2 when activated
      body: 'font-body', // Will be Rubik when activated
      headingName: 'Exo 2',
      bodyName: 'Rubik',
      description: 'Futuristic & Modern'
    },
    option9: {
      heading: 'font-heading', // Will be Anton when activated
      body: 'font-body', // Will be Source Sans Pro when activated
      headingName: 'Anton',
      bodyName: 'Source Sans Pro',
      description: 'Bold & Impactful'
    },
    option10: {
      heading: 'font-heading', // Will be Kanit when activated
      body: 'font-body', // Will be Quicksand when activated
      headingName: 'Kanit',
      bodyName: 'Quicksand',
      description: 'Modern & Geometric'
    },
    josefin: {
      heading: 'font-josefin',
      body: 'font-josefin',
      headingName: 'Josefin Sans',
      bodyName: 'Josefin Sans',
      description: 'Elegant & Modern - User Choice ⭐'
    }
  };

  const current = fontOptions[fontOption];

  return (
    <div className="min-h-screen bg-background pt-16 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-heading font-bold text-gradient-neon mb-4">
            Font Testing Page
          </h1>
          <p className="text-muted-foreground">
            Test different font combinations to find the perfect match for Andiamo Events
          </p>
        </div>

        {/* Font Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Font Option</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(fontOptions).map(([key, option]) => (
                <Button
                  key={key}
                  variant={fontOption === key ? "default" : "outline"}
                  onClick={() => setFontOption(key as any)}
                  className="h-auto p-4 flex flex-col items-start"
                >
                  <span className="font-semibold">{option.headingName} + {option.bodyName}</span>
                  <span className="text-xs text-muted-foreground mt-1">{option.description}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Current: {current.headingName} (Headings) + {current.bodyName} (Body)
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Hero Section Preview */}
            <div>
              <h2 className={`text-5xl ${current.heading} font-bold text-gradient-neon mb-4`}>
                ANDIAMO EVENTS
              </h2>
              <p className={`${current.body} text-lg text-muted-foreground`}>
                Creating Unforgettable Nightlife Experiences Across Tunisia
              </p>
            </div>

            {/* Heading Sizes */}
            <div className="space-y-4">
              <h3 className={`text-4xl ${current.heading} font-bold text-primary`}>
                Large Heading (H1)
              </h3>
              <h3 className={`text-3xl ${current.heading} font-semibold text-primary`}>
                Medium Heading (H2)
              </h3>
              <h3 className={`text-2xl ${current.heading} font-semibold text-primary`}>
                Small Heading (H3)
              </h3>
            </div>

            {/* Body Text */}
            <div className={`${current.body} space-y-4`}>
              <p className="text-base">
                This is regular body text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                Ut enim ad minim veniam, quis nostrud exercitation.
              </p>
              <p className="text-sm text-muted-foreground">
                This is smaller body text with muted color. Perfect for descriptions, 
                captions, and secondary information that needs to be readable but not prominent.
              </p>
            </div>

            {/* Button Text */}
            <div className="flex gap-4 flex-wrap">
              <Button className={`${current.body} font-semibold`}>
                Button Text
              </Button>
              <Button variant="outline" className={`${current.body} font-medium`}>
                Outline Button
              </Button>
            </div>

            {/* Event Card Preview */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className={`${current.heading} text-2xl`}>
                  Summer Beach Party
                </CardTitle>
              </CardHeader>
              <CardContent className={`${current.body} space-y-2`}>
                <p className="text-sm text-muted-foreground">
                  Join us for an unforgettable night at the beach with the best DJs and live performances.
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span>📍 Monastir</span>
                  <span>📅 Aug 15, 2024</span>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Activate This Font</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">1. Edit tailwind.config.ts</h4>
              <p className="text-sm text-muted-foreground">
                Uncomment the font option you want to test in the fontFamily section.
                For example, to test Option 1, uncomment:
              </p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`heading: ['Bebas Neue', 'sans-serif'],
body: ['Work Sans', 'sans-serif'],`}
              </pre>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">2. Update src/index.css</h4>
              <p className="text-sm text-muted-foreground">
                Change the body font-family to match your chosen body font:
              </p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`font-family: "Work Sans", sans-serif;`}
              </pre>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">3. Update Components</h4>
              <p className="text-sm text-muted-foreground">
                Replace `font-heading` with `font-heading` in heading elements throughout your components.
              </p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm">
                <strong>Note:</strong> See <code>FONT_TESTING_GUIDE.md</code> for detailed instructions and all available font options.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FontTest;

