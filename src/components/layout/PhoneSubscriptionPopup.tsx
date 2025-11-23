import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X, Phone, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PhoneSubscriptionPopupProps {
  language: 'en' | 'fr';
}

const SHOW_DELAY = 5000; // 5 seconds

// Pages where popup should NOT show
const EXCLUDED_PATHS = [
  '/admin',
  '/admin/login',
  '/ambassador/auth',
  '/ambassador/dashboard'
];

const PhoneSubscriptionPopup = ({ language }: PhoneSubscriptionPopupProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [shouldShowOnThisPage, setShouldShowOnThisPage] = useState(false);
  const { toast } = useToast();

  // Probability system for showing notification
  // Returns true/false based on random probability
  const shouldShowNotification = (): boolean => {
    const random = Math.random();
    
    // 30% chance - Show on all pages (high probability)
    if (random < 0.3) {
      return true;
    }
    // 25% chance - Show on 3 out of 4 pages
    else if (random < 0.55) {
      return Math.random() < 0.75; // 75% chance per page
    }
    // 20% chance - Show on 2 out of 4 pages
    else if (random < 0.75) {
      return Math.random() < 0.5; // 50% chance per page
    }
    // 15% chance - Show on 1 out of 4 pages
    else if (random < 0.9) {
      return Math.random() < 0.25; // 25% chance per page
    }
    // 10% chance - Don't show at all
    else {
      return false;
    }
  };

  // Check if current path should exclude popup
  const shouldShowPopup = () => {
    return !EXCLUDED_PATHS.some(path => location.pathname.startsWith(path));
  };

  useEffect(() => {
    // Reset visibility when route changes
    setIsVisible(false);
    setIsExiting(false);
    setIsSuccess(false);
    setIsDuplicate(false);
    setPhoneNumber("");

    // Only show on mobile devices
    if (!isMobile) {
      return;
    }

    // Don't show on admin/login pages
    if (!shouldShowPopup()) {
      return;
    }

    // Determine if notification should show on this page (random probability)
    const showOnPage = shouldShowNotification();
    setShouldShowOnThisPage(showOnPage);

    if (!showOnPage) {
      return;
    }

    // Random delay between 3-8 seconds for variety
    const randomDelay = Math.floor(Math.random() * 5000) + 3000;
    
    // Show popup after random delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, randomDelay);

    return () => clearTimeout(timer);
  }, [location.pathname, isMobile]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      setIsSuccess(false);
      setIsDuplicate(false);
      setPhoneNumber("");
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: language === 'en' ? "Phone Number Required" : "Numéro de Téléphone Requis",
        description: language === 'en' 
          ? "Please enter your phone number to stay updated."
          : "Veuillez entrer votre numéro de téléphone pour rester informé.",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number format (Tunisian format: 8 digits starting with 2, 5, 9, or 4)
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      toast({
        title: language === 'en' ? "Invalid Phone Number" : "Numéro de Téléphone Invalide",
        description: language === 'en' 
          ? "Please enter a valid Tunisian phone number (8 digits starting with 2, 5, 9, or 4)."
          : "Veuillez entrer un numéro de téléphone tunisien valide (8 chiffres commençant par 2, 5, 9 ou 4).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      
      const { error } = await supabase
        .from('phone_subscribers')
        .insert({
          phone_number: cleanPhone,
          language: language,
        });

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          setIsSuccess(true);
          setIsDuplicate(true);
          // Close popup after showing duplicate message
          setTimeout(() => {
            handleClose();
          }, 2000);
        } else {
          throw error;
        }
      } else {
        setIsSuccess(true);
        setIsDuplicate(false);
        // Close popup after success
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error subscribing phone number:', error);
      setIsSubmitting(false);
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: language === 'en' 
          ? "Failed to subscribe. Please try again later."
          : "Échec de l'abonnement. Veuillez réessayer plus tard.",
        variant: "destructive",
      });
    }
  };

  // Only show on mobile devices
  if (!isMobile) return null;
  
  // Don't show popup on excluded pages or if not selected for this page
  if (!shouldShowPopup() || !shouldShowOnThisPage || !isVisible) return null;

  const translations = {
    en: {
      title: "Stay Updated!",
      subtitle: "Get all the latest news and exclusive updates",
      description: "Don't miss out on upcoming events, special offers, and exciting announcements. Subscribe now!",
      phonePlaceholder: "Enter your phone number",
      subscribe: "Subscribe",
      subscribing: "Subscribing...",
      close: "Close",
      success: "Successfully subscribed!",
      alreadySubscribed: "Already subscribed!",
    },
    fr: {
      title: "Restez Informé!",
      subtitle: "Recevez toutes les dernières nouvelles et mises à jour exclusives",
      description: "Ne manquez pas les événements à venir, les offres spéciales et les annonces excitantes. Abonnez-vous maintenant!",
      phonePlaceholder: "Entrez votre numéro de téléphone",
      subscribe: "S'abonner",
      subscribing: "Abonnement...",
      close: "Fermer",
      success: "Abonnement réussi!",
      alreadySubscribed: "Déjà abonné!",
    },
  };

  const t = translations[language];

  return (
    <>
      {/* Native Mobile Notification - Slides from top */}
      <div 
        className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none"
        style={{
          transform: isExiting ? 'translateY(-100%)' : 'translateY(0)',
          opacity: isExiting ? 0 : 1,
          transition: isExiting 
            ? 'transform 0.35s cubic-bezier(0.4, 0, 1, 1), opacity 0.35s ease-out'
            : 'transform 0.5s cubic-bezier(0.2, 0, 0, 1), opacity 0.5s ease-out'
        }}
      >
        <div className="px-2 pt-2 pb-1">
          <div 
            className="bg-gradient-to-br from-primary/95 via-primary/90 to-secondary/95 backdrop-blur-xl rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-primary/30 overflow-hidden pointer-events-auto cursor-pointer active:opacity-95 transition-opacity"
            onClick={handleClose}
          >
            <div className="px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                {/* App Icon with gradient */}
                <div className="w-8 h-8 rounded-[10px] bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                
                {/* Notification Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-white/80">
                      {language === 'en' ? 'Andiamo Events' : 'Andiamo Events'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClose();
                      }}
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3 h-3 text-white/80" />
                    </button>
                  </div>
                  <h4 className="text-[13px] font-semibold text-white mb-0.5 leading-[1.2]">
                    {t.title}
                  </h4>
                  <p className="text-[12px] text-white/90 leading-[1.3] mb-2">
                    {t.subtitle}
                  </p>
                  
                  {/* Compact Form */}
                  {!isSuccess ? (
                    <form 
                      onSubmit={(e) => {
                        e.stopPropagation();
                        handleSubmit(e);
                      }}
                      className="space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70">
                          <Phone className="h-3 w-3" />
                        </div>
                        <Input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 8) {
                              setPhoneNumber(value);
                            }
                          }}
                          placeholder={t.phonePlaceholder}
                          className="pl-7 h-8 text-xs bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-white/20 backdrop-blur-sm"
                          disabled={isSubmitting}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        className="w-full h-7 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1.5" />
                        )}
                        {isSubmitting ? t.subscribing : t.subscribe}
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      <p className="text-[11px] text-white/90">
                        {isDuplicate ? t.alreadySubscribed : t.success}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneSubscriptionPopup;

