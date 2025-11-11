import { useState } from 'react';
import LoadingAnimation from '@/components/ui/LoadingAnimation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LoadingDemo = () => {
  const [selectedType, setSelectedType] = useState<'spinner' | 'dots' | 'wave' | 'pulse' | 'bars'>('spinner');
  const [selectedSize, setSelectedSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [selectedColor, setSelectedColor] = useState<'primary' | 'white' | 'muted' | 'gradient'>('primary');
  const [customText, setCustomText] = useState('Loading...');
  const [showText, setShowText] = useState(true);

  const animationTypes = [
    { value: 'spinner', label: 'Spinner' },
    { value: 'dots', label: 'Dots' },
    { value: 'wave', label: 'Wave' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'bars', label: 'Bars' }
  ];

  const sizes = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra Large' }
  ];

  const colors = [
    { value: 'primary', label: 'Primary' },
    { value: 'white', label: 'White' },
    { value: 'muted', label: 'Muted' },
    { value: 'gradient', label: 'Gradient' }
  ];

  return (
    <div className="min-h-screen bg-gradient-dark p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Loading Animation Demo</h1>
          <p className="text-muted-foreground">Choose your preferred loading animation for the entire site</p>
        </div>

        {/* Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Customize Animation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Animation Type</label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {animationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
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
              <label className="text-sm font-medium mb-2 block">Color</label>
              <Select value={selectedColor} onValueChange={(value: any) => setSelectedColor(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.label}
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
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center min-h-[200px] bg-muted/20 rounded-lg">
              <LoadingAnimation
                type={selectedType}
                size={selectedSize}
                color={selectedColor}
                text={customText}
                showText={showText}
              />
            </div>
          </CardContent>
        </Card>

        {/* All Animations */}
        <Card>
          <CardHeader>
            <CardTitle>All Animation Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {animationTypes.map((type) => (
                <Card key={type.value} className="p-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{type.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <LoadingAnimation
                      type={type.value as any}
                      size="lg"
                      color="primary"
                      text={`${type.label} Loading`}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Basic Usage:</h4>
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
{`import LoadingAnimation from '@/components/ui/LoadingAnimation';

<LoadingAnimation 
  type="spinner"
  size="md"
  color="primary"
  text="Loading..."
/>`}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Available Props:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>type:</strong> "spinner" | "dots" | "wave" | "pulse" | "bars"</li>
                  <li><strong>size:</strong> "sm" | "md" | "lg" | "xl"</li>
                  <li><strong>color:</strong> "primary" | "white" | "muted" | "gradient"</li>
                  <li><strong>text:</strong> Custom loading text</li>
                  <li><strong>showText:</strong> Boolean to show/hide text</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadingDemo; 