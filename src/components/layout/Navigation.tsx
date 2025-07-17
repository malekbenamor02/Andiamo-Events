
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, MessageCircle } from "lucide-react";
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
      { name: "Gallery", href: "/gallery" },
      { name: "About", href: "/about" },
      { name: "Ambassador", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
    ],
    fr: [
      { name: "Accueil", href: "/" },
      { name: "Événements", href: "/events" },
      { name: "Galerie", href: "/gallery" },
      { name: "À Propos", href: "/about" },
      { name: "Ambassadeur", href: "/ambassador" },
      { name: "Contact", href: "/contact" },
    ]
  };

  const navigation = navigationContent[language] || defaultNavigation[language];

  const whatsappClick = () => {
    const phone = contactInfo?.phone || "216XXXXXXXX";
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, "_blank");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-border/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-orbitron font-bold text-gradient-neon">
              ANDIAMO
            </div>
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
              className="text-foreground/80 hover:text-primary"
            >
              {language.toUpperCase()}
            </Button>
            <Button
              onClick={whatsappClick}
              className="btn-gradient"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
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
          <div className="md:hidden absolute top-16 left-0 right-0 glass border-b border-border/20 p-4">
            <div className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive(item.href) 
                      ? "text-primary" 
                      : "text-foreground/80"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <div className="flex items-center space-x-4 pt-4 border-t border-border/20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleLanguage}
                  className="text-foreground/80 hover:text-primary"
                >
                  {language.toUpperCase()}
                </Button>
                <Button
                  onClick={whatsappClick}
                  className="btn-gradient flex-1"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
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
