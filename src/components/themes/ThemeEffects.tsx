import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const ThemeEffects = () => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!theme.effects.particles || !containerRef.current) return;

    const container = containerRef.current;
    const particles: HTMLDivElement[] = [];
    const timeouts: NodeJS.Timeout[] = [];

    // Cleanup function
    const cleanup = () => {
      particles.forEach(particle => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
      timeouts.forEach(timeout => clearTimeout(timeout));
      particles.length = 0;
      timeouts.length = 0;
    };

    // Create premium particles based on theme
    const createParticle = (type: string, index: number) => {
      const particle = document.createElement('div');
      particle.className = `theme-particle theme-particle-${type}`;
      
      particle.style.position = 'fixed';
      particle.style.pointerEvents = 'none';
      particle.style.zIndex = '1';
      particle.style.willChange = 'transform, opacity';

      switch (theme.name) {
        case 'halloween': {
          // Premium Halloween elements - more elegant and subtle
          const particleType = index % 6;
          
          if (particleType === 0 || particleType === 1) {
            // Bat silhouettes - blurred, distant
            particle.innerHTML = '🦇';
            particle.style.fontSize = `${Math.random() * 20 + 15}px`;
            particle.style.color = `hsl(${theme.colors.primary})`;
            particle.style.opacity = '0.15';
            particle.style.filter = 'blur(1px)';
            particle.style.textShadow = `0 0 10px hsl(${theme.colors.primary} / 0.3)`;
            particle.style.animation = 'float-halloween-bat 15s ease-in-out infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
          } else if (particleType === 2) {
            // Minimal carved pumpkin with warm lighting
            particle.innerHTML = '🎃';
            particle.style.fontSize = `${Math.random() * 30 + 20}px`;
            particle.style.color = `hsl(${theme.colors.secondary})`;
            particle.style.textShadow = `0 0 15px hsl(${theme.colors.secondary} / 0.6), 0 0 30px hsl(${theme.colors.secondary} / 0.3)`;
            particle.style.animation = 'glow-pumpkin-premium 6s ease-in-out infinite';
            particle.style.left = `${Math.random() * 70 + 15}%`;
            particle.style.top = `${Math.random() * 60 + 20}%`;
            particle.style.opacity = '0.4';
          } else if (particleType === 3) {
            // Elegant thin spider webs in corners
            particle.innerHTML = '🕸';
            particle.style.fontSize = `${Math.random() * 50 + 30}px`;
            particle.style.color = `hsl(${theme.colors.primary})`;
            particle.style.opacity = '0.1';
            particle.style.animation = 'float-spider-web-elegant 25s linear infinite';
            const corner = index % 4;
            if (corner === 0) {
              particle.style.left = '2%';
              particle.style.top = '2%';
            } else if (corner === 1) {
              particle.style.left = '95%';
              particle.style.top = '2%';
            } else if (corner === 2) {
              particle.style.left = '2%';
              particle.style.top = '95%';
            } else {
              particle.style.left = '95%';
              particle.style.top = '95%';
            }
          } else if (particleType === 4) {
            // Full moon glow - organic integration
            particle.innerHTML = '🌕';
            particle.style.fontSize = '80px';
            particle.style.color = `hsl(${theme.colors.neon1})`;
            particle.style.textShadow = `0 0 40px hsl(${theme.colors.neon1} / 0.5), 0 0 80px hsl(${theme.colors.neon1} / 0.2)`;
            particle.style.animation = 'glow-moon-premium 10s ease-in-out infinite';
            particle.style.left = '88%';
            particle.style.top = '8%';
            particle.style.zIndex = '0';
            particle.style.opacity = '0.3';
          } else {
            // Soft drifting fog layers
            particle.innerHTML = '🌫';
            particle.style.fontSize = `${Math.random() * 40 + 25}px`;
            particle.style.color = `hsl(${theme.colors.neon3})`;
            particle.style.opacity = '0.08';
            particle.style.animation = 'drift-fog 20s ease-in-out infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.filter = 'blur(3px)';
          }
          break;
        }
        
        case 'icy': {
          // Premium Winter elements - majestic and elegant
          const particleType = index % 7;
          
          if (particleType === 0 || particleType === 1 || particleType === 2) {
            // Realistic snow particles - slow drift
            particle.innerHTML = '❄';
            particle.style.fontSize = `${Math.random() * 12 + 8}px`;
            particle.style.color = `hsl(${theme.colors.neon2})`;
            particle.style.textShadow = `0 0 8px hsl(${theme.colors.neon2} / 0.6)`;
            particle.style.animation = 'fall-snow-realistic 18s linear infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = '-10%';
            particle.style.animationDelay = `${Math.random() * 18}s`;
            particle.style.opacity = '0.7';
          } else if (particleType === 3) {
            // Winter moon/sun - large, soft
            particle.innerHTML = '🌙';
            particle.style.fontSize = '70px';
            particle.style.color = `hsl(${theme.colors.neon2})`;
            particle.style.textShadow = `0 0 35px hsl(${theme.colors.neon2} / 0.4), 0 0 70px hsl(${theme.colors.neon2} / 0.2)`;
            particle.style.animation = 'glow-winter-moon-premium 12s ease-in-out infinite';
            particle.style.left = '82%';
            particle.style.top = '12%';
            particle.style.zIndex = '0';
            particle.style.opacity = '0.25';
          } else if (particleType === 4 || particleType === 5) {
            // Pine forest silhouettes
            particle.innerHTML = '🌲';
            particle.style.fontSize = `${Math.random() * 35 + 25}px`;
            particle.style.color = `hsl(${theme.colors.secondary})`;
            particle.style.opacity = '0.2';
            particle.style.animation = 'sway-pine-premium 20s ease-in-out infinite';
            particle.style.left = index % 2 === 0 ? '3%' : '92%';
            particle.style.top = `${Math.random() * 45 + 35}%`;
            particle.style.filter = 'blur(0.5px)';
          } else {
            // Minimalistic snowflakes
            particle.innerHTML = '❅';
            particle.style.fontSize = `${Math.random() * 10 + 6}px`;
            particle.style.color = `hsl(${theme.colors.neon3})`;
            particle.style.opacity = '0.5';
            particle.style.animation = 'sparkle-snowflake 5s ease-in-out infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
          }
          break;
        }
        
        case 'summer': {
          // Premium Summer elements - elegant tropical
          const particleType = index % 7;
          
          if (particleType === 0) {
            // Soft sun glow
            particle.innerHTML = '☀';
            particle.style.fontSize = `${Math.random() * 45 + 35}px`;
            particle.style.color = `hsl(${theme.colors.accent})`;
            particle.style.textShadow = `0 0 30px hsl(${theme.colors.accent} / 0.7), 0 0 60px hsl(${theme.colors.accent} / 0.4)`;
            particle.style.animation = 'glow-sun-premium 15s ease-in-out infinite';
            particle.style.left = `${Math.random() * 25 + 70}%`;
            particle.style.top = `${Math.random() * 15 + 5}%`;
            particle.style.opacity = '0.4';
          } else if (particleType === 1 || particleType === 2) {
            // Palm leaf shadows - elegant casting
            particle.innerHTML = '🌴';
            particle.style.fontSize = `${Math.random() * 45 + 35}px`;
            particle.style.color = `hsl(${theme.colors.neon3})`;
            particle.style.opacity = '0.15';
            particle.style.animation = 'sway-palm-premium 10s ease-in-out infinite';
            particle.style.left = index % 2 === 0 ? '2%' : '93%';
            particle.style.top = `${Math.random() * 50 + 25}%`;
            particle.style.filter = 'blur(1px)';
          } else if (particleType === 3) {
            // Wave shapes - elegant dividers
            particle.innerHTML = '🌊';
            particle.style.fontSize = `${Math.random() * 35 + 25}px`;
            particle.style.color = `hsl(${theme.colors.primary})`;
            particle.style.opacity = '0.3';
            particle.style.animation = 'wave-summer-premium 8s ease-in-out infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 30 + 65}%`;
          } else if (particleType === 4) {
            // Bokeh dots - lens effect
            particle.style.width = `${Math.random() * 15 + 5}px`;
            particle.style.height = particle.style.width;
            particle.style.borderRadius = '50%';
            particle.style.background = `radial-gradient(circle, hsl(${theme.colors.accent} / 0.3), transparent)`;
            particle.style.animation = 'float-bokeh 12s ease-in-out infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.filter = 'blur(2px)';
          } else {
            // Sparkles - subtle shimmer
            particle.innerHTML = '✨';
            particle.style.fontSize = `${Math.random() * 14 + 8}px`;
            particle.style.color = `hsl(${theme.colors.accent})`;
            particle.style.textShadow = `0 0 10px hsl(${theme.colors.accent} / 0.6)`;
            particle.style.animation = 'sparkle-summer-premium 4s ease-in-out infinite';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.opacity = '0.6';
          }
          break;
        }
        
        default: {
          // Default theme particles (stars/sparkles)
          particle.innerHTML = '✨';
          particle.style.fontSize = `${Math.random() * 12 + 6}px`;
          particle.style.color = `hsl(${theme.colors.primary})`;
          particle.style.textShadow = `0 0 8px hsl(${theme.colors.primary} / 0.6)`;
          particle.style.animation = 'twinkle-default 4s ease-in-out infinite';
          particle.style.left = `${Math.random() * 100}%`;
          particle.style.top = `${Math.random() * 100}%`;
        }
      }

      particle.style.animationDelay = `${Math.random() * 2}s`;
      return particle;
    };

    // Create particles based on theme - reduced count for premium feel
    const particleCount = theme.name === 'icy' ? 25 : theme.name === 'halloween' ? 18 : theme.name === 'summer' ? 20 : 20;
    
    for (let i = 0; i < particleCount; i++) {
      const timeout = setTimeout(() => {
        const particle = createParticle(theme.name, i);
        container.appendChild(particle);
        particles.push(particle);
      }, i * 200); // Slower stagger for premium effect
      timeouts.push(timeout);
    }

    return cleanup;
  }, [theme]);

  return <div ref={containerRef} className="theme-effects-container" />;
};

export default ThemeEffects;
