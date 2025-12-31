
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Instagram, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigationContent } from "@/hooks/useSiteContent";

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
  const [navigationContent, setNavigationContent] = useState<NavigationContent>({});
  const [contactInfo, setContactInfo] = useState<ContactInfo>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  // Use cached site content hook
  const { data: siteContent } = useNavigationContent();
  
  useEffect(() => {
    if (siteContent) {
      if (siteContent.navigation) {
        setNavigationContent(siteContent.navigation as NavigationContent);
      }
      if (siteContent.contact_info) {
        setContactInfo(siteContent.contact_info as ContactInfo);
      }
    }
  }, [siteContent]);

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

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
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
                  className={`text-sm font-medium transition-colors ${
                    isActive(item.href) 
                      ? "text-primary" 
                      : "text-white hover:text-primary"
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

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={toggleMenu}
              className="md:hidden p-2 text-white hover:text-primary transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-95"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 100,
              }}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <div className="relative w-6 h-6">
                <Menu 
                  className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
                    isMenuOpen ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
                  }`}
                />
                <X 
                  className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
                    isMenuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
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
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[80] animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
            onTouchEnd={(e) => {
              e.preventDefault();
              setIsMenuOpen(false);
            }}
            style={{ 
              touchAction: 'manipulation',
              animation: 'fadeIn 0.3s ease-out',
            }}
          />
          {/* Menu Panel */}
          <div 
            className="md:hidden fixed top-16 left-0 right-0 z-[90] shadow-2xl"
            onClick={(e) => {
              // Close if clicking on the menu panel itself (not on content)
              if (e.target === e.currentTarget) {
                setIsMenuOpen(false);
              }
            }}
            onTouchEnd={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                setIsMenuOpen(false);
              }
            }}
            style={{
              touchAction: 'manipulation',
              animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              maxHeight: 'calc(100vh - 4rem)',
              overflow: 'hidden',
            }}
          >
            <div 
              className="backdrop-blur-xl border-b border-border/50 bg-card"
            >
              <div className="p-6 space-y-1">
                {navigation.map((item, index) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block px-4 py-3.5 rounded-md text-base font-medium transition-all duration-300 ${
                      isActive(item.href)
                        ? "text-primary bg-card"
                        : "text-white hover:text-primary hover:bg-card/50"
                    }`}
                    style={{
                      animation: `slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`,
                    }}
                  >
                    {item.name}
                  </Link>
                ))}
                <div 
                  className="pt-6 mt-6 border-t border-border space-y-3"
                  style={{
                    animation: `slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${navigation.length * 0.05 + 0.1}s both`,
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toggleLanguage();
                    }}
                    className="w-full justify-start hover:bg-card/50 transition-all duration-300 text-white"
                  >
                    {language.toUpperCase()}
                  </Button>
                  <Button
                    onClick={() => {
                      instagramClick();
                      setIsMenuOpen(false);
                    }}
                    className="w-full btn-gradient transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                  >
                    <Instagram className="w-4 h-4 mr-2" />
                    Instagram
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default Navigation;
