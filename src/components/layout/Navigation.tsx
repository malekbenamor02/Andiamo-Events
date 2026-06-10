import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  CalendarDays,
  Users,
  Briefcase,
  Mail,
  MessageSquare,
  Info,
  ChevronRight,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationContent } from "@/hooks/useSiteContent";
import { PRIMARY_SLOGAN } from "@/lib/constants";

interface NavigationProps {
  language: 'en' | 'fr';
  toggleLanguage: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

interface NavigationContent {
  [language: string]: Array<{
    name: string;
    href: string;
  }>;
}

interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  [key: string]: string | undefined;
}

// Desktop: one slot that cycles Contact / Suggestions with smooth animation
const CYCLE_MS = 3500;
const MENU_CLOSE_MS = 300;

const MOBILE_NAV_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/events": CalendarDays,
  "/ambassador": Users,
  "/careers": Briefcase,
  "/contact": Mail,
  "/suggestions": MessageSquare,
  "/about": Info,
};

function AnimatedContactSuggestionsSlot({
  language,
  isActive,
  inactiveLinkClass,
}: {
  language: 'en' | 'fr';
  isActive: (path: string) => boolean;
  inactiveLinkClass: string;
}) {
  const [index, setIndex] = useState(0);
  const contact = language === 'en' ? { name: "Contact", href: "/contact" } : { name: "Contact", href: "/contact" };
  const suggestions = language === 'en' ? { name: "Suggestions", href: "/suggestions" } : { name: "Suggestions", href: "/suggestions" };
  const items = [contact, suggestions];

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [items.length]);

  const current = items[index];
  const active = isActive("/contact") || isActive("/suggestions");

  return (
    <div className="relative h-5 flex items-center min-w-[100px]" style={{ perspective: '100px' }}>
      {items.map((item, i) => (
        <Link
          key={item.href}
          to={item.href}
          className={`absolute inset-0 flex items-center text-sm font-medium transition-all duration-500 ease-in-out ${
            i === index ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none -translate-y-2'
          } ${active ? 'text-primary' : inactiveLinkClass}`}
          style={{ transform: i === index ? 'translateY(0)' : 'translateY(-8px)' }}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}

const Navigation = ({ language, toggleLanguage, theme, toggleTheme }: NavigationProps) => {
  const [navigationContent, setNavigationContent] = useState<NavigationContent>({});
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  // Start with white logo, then switch after background detection.
  const [useBlackLogo, setUseBlackLogo] = useState(false);
  const location = useLocation();

  const { data: siteContent } = useNavigationContent();
  useEffect(() => {
    if (siteContent) {
      if (siteContent.navigation) setNavigationContent(siteContent.navigation as NavigationContent);
      if (siteContent.contact_info) setContactInfo(siteContent.contact_info as ContactInfo);
    }
  }, [siteContent]);

  useEffect(() => {
    // Always start white on first paint / route change.
    setUseBlackLogo(false);

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const parseRgb = (color: string): [number, number, number, number] | null => {
      const match = color.match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(",").map((p) => p.trim());
      if (parts.length < 3) return null;
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      const a = parts[3] === undefined ? 1 : Number(parts[3]);
      if ([r, g, b, a].some((v) => Number.isNaN(v))) return null;
      return [r, g, b, a];
    };

    const getEffectiveBackground = (element: Element | null): [number, number, number] => {
      let current: Element | null = element;
      while (current && current !== document.documentElement) {
        const parsed = parseRgb(window.getComputedStyle(current).backgroundColor);
        if (parsed && parsed[3] > 0.05) {
          return [parsed[0], parsed[1], parsed[2]];
        }
        current = current.parentElement;
      }
      return [255, 255, 255];
    };

    const hasPassedHeroSection = () => {
      if (location.pathname !== "/") return true;
      const main = document.getElementById("main-content");
      const hero = main?.querySelector("section");
      if (!hero) {
        // Fallback for any timing/layout race on first paint.
        return window.scrollY > Math.max(200, window.innerHeight * 0.55);
      }
      const heroBottom = hero.getBoundingClientRect().bottom;
      return heroBottom <= 64;
    };

    const updateLogoByBackground = () => {
      // Home + light: hero is below the nav; the bar reads on light page chrome — use dark logo + links until past hero.
      if (theme === "light" && location.pathname === "/" && !hasPassedHeroSection()) {
        setUseBlackLogo(true);
        return;
      }

      // While hero still dominates scroll (dark hero under viewport logic), keep white logo for contrast.
      if (!hasPassedHeroSection()) {
        setUseBlackLogo(false);
        return;
      }

      const sampleX = Math.min(120, Math.max(0, window.innerWidth - 1));
      // Sample below the navbar to read page background, not nav background.
      const sampleY = Math.min(92, Math.max(0, window.innerHeight - 1));
      const target = document.elementFromPoint(sampleX, sampleY);
      const [r, g, b] = getEffectiveBackground(target);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

      // After hero: theme-aware thresholds + hysteresis to avoid flicker.
      setUseBlackLogo((prev) => {
        if (theme === "light") {
          if (prev) return luminance > 0.58;
          return luminance > 0.66;
        }
        // In dark mode, switch to black only on very bright backgrounds.
        if (prev) return luminance > 0.76;
        return luminance > 0.84;
      });
    };

    const queueUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updateLogoByBackground);
    };

    // Keep white logo briefly, then detect.
    timeoutId = setTimeout(queueUpdate, 90);
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
    };
  }, [theme, location.pathname]);

  // Mobile: separate Contact and Suggestions links (7 items)
  const navigationMobile = {
    en: [
      { name: "Home", href: "/" },
      { name: "Events", href: "/events" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Careers", href: "/careers" },
      { name: "Contact", href: "/contact" },
      { name: "Suggestions", href: "/suggestions" },
      { name: "About", href: "/about" },
    ],
    fr: [
      { name: "Accueil", href: "/" },
      { name: "Événements", href: "/events" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Carrières", href: "/careers" },
      { name: "Contact", href: "/contact" },
      { name: "Suggestions", href: "/suggestions" },
      { name: "À Propos", href: "/about" },
    ],
  };

  // Desktop: Contact/Suggestions animated slot last (after About)
  const desktopNavItems = {
    en: [
      { name: "Home", href: "/" },
      { name: "Events", href: "/events" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Careers", href: "/careers" },
      { name: "About", href: "/about" },
      { type: "contact_suggestions" as const },
    ],
    fr: [
      { name: "Accueil", href: "/" },
      { name: "Événements", href: "/events" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Carrières", href: "/careers" },
      { name: "À Propos", href: "/about" },
      { type: "contact_suggestions" as const },
    ],
  };

  const isActive = (path: string) => location.pathname === path;

  const closeMenu = useCallback(() => {
    if (!isMenuOpen || isMenuClosing) return;
    setIsMenuClosing(true);
    window.setTimeout(() => {
      setIsMenuOpen(false);
      setIsMenuClosing(false);
    }, MENU_CLOSE_MS);
  }, [isMenuOpen, isMenuClosing]);

  const toggleMenu = () => {
    if (isMenuOpen) {
      closeMenu();
      return;
    }
    setIsMenuClosing(false);
    setIsMenuOpen(true);
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsMenuClosing(false);
  }, [location.pathname]);

  const desktopItems = desktopNavItems[language];
  const isLightMode = theme === "light";
  const themeLabel = isLightMode ? "Light" : "Dark";
  const mobileMenuButtonClass = isMenuOpen
    ? "md:hidden p-2 text-primary hover:text-primary transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-primary/35 bg-primary/12 hover:bg-primary/20 hover:border-primary/55 active:scale-95"
    : isLightMode && !useBlackLogo
      ? "md:hidden p-2 text-white hover:text-white transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-white/25 bg-black/25 hover:bg-black/40 active:scale-95"
      : "md:hidden p-2 text-foreground hover:text-primary transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-card/60 active:scale-95";
  const inactiveDesktopLinkClass =
    isLightMode && useBlackLogo
      ? "text-foreground hover:text-primary"
      : "text-white/90 hover:text-primary";
  const logoSrc = isLightMode && useBlackLogo
    ? "/email-assets/logo-black.png"
    : "/email-assets/logo-white.png";

  return (
    <>
      <nav
        className={`fixed top-[var(--site-countdown-offset,0px)] w-full transition-[background-color,backdrop-filter] duration-300 ${
          isMenuOpen
            ? "z-[100] bg-transparent backdrop-blur-none"
            : "z-50 bg-background/80 backdrop-blur-xl"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex h-full items-center shrink-0 focus:outline-none"
              aria-label="Go to home"
            >
              <img
                src={logoSrc}
                alt="Andiamo Events Logo"
                className="block h-7 w-36 shrink-0 object-contain object-left sm:h-8 sm:w-40"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {desktopItems.map((item, i) =>
                'type' in item && item.type === 'contact_suggestions' ? (
                  <AnimatedContactSuggestionsSlot
                    key="contact-suggestions"
                    language={language}
                    isActive={isActive}
                    inactiveLinkClass={inactiveDesktopLinkClass}
                  />
                ) : (
                  <Link
                    key={'href' in item ? item.href : i}
                    to={'href' in item ? item.href : '/'}
                    className={`text-sm font-medium transition-colors ${
                      isActive('href' in item ? item.href : '/')
                        ? "text-primary"
                        : inactiveDesktopLinkClass
                    }`}
                  >
                    {'name' in item ? item.name : ''}
                  </Link>
                )
              )}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLanguage}
                className="h-8 min-w-[44px] px-3 rounded-xl text-sm font-medium border border-white/35 bg-black/30 text-white hover:bg-black/45 hover:border-white/50 hover:text-white"
              >
                {language.toUpperCase()}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="h-8 p-0 hover:bg-transparent flex items-center"
              >
                <span className="theme-switch-shell on-dark">
                  <span className={`theme-switch-track ${isLightMode ? "is-light" : "is-dark"}`}>
                    <span className={`theme-switch-thumb ${isLightMode ? "is-light" : "is-dark"}`} />
                  </span>
                  <span className="theme-switch-label">{themeLabel}</span>
                </span>
              </Button>
            </div>

            {/* Mobile Menu Button — hamburger opens, X closes (synced with menu state) */}
            <button
              type="button"
              onClick={toggleMenu}
              className={mobileMenuButtonClass}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 1,
              }}
              aria-label={
                isMenuOpen
                  ? language === "en"
                    ? "Close menu"
                    : "Fermer le menu"
                  : language === "en"
                    ? "Open menu"
                    : "Ouvrir le menu"
              }
              aria-expanded={isMenuOpen}
            >
              <div className="relative w-6 h-6">
                <Menu
                  className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
                    isMenuOpen ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
                  }`}
                />
                <X
                  className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
                    isMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - Outside nav to avoid stacking context */}
      {isMenuOpen && (
        <>
          <div
            className={`mobile-menu-overlay md:hidden ${isMenuClosing ? "animate-menu-overlay-out" : "animate-menu-overlay-in"}`}
            onClick={closeMenu}
            onTouchEnd={(e) => {
              e.preventDefault();
              closeMenu();
            }}
            aria-hidden
          />
          <div
            className={`mobile-menu-panel md:hidden ${isMenuClosing ? "animate-menu-slide-out" : "animate-menu-slide-in"}`}
            role="dialog"
            aria-modal="true"
            aria-label={language === "en" ? "Navigation menu" : "Menu de navigation"}
          >
            <div className="mobile-menu-inner">
              <span className="mobile-menu-glow mobile-menu-glow--primary" aria-hidden />
              <span className="mobile-menu-glow mobile-menu-glow--accent" aria-hidden />

              <div className="mobile-menu-header">
                <p className="mobile-menu-tagline">{PRIMARY_SLOGAN[language]}</p>
                <span className="mobile-menu-header-spacer" aria-hidden />
              </div>

              <nav className="mobile-menu-nav" aria-label={language === "en" ? "Main navigation" : "Navigation principale"}>
                {navigationMobile[language].map((item, index) => {
                  const Icon = MOBILE_NAV_ICONS[item.href] ?? Home;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={closeMenu}
                      className={`mobile-menu-link${active ? " mobile-menu-link--active" : ""}`}
                      style={{ animationDelay: `${0.08 + index * 0.055}s` }}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && <span className="mobile-menu-link-indicator" aria-hidden />}
                      <span className="mobile-menu-link-icon" aria-hidden>
                        <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                      </span>
                      <span className="mobile-menu-link-label">{item.name}</span>
                      <ChevronRight className="mobile-menu-link-chevron" aria-hidden />
                    </Link>
                  );
                })}
              </nav>

              <div
                className="mobile-menu-footer"
                style={{ animationDelay: `${0.08 + navigationMobile[language].length * 0.055 + 0.08}s` }}
              >
                <button
                  type="button"
                  className="mobile-menu-action"
                  onClick={toggleLanguage}
                >
                  <Globe className="mobile-menu-action-icon" aria-hidden />
                  {language === "en" ? "English" : "Français"}
                </button>
                <button
                  type="button"
                  className="mobile-menu-action mobile-menu-action--theme"
                  onClick={toggleTheme}
                  aria-label={language === "en" ? "Toggle theme" : "Changer le thème"}
                >
                  <span className="theme-switch-shell">
                    <span className={`theme-switch-track ${isLightMode ? "is-light" : "is-dark"}`}>
                      <span className={`theme-switch-thumb ${isLightMode ? "is-light" : "is-dark"}`} />
                    </span>
                    <span className="theme-switch-label">{themeLabel}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .theme-switch-shell {
          display: inline-flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          min-width: 0;
          line-height: 1;
        }

        .theme-switch-track {
          width: 56px;
          height: 28px;
          border-radius: 9999px;
          border: 1px solid hsl(var(--border) / 0.85);
          background: hsl(var(--muted) / 0.7);
          position: relative;
          box-shadow: inset 0 0 0 1px hsl(var(--background) / 0.2);
          transition: background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .theme-switch-track.is-dark {
          background: hsl(var(--card) / 0.65);
          border-color: hsl(var(--border) / 0.95);
          box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.12);
        }

        .theme-switch-track.is-light {
          background: hsl(var(--muted) / 0.85);
          border-color: hsl(var(--border) / 0.8);
        }

        .theme-switch-thumb {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--foreground) / 0.22);
          position: absolute;
          top: 2px;
          left: 2px;
          box-shadow: 0 1px 3px hsl(var(--foreground) / 0.2), 0 0 0 1px hsl(var(--background) / 0.35);
          transition: transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease;
        }

        .theme-switch-thumb.is-light {
          transform: translateX(28px);
        }

        .theme-switch-label {
          display: inline-flex;
          align-items: center;
          font-size: 0.78rem;
          line-height: 1;
          font-weight: 500;
          color: hsl(var(--foreground));
          white-space: nowrap;
        }

        .theme-switch-shell.on-dark .theme-switch-track {
          background: hsl(var(--background) / 0.28);
          border-color: hsl(var(--background) / 0.55);
          box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.12);
        }

        .theme-switch-shell.on-dark .theme-switch-track.is-light {
          background: hsl(var(--background) / 0.38);
          border-color: hsl(var(--background) / 0.62);
        }

        .theme-switch-shell.on-dark .theme-switch-thumb {
          background: hsl(var(--background) / 0.96);
          border-color: hsl(var(--background) / 0.65);
          box-shadow: 0 1px 4px hsl(var(--foreground) / 0.28);
        }

        .theme-switch-shell.on-dark .theme-switch-label {
          color: hsl(var(--background) / 0.95);
        }

      `}</style>
    </>
  );
};

export default Navigation;
