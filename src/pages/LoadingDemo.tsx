import { useState } from 'react';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LoadingDemo = () => {
  const [selectedType, setSelectedType] = useState<'spinner' | 'dots' | 'wave' | 'pulse' | 'bars'>('spinner');
  const [selectedSize, setSelectedSize] = useState<'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'>('fullscreen');
  const [selectedVariant, setSelectedVariant] = useState<'default' | 'minimal' | 'energetic'>('default');
  const [selectedColor, setSelectedColor] = useState<'primary' | 'white' | 'muted' | 'gradient'>('primary');
  const [customText, setCustomText] = useState('Loading...');
  const [showText, setShowText] = useState(true);

  const variants = [
    { value: 'default', label: 'Default (Multi-ring Neon)' },
    { value: 'minimal', label: 'Minimal (Elegant)' },
    { value: 'energetic', label: 'Energetic (Fast Pulse)' }
  ];

  const sizes = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra Large' },
    { value: 'fullscreen', label: 'Fullscreen' }
  ];

  return (
    <div className="min-h-screen bg-gradient-dark p-6 pt-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient-neon mb-4 animate-in slide-in-from-top-4 duration-1000">
            Modern Loading Screen
          </h1>
          <p className="text-muted-foreground text-lg">A stunning neon loading design that matches your nightlife vibe</p>
        </div>

        {/* NEW LoadingScreen Showcase */}
        <Card className="mb-8 glass border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl text-gradient-neon">🌟 Modern Loading Screen Component</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Fullscreen Preview */}
              <div className="relative rounded-lg overflow-hidden border border-primary/30" style={{ minHeight: '400px' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"></div>
                <div className="relative z-10 h-full flex items-center justify-center">
                  <LoadingScreen
                    variant={selectedVariant}
                    size={selectedSize}
                    text={customText}
                    showText={showText}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Variant</label>
                  <Select value={selectedVariant} onValueChange={(value: any) => setSelectedVariant(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((variant) => (
                        <SelectItem key={variant.value} value={variant.value}>
                          {variant.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Size</label>
                  <Select value={selectedSize} onValueChange={(value: any) => setSelectedSize(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Custom Text</label>
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                    placeholder="Loading..."
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => setShowText(!showText)}
                    variant={showText ? "default" : "outline"}
                    className="w-full"
                  >
                    {showText ? "Hide Text" : "Show Text"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All Variants Showcase */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>All Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {variants.map((variant) => (
                <Card key={variant.value} className="p-6 glass border-primary/20">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{variant.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center items-center min-h-[200px] bg-muted/10 rounded-lg">
                    <LoadingScreen
                      variant={variant.value as any}
                      size="xl"
                      text={`${variant.label} Loading`}
                      showText={true}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>📖 Usage Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 text-lg text-primary">Basic Usage:</h4>
                <pre className="bg-muted/50 p-4 rounded-md text-sm overflow-x-auto border border-primary/20">
{`import LoadingScreen from '@/components/ui/LoadingScreen';

// Fullscreen loading (default)
<LoadingScreen />

// With custom text
<LoadingScreen text="Preparing your experience..." />

// Different variants
<LoadingScreen variant="default" />  // Multi-ring neon
<LoadingScreen variant="minimal" />  // Elegant simple
<LoadingScreen variant="energetic" /> // Fast pulsing

// Different sizes
<LoadingScreen size="sm" />
<LoadingScreen size="md" />
<LoadingScreen size="lg" />
<LoadingScreen size="xl" />
<LoadingScreen size="fullscreen" /> // Default`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3 text-lg text-primary">Available Props:</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li><strong>variant:</strong> "default" | "minimal" | "energetic" - Choose the animation style</li>
                  <li><strong>size:</strong> "sm" | "md" | "lg" | "xl" | "fullscreen" - Control the size</li>
                  <li><strong>text:</strong> string - Custom loading text (default: "Loading...")</li>
                  <li><strong>showText:</strong> boolean - Show/hide the text (default: true)</li>
                  <li><strong>className:</strong> string - Additional CSS classes</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-lg text-primary">Examples:</h4>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-muted/30 rounded border border-primary/10">
                    <code className="text-primary">// Fullscreen overlay loading</code>
                    <pre className="mt-2 text-xs">
{`<LoadingScreen 
  variant="default"
  size="fullscreen"
  text="Loading events..."
/>`}
                    </pre>
                  </div>
                  <div className="p-3 bg-muted/30 rounded border border-primary/10">
                    <code className="text-primary">// Inline small loader</code>
                    <pre className="mt-2 text-xs">
{`<LoadingScreen 
  variant="minimal"
  size="md"
  showText={false}
/>`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Old Loading Animation (for comparison) */}
        <Card className="border-muted/50">
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">Legacy Loading Animation (For Comparison)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center min-h-[200px] bg-muted/10 rounded-lg">
              <LoadingAnimation
                type={selectedType}
                size="lg"
                color="primary"
                text="Old Animation Style"
                showText={true}
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default LoadingDemo; 