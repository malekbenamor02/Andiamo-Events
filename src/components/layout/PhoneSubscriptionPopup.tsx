import { useState, useEffect } from "react";
import { X, Phone, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PhoneSubscriptionPopupProps {
  language: 'en' | 'fr';
}

const STORAGE_KEY = 'phone_subscription_popup_closed';
const SHOW_DELAY = 5000; // 5 seconds

const PhoneSubscriptionPopup = ({ language }: PhoneSubscriptionPopupProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if popup was previously closed
    const wasClosed = localStorage.getItem(STORAGE_KEY);
    if (wasClosed === 'true') {
      return;
    }

    // Show popup after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, SHOW_DELAY);

    return () => clearTimeout(timer);
  }, []);

  // Convert to floating mode after initial display
  useEffect(() => {
    if (isVisible && !isFloating) {
      const floatTimer = setTimeout(() => {
        setIsFloating(true);
      }, 3000); // Wait 3 seconds before floating
      return () => clearTimeout(floatTimer);
    }
  }, [isVisible, isFloating]);

  const handleClose = () => {
    setIsVisible(false);
    setIsFloating(false);
    localStorage.setItem(STORAGE_KEY, 'true');
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
          toast({
            title: language === 'en' ? "Already Subscribed" : "Déjà Abonné",
            description: language === 'en' 
              ? "This phone number is already subscribed to our updates."
              : "Ce numéro de téléphone est déjà abonné à nos mises à jour.",
          });
        } else {
          throw error;
        }
      } else {
        setIsSuccess(true);
        toast({
          title: language === 'en' ? "Thank You!" : "Merci!",
          description: language === 'en' 
            ? "You'll receive all the latest news and updates."
            : "Vous recevrez toutes les dernières nouvelles et mises à jour.",
        });
        
        // Close popup after success
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error subscribing phone number:', error);
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: language === 'en' 
          ? "Failed to subscribe. Please try again later."
          : "Échec de l'abonnement. Veuillez réessayer plus tard.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

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
    },
  };

  const t = translations[language];

  return (
    <>
      {/* Backdrop overlay */}
      {!isFloating && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-500 ease-out animate-in fade-in-0"
          onClick={handleClose}
        />
      )}

      {/* Popup */}
      <div
        className={cn(
          "fixed z-50 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isFloating
            ? "bottom-6 right-6 w-[320px] max-w-[calc(100vw-2rem)]"
            : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4"
        )}
        style={{
          animation: isVisible ? 'slideInScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : undefined
        }}
      >
        <div className="relative bg-gradient-to-br from-background via-background to-muted/20 border border-primary/20 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
          
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
              backgroundSize: '20px 20px',
            }} />
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 rounded-full p-1.5 hover:bg-muted/80 transition-all duration-200 group"
            aria-label={t.close}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Content */}
          <div className="relative p-5">
            {/* Icon and Title */}
            <div className="flex items-start gap-3 mb-4">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse" />
                <div className="relative bg-gradient-to-br from-primary to-primary/80 p-2.5 rounded-xl shadow-lg">
                  <Phone className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-0.5">
                  {t.title}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {t.subtitle}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {t.description}
            </p>

            {/* Success State */}
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-ping" />
                  <CheckCircle2 className="relative h-12 w-12 text-primary animate-in zoom-in-95 duration-300" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {t.success}
                </p>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  <Input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      // Only allow digits
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 8) {
                        setPhoneNumber(value);
                      }
                    }}
                    placeholder={t.phonePlaceholder}
                    className="pl-9 h-10 text-sm bg-background/50 border-primary/20 focus:border-primary/40 focus:ring-primary/20 transition-all duration-200"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      {t.subscribing}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 mr-2" />
                      {t.subscribe}
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Decorative elements */}
            <div className="absolute -bottom-3 -right-3 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <div className="absolute -top-3 -left-3 w-20 h-20 bg-primary/5 rounded-full blur-xl" />
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneSubscriptionPopup;

