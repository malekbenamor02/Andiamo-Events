
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, MessageCircle, Home, Calendar, Info, Users, Mail, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface NavigationProps {
  language: 'en' | 'fr';
  toggleLanguage: () => void;
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

const Navigation = ({ language, toggleLanguage }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [navigationContent, setNavigationContent] = useState<NavigationContent>({});
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('*')
          .in('key', ['navigation', 'contact_info']);

        if (error) throw error;

        data?.forEach(item => {
          if (item.key === 'navigation') {
            setNavigationContent(item.content as NavigationContent);
          } else if (item.key === 'contact_info') {
            setContactInfo(item.content as ContactInfo);
          }
        });
      } catch (error) {
        console.error('Error fetching navigation content:', error);
      }
    };

    fetchContent();
  }, []);

  // Handle click outside menu to close it (backup handler)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    if (isOpen) {
      // Add a small delay to prevent immediate close on open
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const openMenu = () => {
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const defaultNavigation = {
    en: [
      { name: "Home", href: "/" },
      { name: "Events", href: "/events" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
      { name: "About", href: "/about" },
    ],
    fr: [
      { name: "Accueil", href: "/" },
      { name: "Événements", href: "/events" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
      { name: "À Propos", href: "/about" },
    ]
  };

  // Always use default navigation to ensure no gallery links appear
  const navigation = defaultNavigation[language];

  const instagramClick = () => {
    window.open("https://www.instagram.com/andiamo.events/", "_blank");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-2xl border-b border-border/20 nav-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center focus:outline-none" aria-label="Go to home">
            <img src="/logo.svg" alt="Andiamo Events Logo" className="logo" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(item.href) 
                    ? "text-primary" 
                    : "text-foreground/80"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="btn-language"
            >
              {language.toUpperCase()}
            </Button>
            <Button
              onClick={instagramClick}
              className="btn-gradient"
            >
              <Instagram className="w-4 h-4 mr-2" />
              Instagram
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              ref={buttonRef}
              variant="ghost"
              size="sm"
              onClick={() => (isOpen ? closeMenu() : openMenu())}
              className="relative z-50 transition-all duration-300"
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              <div className="relative w-5 h-5">
                <Menu
                  className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                    isOpen
                      ? "opacity-0 rotate-90 scale-0"
                      : "opacity-100 rotate-0 scale-100"
                  }`}
                />
                <X
                  className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                    isOpen
                      ? "opacity-100 rotate-0 scale-100"
                      : "opacity-0 -rotate-90 scale-0"
                  }`}
                />
              </div>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden fixed inset-0 z-30 ${
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          {/* Overlay - covers full screen and closes menu on click */}
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMenu}
          />
          {/* Menu Content */}
          <div
            ref={menuRef}
            onClick={(e) => {
              // Close menu if clicking on empty space (not on content)
              if (e.target === e.currentTarget) {
                closeMenu();
              }
            }}
            className={`fixed top-16 left-0 right-0 bottom-0 backdrop-blur-2xl border-b border-border/20 nav-transparent z-40 overflow-y-auto ${
              isOpen ? "animate-menu-slide-in" : "animate-menu-slide-out"
            }`}
          >
            <div className="p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col space-y-4">
                {navigation.map((item, index) => {
                  let Icon = null;
                  if (item.href === "/") Icon = Home;
                  else if (item.href === "/events") Icon = Calendar;
                  else if (item.href === "/about") Icon = Info;
                  else if (item.href === "/ambassador") Icon = Users;
                  else if (item.href === "/contact") Icon = Mail;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={closeMenu}
                      className={`flex items-center gap-3 text-base font-medium transition-all duration-300 py-2 px-3 rounded-lg hover:bg-primary/10 hover:text-primary ${
                        isOpen
                          ? "animate-menu-item-in"
                          : "opacity-0"
                      } ${
                        isActive(item.href) 
                          ? "text-primary bg-primary/10" 
                          : "text-foreground/80"
                      }`}
                      style={{
                        animationDelay: isOpen ? `${index * 50}ms` : "0ms",
                      }}
                    >
                      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
                      {item.name}
                    </Link>
                  );
                })}
                <div
                  className={`flex items-center space-x-4 pt-4 border-t border-border/20 ${
                    isOpen
                      ? "animate-menu-item-in"
                      : "opacity-0"
                  }`}
                  style={{
                    animationDelay: isOpen ? `${navigation.length * 50}ms` : "0ms",
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleLanguage}
                    className="btn-language"
                  >
                    {language.toUpperCase()}
                  </Button>
                  <Button
                    onClick={() => {
                      instagramClick();
                      closeMenu();
                    }}
                    className="btn-gradient flex-1"
                  >
                    <Instagram className="w-4 h-4 mr-2" />
                    Instagram
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
