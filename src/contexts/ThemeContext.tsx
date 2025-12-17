import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeName = 'default';

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
  neon4?: string; // Optional for neon-gold
  neon5?: string; // Optional for neon-orange
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
    displayName: 'Default (Nightlife Black & Red)',
    colors: {
      primary: '352 80% 49%', // Red #E21836
      secondary: '270 80% 60%', // Purple #9D6BFF
      accent: '195 100% 55%', // Cyan #00CFFF
      background: '0 0% 0%', // Black #000000
      card: '0 0% 10%', // Dark Gray #1A1A1A
      border: '0 0% 26%', // Gray #424242
      neon1: '352 100% 65%', // Neon Red #FF3B5C
      neon2: '270 90% 65%', // Neon Purple #B084FF
      neon3: '195 100% 55%', // Neon Cyan #00CFFF
      neon4: '45 100% 55%', // Neon Gold #FFC93C
      neon5: '25 100% 60%', // Neon Orange #FF9F3D
    },
    effects: {
      particles: true,
      glow: true,
      animation: 'pulse',
      objects: ['stars', 'sparkles'],
    },
    gradient: 'linear-gradient(135deg, hsl(352 80% 49%), hsl(352 100% 65%), hsl(25 100% 60%))', // Red → Neon Red → Orange
    shadow: '0 0 30px hsl(352 100% 65% / 0.6)',
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

  // Apply theme to CSS variables immediately and on theme change
  useEffect(() => {
    const theme = themes[currentTheme];
    if (!theme) return; // Safety check
    
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
    if (theme.colors.neon4) {
      root.style.setProperty('--neon-yellow', theme.colors.neon4);
    }
    if (theme.colors.neon5) {
      root.style.setProperty('--neon-orange', theme.colors.neon5);
    }
    
    // Apply additional CSS variables
    root.style.setProperty('--muted', '0 0% 22%');
    root.style.setProperty('--muted-foreground', '0 0% 72%');
    root.style.setProperty('--input', '0 0% 16%');
    root.style.setProperty('--popover', theme.colors.card);
    root.style.setProperty('--popover-foreground', '0 0% 100%');
    root.style.setProperty('--card-foreground', '0 0% 100%');
    root.style.setProperty('--primary-foreground', '0 0% 100%');
    root.style.setProperty('--secondary-foreground', '0 0% 100%');
    root.style.setProperty('--accent-foreground', '0 0% 100%');
    root.style.setProperty('--destructive', '352 85% 42%');
    root.style.setProperty('--destructive-foreground', '0 0% 100%');
    root.style.setProperty('--ring', theme.colors.primary);
    
    // Sidebar colors
    root.style.setProperty('--sidebar-background', '0 0% 0%');
    root.style.setProperty('--sidebar-foreground', '0 0% 100%');
    root.style.setProperty('--sidebar-primary', theme.colors.primary);
    root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
    root.style.setProperty('--sidebar-accent', '0 0% 16%');
    root.style.setProperty('--sidebar-accent-foreground', '0 0% 100%');
    root.style.setProperty('--sidebar-border', theme.colors.border);
    root.style.setProperty('--sidebar-ring', theme.colors.primary);

    // Apply gradients
    root.style.setProperty('--gradient-primary', theme.gradient);
    root.style.setProperty('--gradient-neon', theme.gradient);
    root.style.setProperty('--gradient-dark', 'linear-gradient(135deg, hsl(0 0% 0%), hsl(0 0% 10%))');

    // Apply shadows
    root.style.setProperty('--shadow-neon', theme.shadow);
    root.style.setProperty('--shadow-neon-strong', '0 0 40px hsl(352 100% 65% / 0.8)');
    root.style.setProperty('--shadow-cyan', '0 0 20px hsl(195 100% 55% / 0.5)');
    root.style.setProperty('--shadow-pink', '0 0 20px hsl(270 90% 65% / 0.5)');

    // Add theme class to body for theme-specific effects
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add('theme-default');
  }, [currentTheme]); // Removed loading dependency to apply immediately

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

