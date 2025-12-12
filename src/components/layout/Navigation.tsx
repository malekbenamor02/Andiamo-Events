
import { useState, useEffect } from "react";
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
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 backdrop-blur-2xl border-b border-border/20 p-4 nav-transparent">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => {
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
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                      isActive(item.href) 
                        ? "text-primary" 
                        : "text-foreground/80"
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5" />}
                    {item.name}
                  </Link>
                );
              })}
              <div className="flex items-center space-x-4 pt-4 border-t border-border/20">
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
                  className="btn-gradient flex-1"
                >
                  <Instagram className="w-4 h-4 mr-2" />
                  Instagram
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
