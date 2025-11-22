import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeName = 'default' | 'halloween' | 'icy' | 'spicy' | 'summer';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  card: string;
  border: string;
  neon1: string;
  neon2: string;
  neon3: string;
}

export interface ThemeEffects {
  particles?: boolean;
  glow?: boolean;
  animation?: string;
  objects?: string[];
}

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;
  effects: ThemeEffects;
  gradient: string;
  shadow: string;
}

// Theme Definitions
export const themes: Record<ThemeName, Theme> = {
  default: {
    name: 'default',
    displayName: 'Default (Nightlife)',
    colors: {
      primary: '285 85% 65%', // Purple
      secondary: '195 100% 50%', // Cyan
      accent: '330 100% 65%', // Pink
      background: '218 23% 8%',
      card: '218 23% 12%',
      border: '218 23% 20%',
      neon1: '285 85% 65%',
      neon2: '195 100% 50%',
      neon3: '330 100% 65%',
    },
    effects: {
      particles: true,
      glow: true,
      animation: 'pulse',
      objects: ['stars', 'sparkles'],
    },
    gradient: 'linear-gradient(135deg, hsl(285 85% 65%), hsl(195 100% 50%), hsl(330 100% 65%))',
    shadow: '0 0 20px hsl(285 85% 65% / 0.5)',
  },
  halloween: {
    name: 'halloween',
    displayName: 'Halloween',
    colors: {
      primary: '284 46% 23%', // Imperial Purple #4b1f57
      secondary: '21 100% 58%', // Pumpkin Accent #ff8a2a
      accent: '284 46% 35%', // Imperial Purple lighter
      background: '0 0% 5%', // Charcoal Black #0e0e0e
      card: '0 0% 18%', // Misty Grey #2e2e2e
      border: '284 20% 25%',
      neon1: '284 46% 23%', // Imperial Purple
      neon2: '21 100% 58%', // Pumpkin Accent
      neon3: '0 0% 18%', // Misty Grey
    },
    effects: {
      particles: true,
      glow: true,
      animation: 'flicker',
      objects: ['bats-silhouette', 'pumpkins-minimal', 'fog-layers', 'spider-webs-elegant', 'full-moon', 'candlelight'],
    },
    gradient: 'linear-gradient(135deg, hsl(0 0% 5%), hsl(284 46% 23%), hsl(21 100% 58%))',
    shadow: '0 0 25px hsl(21 100% 58% / 0.4), 0 0 50px hsl(284 46% 23% / 0.3)',
  },
  icy: {
    name: 'icy',
    displayName: 'Winter Is Coming',
    colors: {
      primary: '204 100% 87%', // Glacier Ice Blue #b7e4ff
      secondary: '218 62% 10%', // Deep Navy #0a1a2f
      accent: '215 100% 98%', // Crystal White #f8fbff
      background: '218 62% 10%', // Deep Navy #0a1a2f
      card: '215 30% 15%', // Frosted glass effect
      border: '215 22% 40%', // Metallic Silver border #cfd8e3 adjusted
      neon1: '204 100% 87%', // Glacier Ice Blue
      neon2: '215 100% 98%', // Crystal White
      neon3: '215 22% 85%', // Metallic Silver #cfd8e3
    },
    effects: {
      particles: true,
      glow: true,
      animation: 'sparkle',
      objects: ['snow-realistic', 'ice-shards', 'frosted-glass', 'aurora-glow', 'pine-silhouettes', 'winter-moon', 'ice-patterns'],
    },
    gradient: 'linear-gradient(135deg, hsl(218 62% 10%), hsl(204 100% 87%), hsl(215 100% 98%))',
    shadow: '0 0 30px hsl(204 100% 87% / 0.4), 0 0 60px hsl(215 100% 98% / 0.2)',
  },
  spicy: {
    name: 'spicy',
    displayName: 'Spicy',
    colors: {
      primary: '0 84% 60%', // Red
      secondary: '15 100% 65%', // Orange
      accent: '30 100% 55%', // Hot Orange
      background: '0 0% 8%',
      card: '0 0% 12%',
      border: '0 50% 25%',
      neon1: '0 84% 60%',
      neon2: '15 100% 65%',
      neon3: '30 100% 55%',
    },
    effects: {
      particles: true,
      glow: true,
      animation: 'flame',
      objects: ['flames', 'sparks', 'embers'],
    },
    gradient: 'linear-gradient(135deg, hsl(0 84% 60%), hsl(15 100% 65%), hsl(30 100% 55%))',
    shadow: '0 0 30px hsl(0 84% 60% / 0.8)',
  },
  summer: {
    name: 'summer',
    displayName: 'Summer',
    colors: {
      primary: '181 73% 46%', // Ocean Turquoise #20c7c9
      secondary: '189 90% 24%', // Deep Marine Blue #065f74
      accent: '18 100% 64%', // Sunset Orange #ff8746
      background: '189 30% 10%', // Deep marine dark
      card: '35 40% 18%', // Sand beige dark adjusted #f2d7b4
      border: '181 50% 50%',
      neon1: '181 73% 46%', // Ocean Turquoise
      neon2: '18 100% 64%', // Sunset Orange
      neon3: '145 58% 40%', // Tropical Green #2b9f62
    },
    effects: {
      particles: true,
      glow: true,
      animation: 'sunshine',
      objects: ['palm-shadows', 'wave-dividers', 'sun-glow', 'bokeh-dots', 'beach-elements', 'sunset-gradient', 'ocean-reflection'],
    },
    gradient: 'linear-gradient(135deg, hsl(181 73% 46%), hsl(189 90% 24%), hsl(18 100% 64%))',
    shadow: '0 0 30px hsl(181 73% 46% / 0.5), 0 0 60px hsl(18 100% 64% / 0.3)',
  },
};

interface ThemeContextType {
  currentTheme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  theme: Theme;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('default');
  const [loading, setLoading] = useState(true);

  // Fetch theme from database
  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('content')
          .eq('key', 'site_theme')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching theme:', error);
          return;
        }

        if (data?.content) {
          const themeData = data.content as { activeTheme?: ThemeName };
          if (themeData.activeTheme && themes[themeData.activeTheme]) {
            setCurrentTheme(themeData.activeTheme);
          }
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();
  }, []);

  // Apply theme to CSS variables
  useEffect(() => {
    if (loading) return;

    const theme = themes[currentTheme];
    const root = document.documentElement;

    // Apply color variables
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--secondary', theme.colors.secondary);
    root.style.setProperty('--accent', theme.colors.accent);
    root.style.setProperty('--background', theme.colors.background);
    root.style.setProperty('--card', theme.colors.card);
    root.style.setProperty('--border', theme.colors.border);
    root.style.setProperty('--neon-purple', theme.colors.neon1);
    root.style.setProperty('--neon-cyan', theme.colors.neon2);
    root.style.setProperty('--neon-pink', theme.colors.neon3);

    // Apply gradients
    root.style.setProperty('--gradient-primary', theme.gradient);
    root.style.setProperty('--gradient-neon', theme.gradient);

    // Apply shadows
    root.style.setProperty('--shadow-neon', theme.shadow);

    // Add theme class to body for theme-specific effects
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${currentTheme}`);
  }, [currentTheme, loading]);

  const setTheme = async (theme: ThemeName) => {
    try {
      // Save to database
      const { error } = await supabase
        .from('site_content')
        .upsert({
          key: 'site_theme',
          content: { activeTheme: theme },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) throw error;

      setCurrentTheme(theme);
    } catch (error) {
      console.error('Error saving theme:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        theme: themes[currentTheme],
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

